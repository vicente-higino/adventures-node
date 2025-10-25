import { createBotCommand } from "../BotCommandWithKeywords";
import { handleDuelCreate } from "@/common/handleDuels";
import { getBotConfig } from "..";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";

export const duelCreateCommand = createBotCommand(
    "duel",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        const useMsg = `Usage: ${getBotConfig().prefix}duel username [silver(K/M/B)|%|all]`;
        let usernameArg = params.shift();
        const wagerAmountStr = params.shift();
        if (!usernameArg || !wagerAmountStr) {
            say(useMsg);
            return;
        }
        const user = await getUserByUsername(prisma, usernameArg.replaceAll("@", ""));
        if (!user) {
            say(useMsg);
            return;
        }
        const challengedId = user.id;
        const result = await handleDuelCreate({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            challengerId: userId,
            challengedId,
            userlogin: userName,
            userDisplayName,
            wagerAmountStr,
            prefix: getBotConfig().prefix,
        });
        const response = result.split("$(newline)");
        for (const line of response) say(line);
    },
    { aliases: [], ignoreCase: true },
);
