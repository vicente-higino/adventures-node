import { boxMullerTransform, formatSize, formatWeight, pickRandom, roundToDecimalPlaces, UnitSystem } from "@/utils/misc";
import {
    CatchDetails,
    FishingRodLevel,
    fishingRodLevels,
    Quality,
    QUALITY_ARRAY,
    QUALITY_MULTIPLIERS,
    Rarity,
    RARITY_POINTS,
    SELL_MULTIPLIERS,
    SIZE_PREFIXES,
    VALUE_EMOTES,
} from "./constants";
import { fishTable } from "./fishTable";
import { getRarityWeights } from "./rarities";
import { EmoteManager } from "@/emotes";

export {
    endLegendaryEventById,
    legendaryEventTaskPerChannel,
    listLegendaryEvents,
    manualLegendaryEventTask,
    startLegendaryTasks,
} from "./legendaryEvents";

// Example usage in getSize function:
type GetFishFunc = (args?: { getRandomFish?: () => CatchDetails; unitSystem?: UnitSystem; channel?: string; rodLevel?: number }) => {
    name: string;
    rarity: Rarity;
    rarityEmote: string;
    size: number;
    formatedSize: string;
    prefix: string;
    multiplier: number;
    weight: number;
    formatedWeight: string;
    sellMultiplier: number;
    sellValue: number;
    emote: string;
    quality: Quality;
    xp: number;
    formatedQuality: string;
};

export const getFish: GetFishFunc = (args = {}) => {
    const { getRandomFish = randomFish, unitSystem = "metric", channel, rodLevel = 0 } = args;

    const fish = getRandomFish(rodLevel);
    const { rarity, size, weight, sellValue, emote } = fish;

    // Size calculation
    const sizeMean = size * 1.25;
    const sizeStdDev = size * 0.55;
    const sizeMin = size * 0.005; // 0.5% of the size
    const actualSize = rarity !== "Trash" ? roundToDecimalPlaces(boxMullerTransform(sizeMean, sizeStdDev, sizeMin)) : size;
    const multiplier = roundToDecimalPlaces(actualSize / size);

    // Weight calculation with random variation
    const weightMean = weight * multiplier * multiplier;
    const weightStdDev = weightMean * 0.35; // 35% standard deviation for weight
    const weightMin = weight * 0.005; // 0.5% of the weight
    const actualWeight = rarity !== "Trash" ? roundToDecimalPlaces(boxMullerTransform(weightMean, weightStdDev, weightMin), 6) : weight;

    const prefix = getSizePrefix(multiplier);
    const sellMultiplier = getSellMultiplier(multiplier);
    const actualSellValue = rarity !== "Trash" ? roundToDecimalPlaces(sellValue * sellMultiplier, 0) : 1;

    const quality = rarity !== "Trash" ? getQuality(rodLevel) : "Normal";
    const qualityMultiplier = getQualityMultiplier(quality);
    return {
        name: fish.name,
        rarity: fish.rarity,
        rarityEmote: getValueEmote(actualSellValue, channel),
        size: actualSize,
        formatedSize: formatSize(actualSize, unitSystem),
        prefix: prefix,
        quality: quality,
        formatedQuality: getQualityStars(quality),
        xp: getFishExperience(rarity, quality),
        multiplier: multiplier,
        weight: actualWeight,
        formatedWeight: formatWeight(actualWeight, unitSystem),
        sellMultiplier: sellMultiplier,
        sellValue: roundToDecimalPlaces(actualSellValue * qualityMultiplier, 0),
        emote: emote ? emote(channel) : "",
    };
};

export function randomFish(rodLevel?: number): CatchDetails {
    // Use centralized rarity weights
    const weights = getRarityWeights(rodLevel);
    // Calculate total weight
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    // Group fish by rarity
    const fishByRarity = fishTable.reduce(
        (acc, fish) => {
            if (!acc[fish.rarity]) acc[fish.rarity] = [];
            acc[fish.rarity].push(fish);
            return acc;
        },
        {} as Record<Rarity, CatchDetails[]>,
    );

    // Select rarity first
    for (const [rarity, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            // Then randomly select a fish of that rarity
            const fishesOfRarity = fishByRarity[rarity as Rarity];
            return pickRandom(fishesOfRarity);
        }
    }

    // Fallback to a random common fish
    const commonFish = fishByRarity.Common;
    return pickRandom(commonFish);
}

export function getSizePrefix(multiplier: number): string {
    // Find the appropriate prefix based on maximum thresholds
    for (const size of SIZE_PREFIXES) {
        if (multiplier < size.threshold) {
            return size.name;
        }
    }

    return "Colossal"; // Fallback for anything above highest threshold
}

export function getSellMultiplier(sizeMultiplier: number): number {
    for (const size of SELL_MULTIPLIERS) {
        if (sizeMultiplier <= size.threshold) {
            return size.multiplier;
        }
    }

    return SELL_MULTIPLIERS[SELL_MULTIPLIERS.length - 1].multiplier; // Fallback to highest multiplier
}

export function getValueEmote(sellValue: number, channel?: string): string {
    for (const { threshold, emote } of VALUE_EMOTES) {
        if (sellValue < threshold) {
            return EmoteManager.getEmote(emote, channel);
        }
    }
    return EmoteManager.getEmote(VALUE_EMOTES[VALUE_EMOTES.length - 1].emote, channel); // Fallback to highest tier emote
}

export function getQuality(rodLevel: number): Quality {
    const rod = getRod(rodLevel);
    let q = 0;
    for (const quality of rod.qualityChance) {
        let random = Math.random();
        if (random < quality) {
            q += 1;
            continue;
        }
    }
    return QUALITY_ARRAY[q - 1] || "Normal";
}

export function getQualityMultiplier(quality: Quality): number {
    return QUALITY_MULTIPLIERS[quality];
}

export function getQualityStars(quality: Quality): string {
    switch (quality) {
        case "Normal":
            return "";
        case "Shining":
            return "★";
        case "Glistening":
            return "★★";
        case "Opulent":
            return "★★★";
        case "Radiant":
            return "★★★★";
        case "Alpha":
            return "★★★★★";
        default:
            return "";
    }
}

export function getQualityRecordBonus(rarity: Rarity): number {
    switch (rarity) {
        case "Common":
        case "Uncommon":
        case "Fine":
            return 100;
        case "Rare":
        case "Epic":
        case "Exotic":
            return 200;
        case "Mythic":
        case "Legendary":
            return 300;
        case "Trash":
            return 0;
        default:
            return 0;

    }
}

export function getRod(rodLevel: number): FishingRodLevel {
    rodLevel = Math.min(Math.max(0, rodLevel), fishingRodLevels.length - 1); // Ensure rodLevel is within valid bounds
    return fishingRodLevels[rodLevel];
}

export function getFishExperience(rarity: Rarity, quality: Quality): number {
    const baseXp = RARITY_POINTS[rarity];
    const qualityMult = getQualityMultiplier(quality);
    return Math.round(Math.sqrt(baseXp * qualityMult));
}
