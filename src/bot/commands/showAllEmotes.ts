import { createBotCommand } from "../botCommandWithKeywords";
import { emoteTracker, getBotConfig } from "@/bot";
import { EmoteManager } from "@/emotes";
import { z } from "zod";

type Option = "all" | "missing";

const parseOption = z.enum(["all", "missing"]);

export const showAllEmotesCommand = createBotCommand(
    "showusedemotes",
    async (params, ctx) => {
        const { say, msg, broadcasterName } = ctx;
        const { isMod, isBroadcaster, userId } = msg.userInfo;
        if (!isMod && !isBroadcaster && getBotConfig().superUserId !== userId) {
            return;
        }
        const arg = parseOption.safeParse(params.shift());
        let option: Option = "all";
        if (arg.success) {
            option = arg.data;
        }
        let emotes = EmoteManager.getAllEmotes();
        if (option == "missing") {
            emotes = emotes.filter(e => !emoteTracker?.channelHasEmote(broadcasterName, e.name) && e.provider !== "native");
        }
        const allEmotes = emotes.map(e => e.name);
        // Remove duplicates and sort
        const uniqueEmotes = Array.from(new Set(allEmotes)).toSorted();
        say(uniqueEmotes.join(" "));
    },
    { aliases: ["sue"], ignoreCase: true },
);
