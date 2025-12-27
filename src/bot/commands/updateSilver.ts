import { getBotConfig } from "@/bot";
import { createBotCommand } from "../BotCommandWithKeywords";
import { handleUpdateSilver } from "@/common/handleUpdateSilver";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";

export const updateSilverCommand = createBotCommand(
    "updatesilver",
    async (params, ctx) => {
        const { say, broadcasterName, broadcasterId } = ctx;
        const { isMod, isBroadcaster, userId, displayName } = ctx.msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) return;
        let targetUsername = params.shift()?.replaceAll("@", "");
        const newBalance = params[1];
        if (!targetUsername || !newBalance) {
            say(`Usage: ${getBotConfig().prefix}updatesilver <username> <new_balance>`);
            return;
        }
        const user = await getUserByUsername(prisma, targetUsername);
        if (!user) {
            say(`@${displayName}, user ${targetUsername} not found`);
            return;
        }
        const result = await handleUpdateSilver({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: user.id,
            userLogin: user.login,
            userDisplayName: user.displayName,
            newBalance,
        });
        say(result);
    },
    { aliases: ["usilver", "setbalance", "updatepoints"], ignoreCase: true },
);
