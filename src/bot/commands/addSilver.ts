import { getBotPrefix, isSuperUser } from "@/bot";
import { handleAddSilver } from "@/common/handleAddSilver";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";

export const addSilverCommand = createBotCommand(
    "addsilver",
    async (params, ctx) => {
        const { say, broadcasterName, broadcasterId } = ctx;
        const { isMod, isBroadcaster, userId, displayName } = ctx.msg.userInfo;
        if (!isMod && !isBroadcaster && !isSuperUser(userId)) return;
        let targetUsername = params.shift()?.replaceAll("@", "");
        const addAmount = params.shift();
        if (!targetUsername || !addAmount) {
            say(`Usage: ${getBotPrefix()}addsilver <username> <new_balance>`);
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
