import { createBotCommand } from "../BotCommandWithKeywords";
import { prisma } from "@/prisma";
import { formatSize, formatWeight } from "@/utils/misc";
import { z } from "zod";
import { getBotConfig } from "..";
import { Fish, Prisma } from "@prisma/client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const RARITY_ORDER = ["Legendary", "Epic", "Rare", "Fine", "Uncommon", "Common", "Trash"];

// Helper to sort by rarity and then value
function sortFishByRarityAndValue(fishList: Fish[], fromSlice = 0, slice = 0) {
    const sorted = fishList.sort((a, b) => {
        const rarityDiff = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return b.value - a.value;
    });
    if (slice > 0) {
        return sorted.slice(fromSlice, fromSlice + slice);
    }
    return sorted;
}

function formatFishSummary(fish: Fish) {
    const weightStr = formatWeight(parseFloat(fish.weight));
    const sizeStr = formatSize(parseFloat(fish.size));
    const howLongAgo = dayjs(fish.createdAt).fromNow();
    return `[${fish.rarity}] ${fish.prefix} ${fish.name} #${fish.id} (${weightStr}, ${sizeStr}) ${fish.value} silver - ${howLongAgo}`;
}

const tryParsePage = (val: string | undefined) => {
    const parsed = z.coerce.number().safeParse(val);
    return parsed.success ? parsed.data : undefined;
};

const isSortParam = (val: string | undefined) => {
    if (!val) return false;
    const v = val.toLowerCase();
    return v === "rarity" || v === "value" || v === "date";
};
export const fishGalleryCommand = createBotCommand(
    "fishgallery",
    async (params, ctx) => {
        const { userId, userDisplayName, broadcasterId, say } = ctx;
        const N = 2; // Items per page
        let page = 1;
        let sortParam = "date";

        // Accept negative numbers for page, and allow sort param in any position
        const [a, b] = params;

        // Find which param is page and which is sort, regardless of order
        const pageCandidateA = tryParsePage(a);
        const pageCandidateB = tryParsePage(b);
        const sortCandidateA = isSortParam(a) ? a.toLowerCase() : undefined;
        const sortCandidateB = isSortParam(b) ? b.toLowerCase() : undefined;

        if (sortCandidateA && pageCandidateB !== undefined) {
            sortParam = sortCandidateA;
            page = pageCandidateB;
        } else if (sortCandidateB && pageCandidateA !== undefined) {
            sortParam = sortCandidateB;
            page = pageCandidateA;
        } else {
            sortParam = sortCandidateA || sortCandidateB || sortParam;
            page = pageCandidateA !== undefined ? pageCandidateA : page;
        }

        // Validate page
        if (isNaN(page) || typeof page !== "number") {
            say(`@${userDisplayName}, invalid page number. Usage: ${getBotConfig().prefix}fishgallery [page (int)] [sort (rarity|value|date)]`);
            return;
        }

        // Get total count for pagination info
        const totalCount = await prisma.fish.count({ where: { userId, channelProviderId: broadcasterId } });
        const totalPages = Math.max(1, Math.ceil(totalCount / N));

        if (page === 0) page = 1; // treat 0 as 1
        if (page < 0) {
            page = Math.min(Math.abs(totalPages + page) + 1, totalPages);
        } else {
            page = Math.min(page, totalPages);
        }

        if (page > totalPages || page < 1) {
            say(
                `@${userDisplayName}, page ${page} does not exist. There ${totalPages === 1 ? "is" : "are"} only ${totalPages} page${totalPages === 1 ? "" : "s"} in your gallery.`,
            );
            return;
        }
        let skip = (page - 1) * N;
        let take = N;
        // Determine sorting
        let orderBy: Prisma.FishOrderByWithRelationInput = { createdAt: "asc" };
        let postSort: ((fishList: Fish[], sliceFrom: number, slice: number) => Fish[]) | null = null;
        switch (sortParam) {
            case "rarity":
                orderBy = { createdAt: "asc" };
                skip = 0; // Rarity sorting should not skip any items
                take = totalCount; // Get all items to sort by rarity
                postSort = sortFishByRarityAndValue;
                break;
            case "value":
                orderBy = { value: "desc" };
                break;
            case "date":
            default:
                orderBy = { createdAt: "asc" };
                break;
        }

        const fishListRaw = await prisma.fish.findMany({ where: { userId, channelProviderId: broadcasterId }, take, skip, orderBy });

        let fishList = fishListRaw;
        if (postSort) {
            fishList = postSort([...fishListRaw], (page - 1) * N, N);
        }

        if (!fishList || fishList.length === 0) {
            say(`${userDisplayName}, you don't have any fish in your gallery! Go fishing first.`);
            return;
        }

        const summary = fishList.map(formatFishSummary).join(" | ");

        say(`@${userDisplayName} Fish Gallery [${page}/${totalPages}]: ${summary}`);
    },
    { ignoreCase: true },
);
