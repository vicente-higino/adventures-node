import { createBotCommand } from "../BotCommandWithKeywords";
import { handleAdventureEnd } from "@/common/handleAdventure";

export const adventureEndCommand = createBotCommand(
    "adventureend",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        const result = await handleAdventureEnd({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName: userDisplayName,
        });
        say(result);
    },
    { aliases: ["advend"], ignoreCase: true },
);
