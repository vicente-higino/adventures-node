import { EmoteProvider } from "@prisma/client";
import { z } from "zod";

const SEVENTV_URL = (userId: string) => `https://7tv.io/v3/users/twitch/${userId}`;
const FFZ_URL = (userId: string) => `https://api.frankerfacez.com/v1/room/id/${userId}`;
const BBTV_URL = (userId: string) => `https://api.betterttv.net/3/cached/users/twitch/${userId}`;

export const ffzResSchema = z.object({
    room: z.object({
        _id: z.number(),
        twitch_id: z.number(),
        youtube_id: z.null(),
        id: z.string(),
        is_group: z.boolean(),
        display_name: z.string(),
        set: z.number(),
    }),
    sets: z.record(z.string(), z.object({ id: z.number(), emoticons: z.array(z.object({ id: z.number(), name: z.string() })) })),
});

export const bbtvResSchema = z.object({
    id: z.string(),
    bots: z.array(z.string()),
    avatar: z.string(),
    channelEmotes: z.array(z.object({ id: z.string(), code: z.string(), imageType: z.string(), animated: z.boolean(), userId: z.string() })),
    sharedEmotes: z.array(z.object({ id: z.string(), code: z.string() })),
});

export const senventvResSchema = z.object({
    id: z.string(),
    platform: z.string(),
    username: z.string(),
    display_name: z.string(),
    linked_at: z.number(),
    emote_capacity: z.number(),
    emote_set_id: z.string(),
    emote_set: z.object({ id: z.string(), emotes: z.array(z.object({ id: z.string(), name: z.string() })) }),
});

export type Emote = { name: string; id: string; provider: EmoteProvider; data: any; sources?: string[] };

class EmoteFetcher {
    async fetch7TV(userId: string): Promise<Emote[]> {
        try {
            console.debug(`[EmoteFetcher] Fetching 7TV emotes for userId: ${userId}`);
            const res = await fetch(SEVENTV_URL(userId));
            if (!res.ok) {
                console.debug(`[EmoteFetcher] 7TV fetch failed for userId: ${userId}`);
                return [];
            }
            const data = await res.json();
            const parsed = senventvResSchema.safeParse(data);
            if (!parsed.success || !parsed.data.emote_set || !Array.isArray(parsed.data.emote_set.emotes)) {
                console.debug(`[EmoteFetcher] 7TV validation failed for userId: ${userId}`);
                return [];
            }
            console.debug(`[EmoteFetcher] 7TV fetch and validation succeeded for userId: ${userId}`);
            return parsed.data.emote_set.emotes.map(emote => ({ name: emote.name, id: emote.id, provider: EmoteProvider.SevenTV, data: emote }));
        } catch (error) {
            console.error(`[EmoteFetcher] Error fetching 7TV emotes for userId ${userId}:`, error);
            return [];
        }
    }

    async fetchFFZ(userId: string): Promise<Emote[]> {
        try {
            console.debug(`[EmoteFetcher] Fetching FFZ emotes for userId: ${userId}`);
            const res = await fetch(FFZ_URL(userId));
            if (!res.ok) {
                console.debug(`[EmoteFetcher] FFZ fetch failed for userId: ${userId}`);
                return [];
            }
            const data = await res.json();
            const parsed = ffzResSchema.safeParse(data);
            if (!parsed.success) {
                console.debug(`[EmoteFetcher] FFZ validation failed for userId: ${userId}`);
                return [];
            }
            console.debug(`[EmoteFetcher] FFZ fetch and validation succeeded for userId: ${userId}`);
            const sets = parsed.data.sets || {};
            let emotes: Emote[] = [];
            for (const setId in sets) {
                const set = sets[setId];
                if (set && Array.isArray(set.emoticons)) {
                    emotes = emotes.concat(set.emoticons.map(emote => ({ name: emote.name, id: emote.id.toString(), provider: EmoteProvider.FFZ, data: emote })));
                }
            }
            return emotes;
        } catch (error) {
            console.error(`[EmoteFetcher] Error fetching FFZ emotes for userId ${userId}:`, error);
            return [];
        }
    }

    async fetchBTTV(userId: string): Promise<Emote[]> {
        try {
            console.debug(`[EmoteFetcher] Fetching BTTV emotes for userId: ${userId}`);
            const res = await fetch(BBTV_URL(userId));
            if (!res.ok) {
                console.debug(`[EmoteFetcher] BTTV fetch failed for userId: ${userId}`);
                return [];
            }
            const data = await res.json();
            const parsed = bbtvResSchema.safeParse(data);
            if (!parsed.success) {
                console.debug(`[EmoteFetcher] BTTV validation failed for userId: ${userId}`);
                return [];
            }
            console.debug(`[EmoteFetcher] BTTV fetch and validation succeeded for userId: ${userId}`);
            const emotes: Emote[] = [];
            if (Array.isArray(parsed.data.channelEmotes)) {
                emotes.push(...parsed.data.channelEmotes.map(emote => ({ name: emote.code, id: emote.id, provider: EmoteProvider.BTTV, data: emote })));
            }
            if (Array.isArray(parsed.data.sharedEmotes)) {
                emotes.push(...parsed.data.sharedEmotes.map(emote => ({ name: emote.code, id: emote.id, provider: EmoteProvider.BTTV, data: emote })));
            }
            return emotes;
        } catch (error) {
            console.error(`[EmoteFetcher] Error fetching BTTV emotes for userId ${userId}:`, error);
            return [];
        }
    }

    async fetchAll(userId: string): Promise<Map<string, Emote>> {
        const [seventv, ffz, bttv] = await Promise.all([this.fetch7TV(userId), this.fetchFFZ(userId), this.fetchBTTV(userId)]);
        return this.mergeEmotes([seventv, ffz, bttv], userId);
    }

    mergeEmotes(emoteLists: Emote[][], userId: string): Map<string, Emote> {
        const merged: Record<string, Emote> = {};
        for (const list of emoteLists) {
            for (const emote of list) {
                if (!merged[emote.name]) {
                    merged[emote.name] = { ...emote, sources: [emote.provider] };
                } else {
                    merged[emote.name].sources!.push(emote.provider);
                }
            }
        }
        const map = new Map(Object.entries(merged));
        console.debug(`[EmoteFetcher] Merged emotes for userId ${userId}: ${map.size} unique emotes`);
        // for (const [name, emote] of map.entries()) {
        //     console.debug(`[EmoteFetcher] Emote: ${name}, ID: ${emote.id}, Providers: ${emote.sources?.join(", ")}`);
        // }
        if (map.size === 0) {
            console.debug(`[EmoteFetcher] No emotes found for userId: ${userId}`);
        }
        return map;
    }
}

export { EmoteFetcher };
