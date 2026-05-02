import { getBotPrefix, isSuperUser } from "@/bot";
import { handleUpdateSilver } from "@/common/handleUpdateSilver";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { createBotCommand } from "../botCommandWithKeywords";

export const updateSilverCommand = createBotCommand(
    "updatesilver",
    async (params, ctx) => {
        const { say, broadcasterName, broadcasterId } = ctx;
        const { isMod, isBroadcaster, userId, displayName } = ctx.msg.userInfo;
        if (!isMod && !isBroadcaster && !isSuperUser(userId)) return;
        let targetUsername = params.shift()?.replaceAll("@", "");
        const newBalance = params.shift();
        if (!targetUsername || !newBalance) {
            say(`Usage: ${getBotPrefix()}updatesilver <username> <new_balance>`);
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
