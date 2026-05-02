import { getBotConfig, isSuperUser } from "@/bot";
import { handleAdventureEnd } from "@/common/handleAdventure";
import { createBotCommand } from "../botCommandWithKeywords";

export const forceEndAdventureCommand = createBotCommand(
    "forceendadventure",
    async (params, ctx) => {
        let { say, msg, broadcasterName, broadcasterId } = ctx;
        const { isMod, isBroadcaster, userId, userName, displayName } = msg.userInfo;
        if (!isMod && !isBroadcaster && !isSuperUser(userId)) {
            return;
        }
        if (getBotConfig().modChannels.includes(broadcasterName)) {
            const res = await handleAdventureEnd({
                channelLogin: broadcasterName,
                channelProviderId: broadcasterId,
                userProviderId: getBotConfig().userId,
                userLogin: userName,
                userDisplayName: displayName,
            });
            say(res);
            return;
        }
        say(`!adventureend`);
    },
    { aliases: ["fea", "forceadventureend"], ignoreCase: true },
);
