import { createBotCommand } from "../BotCommandWithKeywords";
import { emoteTracker, getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { z } from "zod";
const TOP_EMOTES_COUNT = 10;

const ChannelSchema = z.string().min(3, "Broadcaster name required").optional();
const DurationSchema = z.string().optional();
const SortSchema = z.enum(["asc", "desc"]).optional();
const ParamsSchema = z.tuple([DurationSchema, SortSchema, ChannelSchema]);

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
        // Ensure params is always a tuple of length 3
        let channel: string | undefined;
        let range: string | undefined;
        let sort: "asc" | "desc" | undefined;
        try {
            [range, sort, channel] = ParamsSchema.parse([params[0] ?? "24h", params[1] ?? "desc", params[2]]);
        } catch (e) {
            say(`Usage: ${getBotConfig().prefix}emoterank [duration] [asc|desc]`);
            return;
        }

        if (channel) {
            const user = await getUserByUsername(prisma, channel);
            broadcasterId = user?.id ?? broadcasterId;
        }

        const startDate = getStartDate(range);
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
        const usage = emotes
            .map(e => ({ name: e.emoteName, count: e._count.emoteName }))
            .filter(e => e.count > 0)
            .sort((a, b) => (sort === "asc" ? a.count - b.count : b.count - a.count))
            .slice(0, TOP_EMOTES_COUNT);
        if (!usage.length) {
            say("No emotes have been used yet for this channel.");
            return;
        }
        const res = usage.map((e, i) => `${e.name} (${e.count})`).join(" ");
        say(`Top ${TOP_EMOTES_COUNT} emotes${range ? ` ${range}` : ""} (${sort}):`);
        say(`${res}`);
    },
    { aliases: ["er"], offlineOnly: false },
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
        if (!result._count.emoteName) {
            say(`${emoteName} has not been used in this range.`);
            return;
        }
        const count = result._count.emoteName;
        say(`${emoteName} was used ${count} time${count === 1 ? "" : "s"}${range ? ` in the last ${range}` : ""}.`);
    },
    { aliases: ["ec"], offlineOnly: false },
);
