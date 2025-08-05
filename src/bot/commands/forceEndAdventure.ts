import { getBotConfig } from "@/bot";
import { createBotCommand } from "../BotCommandWithKeywords";

export const forceEndAdventureCommand = createBotCommand(
    "forceendadventure",
    async (params, ctx) => {
        let { say, msg } = ctx;
        const { isMod, isBroadcaster, userId } = msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) {
            return;
        }
        say(`!adventureend`);
    },
    { aliases: ["fea"], ignoreCase: true },
);
