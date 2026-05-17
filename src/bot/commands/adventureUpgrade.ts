import { upgradeAdventure } from "@/common/handleAdventure";
import { createBotCommand } from "../botCommandWithKeywords";

export const adventureUpgradeCommand = createBotCommand(
    "adventure2x",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        const result = await upgradeAdventure({
            channelLogin: broadcasterName,
            channelProviderId: broadcasterId,
            userProviderId: userId,
            userLogin: userName,
            userDisplayName,
        });
        const response = result.split("$(newline)");
        for (const line of response) say(line);
    },
    { aliases: ["adv2x"], ignoreCase: true },
);
