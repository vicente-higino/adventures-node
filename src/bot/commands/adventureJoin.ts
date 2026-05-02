import { getBotPrefix } from "..";
import { createBotCommand } from "../botCommandWithKeywords";
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
            prefix: getBotPrefix(),
        });
        const response = result.split("$(newline)");
        for (const line of response) say(line);
    },
    { aliases: ["adv"], ignoreCase: true },
);
