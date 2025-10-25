import { getBotConfig } from "..";
import { createBotCommand } from "../BotCommandWithKeywords";
import { handleAdventureJoin } from "@/common/handleAdventure";

export const adventureJoinCommand = createBotCommand(
    "adventure",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        const amountParam = params[0];
        const result = await handleAdventureJoin({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName,
            amountParam,
            prefix: getBotConfig().prefix,
        });
        const response = result.split("$(newline)");
        for (const line of response)
            say(line);
    },
    { aliases: ["adv"], ignoreCase: true },
);
