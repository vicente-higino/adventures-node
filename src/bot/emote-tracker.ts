import { getBotConfig } from "./index";
import { getUserByUsername } from "@/twitch/api";
import { EmoteFetcher, Emote } from "@/common/emotes";
import { Bot, MessageEvent } from "@twurple/easy-bot";
import { prisma } from "@/prisma";
import cron from "node-cron";
import { uuidv7 } from "uuidv7";
import { EmoteProvider, Prisma } from "@prisma/client";

// Tracks emote usage per channel
export class EmoteTracker {
    private emoteFetcher = new EmoteFetcher();
    private channelEmotes: Map<string, Map<string, Emote>> = new Map(); // channel login -> emotes
    // private emoteUsage: Map<string, Map<string, number>> = new Map(); // channel login -> emote name -> count

    constructor(private bot: Bot) { }

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

    private extractNativeTwitchEmotes(ctx: MessageEvent): Map<string, Emote> {
        // ctx.emoteOffsets: { [emoteId: string]: [start, end][] }
        // Returns Map<emoteName, string[]> where string[] are index ranges
        const emoteMap = new Map<string, Emote>();
        if (!ctx.emoteOffsets.size) return emoteMap;
        for (const [emoteId, ranges] of ctx.emoteOffsets) {
            for (const range of ranges) {
                const [start, end] = range.split("-").map(Number);

                const emoteName = ctx.text.substring(start, end + 1);
                if (!emoteMap.has(emoteName)) {
                    emoteMap.set(emoteName, { name: emoteName, id: emoteId, provider: EmoteProvider.Twitch, data: null });
                }
            }
        }
        return emoteMap;
    }

    private listenToChat() {
        this.bot.onMessage(async ctx => {
            const channel = ctx.broadcasterName;
            const channelId = ctx.broadcasterId;
            const userId = ctx.userId;
            const text = ctx.text;
            const emotes = this.channelEmotes.get(channel);
            if (!emotes) return;

            const nativeEmotes = this.extractNativeTwitchEmotes(ctx);

            const words = text
                .split(" ")
                .map(word => word.trim())
                .filter(word => word.length > 0);

            const emoteEvents: Prisma.EmoteUsageEventV2CreateInput[] = [];

            // Check both native Twitch emotes and custom emotes
            for (const word of words) {
                if (!word) continue;
                if (emotes.has(word) || nativeEmotes.has(word)) {
                    emoteEvents.push({
                        id: uuidv7(), channelProviderId: channelId, emoteName: word, userId,
                        provider: emotes.has(word) ? emotes.get(word)!.provider : nativeEmotes.get(word)!.provider,
                        emoteId: emotes.has(word) ? emotes.get(word)!.id : nativeEmotes.get(word)!.id,
                    });
                }
            }

            if (emoteEvents.length > 0) {
                try {
                    await prisma.emoteUsageEventV2.createMany({ data: emoteEvents });
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
        if (!user) return 0;
        const emotes = await this.emoteFetcher.fetchAll(user.id);
        this.channelEmotes.set(channel, emotes);
        return emotes.size;
        // Optionally reset usage for refreshed emotes:
        // this.emoteUsage.set(channel, new Map());
    }

    async refreshAllEmotes() {
        const config = getBotConfig();
        let total = 0;
        for (const channel of config.channels) {
            total += await this.refreshEmotes(channel);
        }
        return total;
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
