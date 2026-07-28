import { getBotPrefix } from "@/bot";
import { grantRedeemable, isRedeemableCode, redeemableCodes, redeemables } from "@/common/redeemables";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createAdminBotCommand } from "../botCommandWithKeywords";

const commandName = "giveredeemable";
const usage = () => `${getBotPrefix()}${commandName} <username> <redeemable_code> [quantity] [channel]`;

export const giveRedeemableCommand = createAdminBotCommand(
    commandName,
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        const [targetUsernameRaw, redeemableCodeRaw, quantityRaw, channelUsernameRaw, ...extraParams] = params;

        if (!targetUsernameRaw || !redeemableCodeRaw || extraParams.length > 0) {
            await say(`Usage: ${usage()}. Valid codes: ${redeemableCodes.join(", ")}`);
            return;
        }

        const redeemableCode = redeemableCodeRaw.toLowerCase();
        const redeemable = redeemables.find(item => item.code === redeemableCode);
        if (!isRedeemableCode(redeemableCode) || !redeemable) {
            await say(`Invalid redeemable code: ${redeemableCodeRaw}. Valid codes: ${redeemableCodes.join(", ")}`);
            return;
        }

        const quantity = quantityRaw === undefined ? 1 : Number(quantityRaw);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
            await say(`Quantity must be a positive whole number. Usage: ${usage()}`);
            return;
        }

        const targetUsername = targetUsernameRaw.replaceAll("@", "").toLowerCase();
        const targetUser = await getUserByUsername(prisma, targetUsername);
        if (!targetUser) {
            await say(`User not found: ${targetUsername}`);
            return;
        }

        let channelProviderId = broadcasterId;
        let channelDisplayName = broadcasterName;
        if (channelUsernameRaw) {
            const channelUsername = channelUsernameRaw.replaceAll("@", "").toLowerCase();
            const channelUser = await getUserByUsername(prisma, channelUsername);
            if (!channelUser) {
                await say(`Channel not found: ${channelUsername}`);
                return;
            }
            channelProviderId = channelUser.id;
            channelDisplayName = channelUser.displayName;
        }

        try {
            await grantRedeemable({ userId: targetUser.id, channelProviderId, redeemableCode, quantity });
        } catch (error) {
            logger.error(error, "Failed to grant redeemable");
            await say(`Failed to grant ${redeemableCode} to @${targetUser.displayName}.`);
            return;
        }

        await say(`Granted ${quantity}x ${redeemable.name} to @${targetUser.displayName} on ${channelDisplayName} channel.`);
    },
    { aliases: ["grantredeemable","gr"], ignoreCase: true },
);
