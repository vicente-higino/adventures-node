import { getBotConfig } from "./index";
import { getUserByUsername } from "@/twitch/api";
import { EmoteFetcher, Emote } from "@/common/emotes";
import { Bot } from "@twurple/easy-bot";
import { prisma } from "@/prisma";
import cron from "node-cron";

// Tracks emote usage per channel
export class EmoteTracker {
    private emoteFetcher = new EmoteFetcher();
    private channelEmotes: Map<string, Map<string, Emote>> = new Map(); // channel login -> emotes
    // private emoteUsage: Map<string, Map<string, number>> = new Map(); // channel login -> emote name -> count

    constructor(private bot: Bot) {}

    async initialize() {
        const config = getBotConfig();
        const channels = config.channels;
        for (const channel of channels) {
            const user = await getUserByUsername(prisma, channel);
            if (!user) continue;
            const emotes = await this.emoteFetcher.fetchAll(user.id);
            this.channelEmotes.set(channel, emotes);
            // this.emoteUsage.set(channel, new Map());
        }
        this.listenToChat();
        this.startRefreshAllEmotesCronjobTask();
    }

    private listenToChat() {
        this.bot.onMessage(async ctx => {
            const channel = ctx.broadcasterName;
            const channelId = ctx.broadcasterId;
            const text = ctx.text;
            const emotes = this.channelEmotes.get(channel);
            if (!emotes) return;
            // const usage = this.emoteUsage.get(channel)!;

            const words = text
                .split(" ")
                .map(word => word.trim())
                .filter(word => word.length > 0);

            const emoteEvents: { channelProviderId: string; emoteName: string }[] = [];

            for (const word of words) {
                if (!word) continue;
                if (emotes.has(word)) {
                    // const t = (usage.get(word) || 0) + 1;
                    // usage.set(word, t);

                    emoteEvents.push({ channelProviderId: channelId, emoteName: word });
                }
            }

            if (emoteEvents.length > 0) {
                try {
                    await prisma.emoteUsageEvent.createMany({ data: emoteEvents });
                } catch (err) {
                    console.error(`[EmoteTracker] Failed to batch insert EmoteUsageEvents:`, err);
                }
            }
        });
    }

    // getUsage(channel: string, emoteName: string): number {
    //     return this.emoteUsage.get(channel)?.get(emoteName) || 0;
    // }

    getChannelEmotes(channel: string): Map<string, Emote> {
        return this.channelEmotes.get(channel) || new Map();
    }

    async refreshEmotes(channel: string) {
        const user = await getUserByUsername(prisma, channel);
        if (!user) return;
        const emotes = await this.emoteFetcher.fetchAll(user.id);
        this.channelEmotes.set(channel, emotes);
        // Optionally reset usage for refreshed emotes:
        // this.emoteUsage.set(channel, new Map());
    }

    refreshAllEmotes() {
        const config = getBotConfig();
        for (const channel of config.channels) {
            this.refreshEmotes(channel);
        }
    }
    startRefreshAllEmotesCronjobTask() {
        cron.schedule(
            "0 0,12 * * *",
            c => {
                console.log(`[${c.dateLocalIso}] Running Refresh Emotes Task`);
                this.refreshAllEmotes();
            },
            { timezone: "UTC" },
        );
    }
}
