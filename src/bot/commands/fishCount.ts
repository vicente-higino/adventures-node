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
    { aliases: ["fishstats", "fc"], ignoreCase: true },
);

// New global fish count command using getFishCountSummary
export const fishCountGlobalCommand = createBotCommand(
    "fishcountglobal",
    async (_params, ctx) => {
        const { broadcasterId, broadcasterName, say } = ctx;
        // Use getFishCountSummary with userProviderId = null to get channel stats
        const summary = await getFishCountSummary({
            prisma,
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: null,
            userLogin: null,
            userDisplayName: broadcasterName,
        });
        say(summary);
    },
    { aliases: ["fishstatsglobal", "fcg"], ignoreCase: true },
);
