import { prisma } from "@/prisma";
import { getUserByUsername } from "@/twitch/api";
import { formatSize, formatWeight } from "@/utils/misc";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import z from "zod";
import { createBotCommand } from "../BotCommandWithKeywords";
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(calendar);

const fishRecordsInclude = Prisma.validator<Prisma.FishInclude>()({
    HeaviestRecord: true,
    LargestRecord: true,
    LightestRecord: true,
    SmallestRecord: true,
});

type FishWithRecords = Prisma.FishGetPayload<{ include: typeof fishRecordsInclude }>;

// Returns the user's single most valuable fish (highest value, most recent if tie)
async function getUserMostValuableFish(userId: string, channelProviderId: string) {
    const fish = await prisma.fish.findFirst({
        where: { userId, channelProviderId },
        orderBy: [{ value: "desc" }, { createdAt: "desc" }],
        include: fishRecordsInclude,
    });
    return fish;
}

function getRecords(fish: FishWithRecords): string {
    const records: string[] = [];
    if (fish.HeaviestRecord.length) records.push("Heaviest");
    if (fish.LargestRecord.length) records.push("Largest");
    if (fish.LightestRecord.length) records.push("Lightest");
    if (fish.SmallestRecord.length) records.push("Smallest");
    if (records.length === 0) return "";
    if (records.length === 1) return `🏆 ${records[0]} record holder,`;
    if (records.length === 2) return `🏆 ${records[0]} & ${records[1]} record holder,`;
    // For 3 or 4 records, Oxford comma style
    const last = records.pop();
    return `🏆 ${records.join(", ")} & ${last} record holder,`;
}

// Formats a fish object for display in chat
function formatFishDisplay(fish: FishWithRecords) {
    // Use formatWeight and formatSize from misc
    const weightStr = formatWeight(parseFloat(fish.weight));
    const sizeStr = formatSize(parseFloat(fish.size));
    const caughtAgo = dayjs(fish.createdAt).fromNow();
    const caughtDateUTC = dayjs.utc(fish.createdAt).calendar(null, {
        sameDay: "[Today at] hh:mm UTC", // The same day ( Today at 2:30 AM )
        nextDay: "[Tomorrow at] hh:mm UTC", // The next day ( Tomorrow at 2:30 AM )
        nextWeek: "dddd [at] hh:mm UTC", // The next week ( Sunday at 2:30 AM )
        lastDay: "[Yesterday at] hh:mm UTC", // The day before ( Yesterday at 2:30 AM )
        lastWeek: "[Last] dddd [at] hh:mm UTC", // Last week ( Last Monday at 2:30 AM )
        sameElse: "DD/MM/YYYY", // Everything else ( 17/10/2011 )
    });
    const records = getRecords(fish);
    return `[${fish.rarity}] ${fish.prefix} ${fish.name} #${fish.fishId} ${sizeStr} ${weightStr}, ${records} worth ${fish.value} silver - caught ${caughtAgo} (${caughtDateUTC})`;
}

export const flexFishCommand = createBotCommand(
    "flexfish",
    async (params, ctx) => {
        const { userId, userDisplayName, broadcasterId, say } = ctx;
        const [first] = params;

        let fish;
        let flexLabel = `${userDisplayName} most valuable fish`;;

        if (first) {
            // Check if it's a fish ID (starts with #)
            const idSchema = z.string().regex(/^#\d+$/, { message: "Must start with # followed by a number" });
            const idParsed = idSchema.safeParse(first);
            
            if (idParsed.success) {
                // It's a specific fish ID - look up from current user
                const fishId = first.replace("#", "");
                fish = await prisma.fish.findFirst({ where: { fishId, userId, channelProviderId: broadcasterId }, include: fishRecordsInclude });
                if (!fish) {
                    say(`${userDisplayName}, you don't own a fish with id ${fishId}.`);
                    return;
                }
                flexLabel = `${userDisplayName} fish #${fishId}`;
            } else {
                // It's a username - look up that player's most valuable fish
                const targetUser = await getUserByUsername(prisma, first);
                if (!targetUser) {
                    say(`${userDisplayName}, I couldn't find a player named "${first}" in this channel.`);
                    return;
                }
                fish = await getUserMostValuableFish(targetUser.id, broadcasterId);
                if (!fish) {
                    say(`${userDisplayName}, ${first} doesn't have any fish to flex! They need to go fishing first.`);
                    return;
                }
                flexLabel = `${targetUser.displayName} most valuable fish`;
            }
        } else {
            // Fetch the current user's most valuable fish
            fish = await getUserMostValuableFish(userId, broadcasterId);
            if (!fish) {
                say(`${userDisplayName}, you don't have any fish to flex! Go fishing first.`);
                return;
            }
        }
        say(`${flexLabel}: ${formatFishDisplay(fish)}.`);
    },
    { ignoreCase: true, aliases: ["fishflex", "ff"] },
);
