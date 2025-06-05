import { createBotCommand } from "../BotCommandWithKeywords";
import { getFishCountSummary } from "@/common/fishCountSummary";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";

export const fishCountCommand = createBotCommand(
    "fishcount",
    async (params, ctx) => {
        let { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        let usernameArg = params.shift();
        if (usernameArg) {
            usernameArg = usernameArg.replaceAll("@", "");
            const user = await getUserByUsername(prisma, usernameArg);
            userId = user?.id ?? userId;
            userName = user?.login ?? userName;
            userDisplayName = user?.displayName ?? userDisplayName;
        }
        const summary = await getFishCountSummary({
            prisma,
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName,
        });
        say(summary);
    },
    { aliases: ["fishstats"], ignoreCase: true },
);
