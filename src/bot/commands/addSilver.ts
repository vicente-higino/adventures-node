import { getBotConfig } from "@/bot";
import { createBotCommand } from "../BotCommandWithKeywords";
import { handleAddSilver } from "@/common/handleAddSilver";
import { getUserById, getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";

export const addSilverCommand = createBotCommand(
    "addsilver",
    async (params, ctx) => {
        const { say, broadcasterName, broadcasterId } = ctx;
        const { isMod, isBroadcaster, userId, displayName } = ctx.msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) return;
        let targetUsername = params.shift()?.replaceAll("@", "");
        const addAmount = params.shift();
        if (!targetUsername || !addAmount) {
            say(`Usage: ${getBotConfig().prefix}addsilver <username> <new_balance>`);
            return;
        }
        const user = await getUserByUsername(prisma, targetUsername);
        if (!user) {
            say(`@${displayName}, user ${targetUsername} not found`);
            return;
        }
        const result = await handleAddSilver({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: user.id,
            userLogin: user.login,
            userDisplayName: user.displayName,
            add: addAmount,
        });
        say(result);
    },
    { aliases: ["asilver", "incbalance", "addpoints"], ignoreCase: true },
);
