import z from "zod";
import { emoteTracker } from "@/bot";
import { createAdminBotCommand, createBotCommand } from "../BotCommandWithKeywords";

const nameSchema = z.string().min(3);
export const refreshEmotesCommand = createBotCommand(
    "refreshemotes",
    async (params, ctx) => {
        let { say, broadcasterName, msg } = ctx;
        const { isMod, isBroadcaster } = msg.userInfo;
        if (!isMod && !isBroadcaster) {
            return;
        }
        if (!emoteTracker) {
            say("Emote tracking is not enabled.");
            return;
        }
        const total = await emoteTracker.refreshEmotes(broadcasterName);
        say(`Emotes refreshed for ${broadcasterName}. ${total} emotes in total.`);
    },
    { aliases: ["re"], offlineOnly: false },
);
export const refreshEmotesAdminCommand = createAdminBotCommand(
    "refreshemotesfor",
    async (params, ctx) => {
        let { say, broadcasterName, msg } = ctx;
        for (const p of params) {
            const name = nameSchema.safeParse(p);
            broadcasterName = name.success ? name.data : broadcasterName;
        }
        if (!emoteTracker) {
            say("Emote tracking is not enabled.");
            return;
        }
        const total = await emoteTracker.refreshEmotes(broadcasterName);
        say(`Emotes refreshed for ${broadcasterName}. ${total} emotes in total.`);
    },
    { aliases: ["ref"] },
);
