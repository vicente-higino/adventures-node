import { createBotCommand } from "../BotCommandWithKeywords";
import { emoteTracker, getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { z } from "zod";
const TOP_EMOTES_COUNT = 15;

const ChannelSchema = z.string().min(3, "Broadcaster name required").optional();
const DurationSchema = z.string().optional();
const SortSchema = z.enum(["asc", "desc"]).optional();
const ParamsSchema = z.tuple([DurationSchema, SortSchema, ChannelSchema]);

// Add a schema for the count parameter (optional, default to TOP_EMOTES_COUNT)
const CountSchema = z.coerce.number().optional();

const RankParamsSchema = z.tuple([CountSchema, DurationSchema, SortSchema, ChannelSchema]);

// Helper to parse duration strings like "24h", "1w", "30m", "7d"
function getStartDate(duration: string | undefined): Date {
    if (!duration) duration = "24h";
    const now = new Date();
    const match = duration.match(/^(\d+)?([mhdwy])$/i);
    if (!match) return new Date();
    let value = parseInt(match[1], 10);
    if (isNaN(value)) value = 1;
    const unit = match[2].toLowerCase();
    let ms = 0;
    switch (unit) {
        // case "s": ms = value * 1000; break;
        // case "m": ms = value * 60 * 1000; break;
        case "h":
            ms = value * 60 * 60 * 1000;
            break;
        case "d":
            ms = value * 24 * 60 * 60 * 1000;
            break;
        case "w":
            ms = value * 7 * 24 * 60 * 60 * 1000;
            break;
        case "m":
            ms = value * 30 * 24 * 60 * 60 * 1000;
            break;
        case "y":
            ms = value * 365 * 24 * 60 * 60 * 1000;
            break;
        default:
            ms = 0;
    }
    return new Date(now.getTime() - ms);
}

export const emoteRankCommand = createBotCommand(
    "emoterank",
    async (params, ctx) => {
        let { say, broadcasterName, broadcasterId, msg } = ctx;
        const { isBroadcaster, isMod } = msg.userInfo;
        if (!isBroadcaster && !isMod) return;
        // Params: [count, duration, sort, channel]
        let count: number = TOP_EMOTES_COUNT;
        let channel: string | undefined;
        let range: string | undefined;
        let sort: "asc" | "desc" | undefined;
        try {
            const parsed = RankParamsSchema.parse([params[0] ?? TOP_EMOTES_COUNT, params[1] ?? "24h", params[2] ?? "desc", params[3]]);
            if (parsed[0]) count = parsed[0];
            range = parsed[1];
            sort = parsed[2];
            channel = parsed[3];
        } catch (e) {
            say(`Usage: ${getBotConfig().prefix}emoterank [count] [duration] [asc|desc]`);
            return;
        }

        if (channel) {
            const user = await getUserByUsername(prisma, channel);
            broadcasterId = user?.id ?? broadcasterId;
        }

        const startDate = getStartDate(range);
        const channelEmotes = emoteTracker?.getChannelEmotes(channel ?? broadcasterName);
        const emotes = await prisma.emoteUsageEvent.groupBy({
            by: ["emoteName"],
            _count: { emoteName: true },
            where: { channelProviderId: broadcasterId, usedAt: { gte: startDate } },
            orderBy: { _count: { emoteName: sort } },
        });
        if (!emotes.length) {
            say("No emotes have been found for this range.");
            return;
        }
        let usage = emotes
            .map(e => ({ name: e.emoteName, count: e._count.emoteName }))
            .sort((a, b) => (sort === "asc" ? a.count - b.count : b.count - a.count));

        // Add missing emotes from channelEmotes (Map) with count 0
        if (channelEmotes && channelEmotes.size > 0) {
            const usedEmoteNames = new Set(usage.map(e => e.name));
            const missingEmotes = Array.from(channelEmotes.keys())
                .filter(e => !usedEmoteNames.has(e))
                .map(e => ({ name: e, count: 0 }));
            // Only add as many as needed to fill up to 'count'
            const remaining = count - usage.length;
            if (remaining > 0) {
                usage = usage.concat(missingEmotes.slice(0, remaining));
            }
        }

        // Sort again after adding missing emotes
        usage = usage
            .sort((a, b) => {
                if (a.count === b.count) {
                    return a.name.localeCompare(b.name);
                }
                return sort === "asc" ? a.count - b.count : b.count - a.count;
            })
            .slice(0, count);

        if (!usage.length) {
            say("No emotes have been used yet for this channel.");
            return;
        }
        const res = usage.map((e, i) => `${e.name} (${e.count})`).join(" ");
        say(`Top ${count} emotes${range ? ` ${range}` : ""} (${sort}):`);
        say(`${res}`);
    },
    { aliases: ["er"] },
);

export const emoteCountCommand = createBotCommand(
    "emotecount",
    async (params, ctx) => {
        let { say, broadcasterName, broadcasterId, msg } = ctx;
        const { isBroadcaster, isMod } = msg.userInfo;
        if (!isBroadcaster && !isMod) return;

        // Params: [duration, emoteName, channel]
        const EmoteParamsSchema = z.tuple([z.string().min(1, "Emote name required"), DurationSchema, ChannelSchema]);

        let range: string | undefined;
        let emoteName: string | undefined;
        let channel: string | undefined;
        try {
            [emoteName, range, channel] = EmoteParamsSchema.parse([params[0], params[1] ?? "24h", params[2]]);
        } catch (e) {
            say(`Usage: ${getBotConfig().prefix}emotecount <emote> [duration]`);
            return;
        }

        if (channel) {
            const user = await getUserByUsername(prisma, channel);
            broadcasterId = user?.id ?? broadcasterId;
        }

        const startDate = getStartDate(range);
        const result = await prisma.emoteUsageEvent.aggregate({
            _count: { emoteName: true },
            where: { channelProviderId: broadcasterId, emoteName: emoteName, usedAt: { gte: startDate } },
        });

        const count = result._count.emoteName;
        say(`Last ${range}: ${emoteName} (${count})`);
    },
    { aliases: ["ec"] },
);

export const myEmoteRankCommand = createBotCommand(
    "myemoterank",
    async (params, ctx) => {
        const { say, msg, broadcasterId, userDisplayName } = ctx;
        const { userId } = msg.userInfo;
        if (!userId) return;

        // Params: [duration, asc|desc]
        let range: string | undefined;
        let sort: "asc" | "desc" | undefined;
        try {
            [range, sort] = ParamsSchema.parse([params[0] ?? "24h", params[1] ?? "desc", undefined]);
        } catch (e) {
            say(`Usage: ${getBotConfig().prefix}myemoterank [duration] [asc|desc]`);
            return;
        }

        const startDate = getStartDate(range);
        const emotes = await prisma.emoteUsageEvent.groupBy({
            by: ["emoteName"],
            _count: { emoteName: true },
            where: { userId, channelProviderId: broadcasterId, usedAt: { gte: startDate } },
            orderBy: { _count: { emoteName: sort } },
        });
        if (!emotes.length) {
            say("You haven't used any emotes in this range.");
            return;
        }
        const usage = emotes
            .map(e => ({ name: e.emoteName, count: e._count.emoteName }))
            .filter(e => e.count > 0)
            .sort((a, b) => (sort === "asc" ? a.count - b.count : b.count - a.count))
            .slice(0, TOP_EMOTES_COUNT);
        if (!usage.length) {
            say("You haven't used any emotes yet.");
            return;
        }
        const res = usage.map((e, i) => `${e.name} (${e.count})`).join(" ");
        say(`@${userDisplayName} top ${TOP_EMOTES_COUNT} emotes${range ? ` ${range}` : ""} (${sort}):`);
        say(`${res}`);
    },
    { aliases: ["mer"] },
);

export const myEmoteCountCommand = createBotCommand(
    "myemotecount",
    async (params, ctx) => {
        const { say, msg, broadcasterId, userDisplayName } = ctx;
        const userId = msg.userInfo.userId;
        if (!userId) return;

        // Params: [emoteName, duration]
        const EmoteParamsSchema = z.tuple([z.string().min(1, "Emote name required"), DurationSchema]);
        let emoteName: string | undefined;
        let range: string | undefined;
        try {
            [emoteName, range] = EmoteParamsSchema.parse([params[0], params[1] ?? "24h"]);
        } catch (e) {
            say(`Usage: ${getBotConfig().prefix}myemotecount <emote> [duration]`);
            return;
        }

        const startDate = getStartDate(range);
        const result = await prisma.emoteUsageEvent.aggregate({
            _count: { emoteName: true },
            where: { userId, channelProviderId: broadcasterId, emoteName: emoteName, usedAt: { gte: startDate } },
        });
        const count = result._count.emoteName;
        say(`@${userDisplayName} Last ${range}: ${emoteName} (${count})`);
    },
    { aliases: ["mec"] },
);
