import { Emote } from "@/common/emotes";
import logger from "@/logger";
import { Bot } from "@twurple/easy-bot";
import cron from "node-cron";
import { getBotConfig } from "./index";
import { prisma } from "@/prisma";
import { sendActionToChannel, sendMessageToChannel } from "@/utils/misc";
import { getUserById, getUserByUsername } from "@/twitch/api";
import { format, ms } from "ms";

export class ChatMail {
    private channelMails: Map<string, Set<string>> = new Map();

    constructor(private bot: Bot) {
        this.initialize();
    }

    private async initialize() {
        const config = getBotConfig();
        const channels = config.channels;
        for (const channel of channels) {
            this.loadMailsForChannel(channel);
        }
        this.listenToChat();
        this.scheduleMailCleanupTask()
    }

    private async loadMailsForChannel(channel: string) {
        const user = await getUserByUsername(prisma, channel);
        if (!user) {
            logger.warn(`Could not find user ID for channel: ${channel}`);
            return;
        }
        const mails = await prisma.chatMail.findMany({
            where: {
                channelId: user.id,
                deliveredAt: null,
            },
        });
        const recipientIds = new Set(mails.map(mail => mail.recipientId));
        this.channelMails.set(user.id, recipientIds);
        logger.info(`Loaded ${mails.length} pending mails for channel: ${channel}`);
    }

    private listenToChat() {
        this.bot.onMessage(async ctx => {
            const channel = ctx.broadcasterName;
            const channelId = ctx.broadcasterId;
            const userId = ctx.userId;
            const text = ctx.text;
            const channelMails = this.channelMails.get(channelId);
            if (channelMails && channelMails.has(userId)) {
                const mails = await prisma.chatMail.findMany({
                    where: {
                        channelId,
                        recipientId: userId,
                        deliveredAt: null,
                    },
                    include: {
                        sender: true, recipient: true,
                    },
                });
                channelMails.delete(userId);
                if (mails.length > 0) {
                    for (const mail of mails) {
                        await prisma.chatMail.update({
                            where: { id: mail.id },
                            data: { deliveredAt: new Date() },
                        });
                        const senderName = mail.sender.displayName;
                        const recipientName = mail.recipient.displayName;
                        const content = mail.content;
                        const time = format(new Date().getTime() - mail.createdAt.getTime());
                        sendActionToChannel(channel, `@${recipientName}, message from @${senderName} (${time} ago): ${content}`);
                    }
                }
            }
        });
    }

    private async mailCleanup() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const result = await prisma.chatMail.deleteMany({
            where: {
                deliveredAt: {
                    lt: cutoffDate,
                },
            },
        });
        logger.info(`Removed ${result.count} old chat mails`);
    }

    public async addMail(channelId: string, senderId: string, recipientId: string, msg: string) {
        if (!this.channelMails.has(channelId)) {
            this.channelMails.set(channelId, new Set());
        }
        const mails = this.channelMails.get(channelId);
        if (mails) {
            const recipentUser = await getUserById(prisma, recipientId);
            if (!recipentUser) {
                logger.warn(`Attempted to send mail to non-existent user ID: ${recipientId}`);
                return null;
            }
            const senderUser = await getUserById(prisma, senderId);
            if (!senderUser) {
                logger.warn(`Attempted to send mail from non-existent user ID: ${senderId}`);
                return null;
            }
            const mail = await prisma.chatMail.create({
                data: {
                    channelId,
                    senderId,
                    recipientId,
                    content: msg,
                },
            });
            mails.add(recipientId);
            return mail;
        }
        return null;
    }

    public async cancelMail(mailId: string | null, userId: string, channelId: string): Promise<
        { status: "success" | "not_found" | "not_authorized" | "already_delivered" | "no_mail_to_cancel", mailId?: string }> {
        if (!mailId) {
            const mail = await prisma.chatMail.findFirst({
                where: {
                    senderId: userId,
                    channelId,
                    deliveredAt: null,
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!mail) {
                return { status: "no_mail_to_cancel" };
            }
            mailId = mail.mailCode;
        }
        const mail = await prisma.chatMail.findUnique({
            where: { mailCode: mailId },
        });

        if (!mail) {
            return { status: "not_found" };
        }

        // Only allow sender or recipient to cancel
        if (mail.senderId !== userId && mail.recipientId !== userId) {
            return { status: "not_authorized" };
        }

        // Can only cancel undelivered mail
        if (mail.deliveredAt !== null) {
            return { status: "already_delivered" };
        }

        await prisma.chatMail.delete({
            where: { mailCode: mailId },
        });

        // Remove from channelMails cache if recipient has no other pending mails
        const channelMails = this.channelMails.get(mail.channelId);
        if (channelMails) {
            const otherMails = await prisma.chatMail.count({
                where: {
                    channelId: mail.channelId,
                    recipientId: mail.recipientId,
                    deliveredAt: null,
                },
            });
            if (otherMails === 0) {
                channelMails.delete(mail.recipientId);
            }
        }

        return { status: "success", mailId: mail.mailCode };
    }


    private scheduleMailCleanupTask() {
        cron.schedule(
            "0 0 * * *",
            c => {
                logger.info(`Running Removing Old ChatMail Task`);
                this.mailCleanup();
            },
            { timezone: "UTC" },
        );
    }
}
