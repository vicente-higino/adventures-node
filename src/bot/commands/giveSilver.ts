import { createBotCommand } from "../BotCommandWithKeywords";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";
import { giveSilver } from "@/common/giveSilver";
import { getBotConfig } from "..";

export const giveSilverCommand = createBotCommand(
    "givesilver",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say, userDisplayName, userId, userName } = ctx;
        let targetUsername = params.shift();
        const giveAmountStr = params.shift();
        if (!targetUsername || !giveAmountStr) {
            say(`Usage: ${getBotConfig().prefix}givesilver <username> <amount|%|all>`);
            return;
        }
        targetUsername = targetUsername.replaceAll("@", "");
        const targetUser = await getUserByUsername(prisma, targetUsername);
        if (!targetUser) {
            say(`@${userDisplayName}, User not found: ${targetUsername}`);
            return;
        }
        const result = await giveSilver({
            prisma,
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            fromUserProviderId: userId,
            fromUserLogin: userName,
            fromUserDisplayName: userDisplayName,
            toUserProviderId: targetUser.id,
            giveAmountStr,
            prefix: getBotConfig().prefix,
        });
        say(result.message);
    },
    { aliases: ["givepoints"] },
);
