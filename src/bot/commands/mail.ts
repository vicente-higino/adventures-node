import { createBotCommand } from "../botCommandWithKeywords";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";
import logger from "@/logger";
import { chatMail, getBotConfig } from "..";

export const mailCommand = createBotCommand(
    "mail",
    async (params, ctx) => {
        const { say, broadcasterId, userDisplayName, userId, userName } = ctx;

        const recipientUsername = params.shift();
        const message = params.join(" ");

        if (!recipientUsername || !message) {
            say(`@${userDisplayName}, usage: ${getBotConfig().prefix}mail <@username> <message>`);
            return;
        }

        const cleanUsername = recipientUsername.replaceAll("@", "").toLowerCase();
        const recipient = await getUserByUsername(prisma, cleanUsername);
        const sender = await getUserByUsername(prisma, userName);

        if (!recipient) {
            say(`@${userDisplayName}, user not found: ${recipientUsername}`);
            return;
        }

        if (!sender) {
            logger.info(`Attempted to send mail from non-existent user: ${userName}`);
            say(`@${userDisplayName}, failed to send mail. Please try again.`);
            return;
        }
        try {
            const mail = await chatMail?.addMail(broadcasterId, sender.id, recipient.id, message);
            if (!mail) {
                say(`@${userDisplayName}, failed to send mail. Please try again.`);
                return;
            }

            say(
                `@${userDisplayName}, mail sent to @${recipient.displayName}! They'll receive it when they next type in chat. Mail ID: #${mail.mailCode}`,
            );
        } catch (error) {
            say(`@${userDisplayName}, failed to send mail. Please try again.`);
        }
    },
    { aliases: ["msg", "sendmail"] },
);

export const cancelMailCommand = createBotCommand(
    "cancelmail",
    async (params, ctx) => {
        const { say, userId, userDisplayName, broadcasterId } = ctx;

        let mailCode = params.shift()?.replace("#", "") ?? null;
        try {
            const result = await chatMail?.cancelMail(mailCode, userId, broadcasterId);
            if (!result) {
                say(`@${userDisplayName}, failed to cancel mail. Please try again.`);
                return;
            }
            if (result.status === "success") {
                say(`@${userDisplayName}, mail #${result.mailId} has been cancelled.`);
            } else if (result.status === "not_found") {
                say(`@${userDisplayName}, mail not found.`);
            } else if (result.status === "not_authorized") {
                say(`@${userDisplayName}, you can only cancel mails you sent or received.`);
            } else if (result.status === "already_delivered") {
                say(`@${userDisplayName}, that mail has already been delivered.`);
            } else if (result.status === "no_mail_to_cancel") {
                say(`@${userDisplayName}, you have no mails to cancel.`);
            }
        } catch (error) {
            logger.error(error, "Error cancelling mail");
            say(`@${userDisplayName}, failed to cancel mail. Please try again.`);
        }
    },
    { aliases: ["cm", "deletemail"], offlineOnly: false },
);
