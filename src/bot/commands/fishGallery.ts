import { createBotCommand } from '../BotCommandWithKeywords';
import { prisma } from "@/prisma"
import { formatSize, formatWeight } from "@/utils/misc";
import { z } from 'zod';
import { getBotConfig } from '..';
import { Fish } from '@prisma/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const RARITY_ORDER = [
    "Legendary",
    "Epic",
    "Rare",
    "Fine",
    "Uncommon",
    "Common",
    "Trash"
];

// Helper to sort by rarity and then value
function sortFishByRarityAndValue(fishList: Fish[]) {
    return fishList.sort((a, b) => {
        const rarityDiff = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return b.value - a.value;
    });
}

function formatFishSummary(fish: Fish) {
    const weightStr = formatWeight(parseFloat(fish.weight));
    const sizeStr = formatSize(parseFloat(fish.size));
    const howLongAgo = dayjs(fish.createdAt).fromNow();
    return `[${fish.rarity}] ${fish.prefix} ${fish.name} #${fish.id} (${weightStr}, ${sizeStr}) ${fish.value} silver - ${howLongAgo}`;
}

export const fishGalleryCommand = createBotCommand('fishgallery', async (params, ctx) => {
    const { userId, userDisplayName, broadcasterId, say } = ctx;
    const N = 2; // Items per page
    const [first] = params;

    // Accept negative numbers for page
    let pageParsed = z.coerce.number().default(1).safeParse(first);
    let page = 1;
    if (!pageParsed.success) {
        say(`@${userDisplayName}, invalid page number. Usage: ${getBotConfig().prefix}fishgallery [page (int)]`);
        return;
    }
    // Get total count for pagination info
    const totalCount = await prisma.fish.count({ where: { userId, channelProviderId: broadcasterId } });
    const totalPages = Math.max(1, Math.ceil(totalCount / N));

    let inputPage = pageParsed.data;
    if (inputPage === 0) inputPage = 1; // treat 0 as 1
    if (inputPage < 0) {
        page = Math.min(Math.abs(totalPages + inputPage) + 1, totalPages);

    } else {
        page = Math.min(inputPage, totalPages);;
    }

    if (page > totalPages || page < 1) {
        say(`@${userDisplayName}, page ${page} does not exist. There ${totalPages === 1 ? "is" : "are"} only ${totalPages} page${totalPages === 1 ? "" : "s"} in your gallery.`);
        return;
    }
    const skip = (page - 1) * N;
    const fishList = await prisma.fish.findMany({
        where: { userId, channelProviderId: broadcasterId },
        take: N,
        skip,
        orderBy: [
            { createdAt: 'asc' }
        ],
    });

    if (!fishList || fishList.length === 0) {
        say(`${userDisplayName}, you don't have any fish in your gallery! Go fishing first.`);
        return;
    }

    // const sorted = sortFishByRarityAndValue(fishList);
    const summary = fishList.map(formatFishSummary).join(" | ");


    say(`@${userDisplayName} Fish Gallery [${page}/${totalPages}]: ${summary}`);
}, { ignoreCase: true });
