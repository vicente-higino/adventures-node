import { createBotCommand } from "../BotCommandWithKeywords";
import { getUserStatsString } from "@/common/userStats";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";

export const statsCommand = createBotCommand(
    "stats",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        let { userDisplayName, userId, userName } = ctx;
        let usernameArg = params.shift();
        if (usernameArg) {
            usernameArg = usernameArg.replaceAll("@", "");
            const user = await getUserByUsername(prisma, usernameArg);
            userId = user?.id ?? userId;
            userName = user?.login ?? userName;
            userDisplayName = user?.displayName ?? userDisplayName;
        }
        const result = await getUserStatsString({
            prisma,
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName,
        });
        say(result);
    },
    { aliases: ["adventurestats", "duelstats"] },
);
