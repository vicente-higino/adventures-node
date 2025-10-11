import { parseProviders } from "@/utils/params";
import { createBotCommand } from "../BotCommandWithKeywords";
import { getBotConfig, emoteTracker } from "@/bot";

export const showChannelEmotesCommand = createBotCommand(
    "showchannelemotes",
    async (params, ctx) => {
        const { say, msg, broadcasterName } = ctx;
        const { isMod, isBroadcaster, userId } = msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) {
            return;
        }
        if (!emoteTracker) {
            say("Emote tracker not initialized.");
            return;
        }
        const emotesMap = emoteTracker.getChannelEmotes(broadcasterName);
        if (!emotesMap || emotesMap.size === 0) {
            say("No emotes found for this channel.");
            return;
        }
        const filterProviders = parseProviders(params);
        let emotes = Array.from(emotesMap.values());
        if (filterProviders) {
            emotes = emotes.filter(e => filterProviders.includes(e.provider));
        }
        if (!emotes.length) {
            say("No emotes found for the selected provider(s).");
            return;
        }
        // Remove duplicates by name and sort
        const uniqueEmotes = Array.from(new Set(emotes.map(e => e.name))).sort();
        say(uniqueEmotes.join(" "));
    },
    { aliases: ["chanemotes", "cemotes"], ignoreCase: true },
);
