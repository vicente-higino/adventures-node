import { createBotCommand } from "../BotCommandWithKeywords";
import { getBotConfig } from "@/bot";
import * as emotes from "@/emotes";

export const showAllEmotesCommand = createBotCommand(
    "showusedemotes",
    async (params, ctx) => {
        const { say, msg } = ctx;
        const { isMod, isBroadcaster, userId } = msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) {
            return;
        }
        // Gather all emote arrays from emotes.ts
        const allEmotes: string[] = [];
        for (const value of Object.values(emotes)) {
            if (Array.isArray(value)) {
                allEmotes.push(...value);
            }
        }
        // Remove duplicates and sort
        const uniqueEmotes = Array.from(new Set(allEmotes));
        say(uniqueEmotes.join(" "));
    },
    { aliases: ["sue"], ignoreCase: true },
);
