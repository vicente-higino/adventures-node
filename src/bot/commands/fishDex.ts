import { createBotCommand } from "../BotCommandWithKeywords";
import { prisma } from "@/prisma";
import { fishTable } from "@/fishing/fishTable";
import { z } from "zod";
import { getUserByUsername } from "@/twitch/api";

const RARITY_ORDER = ["Legendary", "Epic", "Rare", "Fine", "Uncommon", "Common", "Trash"];

// Returns a mapping: rarity -> Set of all fish names in the game for that rarity (from fishTable)
function getAllFishNamesByRarityFromTable() {
    const map = new Map<string, Set<string>>();
    for (const rarity of RARITY_ORDER) {
        map.set(rarity, new Set());
    }
    for (const fish of fishTable) {
        map.get(fish.rarity)?.add(fish.name);
    }
    return map;
}

// Returns a mapping: rarity -> Set of unique fish names the user has caught (using FishDex)
async function getUserFishNamesByRarity(userId: string, channelProviderId: string) {
    // Fetch all FishDex entries for this user and channel, including rarity
    const userFishDex = await prisma.fishDex.findMany({ where: { userId, channelProviderId }, select: { fishName: true, rarity: true } });

    const map = new Map<string, Set<string>>();
    for (const rarity of RARITY_ORDER) {
        map.set(rarity, new Set());
    }
    for (const entry of userFishDex) {
        if (entry.rarity && map.has(entry.rarity)) {
            map.get(entry.rarity)?.add(entry.fishName);
        }
    }
    return map;
}

// Returns a mapping: rarity -> Set of unique fish names caught by any user in the channel
async function getChannelFishNamesByRarity(channelProviderId: string) {
    const channelFish = await prisma.fish.findMany({
        where: { channelProviderId },
        select: { name: true, rarity: true },
        distinct: ["name", "rarity"],
    });
    const map = new Map<string, Set<string>>();
    for (const rarity of RARITY_ORDER) {
        map.set(rarity, new Set());
    }
    for (const fish of channelFish) {
        map.get(fish.rarity)?.add(fish.name);
    }
    return map;
}

export const fishDexCommand = createBotCommand(
    "fishdex",
    async (params, ctx) => {
        const { userId, userDisplayName, broadcasterId, say } = ctx;

        // Zod: allow optional username as first param, must be at least 3 chars if present
        const schema = z.array(z.string().min(3)).max(1);
        let targetUserId = userId;
        let targetDisplayName = userDisplayName;

        if (params.length > 0 && schema.safeParse(params).success) {
            const username = params[0].replace(/^@/, "").toLowerCase();
            const user = await getUserByUsername(prisma, username);
            if (!user) {
                say(`@${userDisplayName}, User "${params[0]}" not found.`);
                return;
            }
            targetUserId = user.id;
            targetDisplayName = user.displayName;
        }

        // Get all unique fish names by rarity (from fishTable)
        const allFishMap = getAllFishNamesByRarityFromTable();
        // Get user's unique fish names by rarity
        const userFishMap = await getUserFishNamesByRarity(targetUserId, broadcasterId);

        // Compose summary
        const summary = RARITY_ORDER.map(rarity => {
            const total = allFishMap.get(rarity)?.size ?? 0;
            const caught = userFishMap.get(rarity)?.size ?? 0;
            return `${rarity}: ${caught}/${total}`;
        }).join(" | ");

        say(`@${targetDisplayName} FishDex: ${summary}`);
    },
    { ignoreCase: true },
);

export const fishDexGlobalCommand = createBotCommand(
    "fishdexglobal",
    async (params, ctx) => {
        const { broadcasterId, say } = ctx;

        // Get all unique fish names by rarity (from fishTable)
        const allFishMap = getAllFishNamesByRarityFromTable();
        // Get channel's unique fish names by rarity
        const channelFishMap = await getChannelFishNamesByRarity(broadcasterId);

        // Compose summary
        const summary = RARITY_ORDER.map(rarity => {
            const total = allFishMap.get(rarity)?.size ?? 0;
            const caught = channelFishMap.get(rarity)?.size ?? 0;
            return `${rarity}: ${caught}/${total}`;
        }).join(" | ");

        say(`Global FishDex: ${summary}`);
    },
    { ignoreCase: true },
);
