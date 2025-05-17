import { boxMullerTransform, formatSize, formatWeight, pickRandom, roundToDecimalPlaces, UnitSystem } from "utils/misc";
import { fishTable } from "./fishTable";
import { Rarity, CatchDetails, RARITY_WEIGHTS, SELL_MULTIPLIERS, SIZE_PREFIXES, VALUE_EMOTES } from "./constants";

export function getValueEmote(sellValue: number): string {
    for (const { threshold, emote } of VALUE_EMOTES) {
        if (sellValue < threshold) {
            return emote;
        }
    }
    return VALUE_EMOTES[VALUE_EMOTES.length - 1].emote; // Fallback to highest tier emote
}

export function randomFish(): CatchDetails {
    // Calculate total weight
    const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
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
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
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
    for (let i = 0; i < SIZE_PREFIXES.length; i++) {
        if (multiplier < SIZE_PREFIXES[i].threshold) {
            return SIZE_PREFIXES[i].name;
        }
    }

    return "Colossal"; // Fallback for anything above highest threshold
}

export function getSellMultiplier(sizeMultiplier: number): number {
    for (let i = 0; i < SELL_MULTIPLIERS.length; i++) {
        if (sizeMultiplier <= SELL_MULTIPLIERS[i].threshold) {
            return SELL_MULTIPLIERS[i].multiplier;
        }
    }

    return SELL_MULTIPLIERS[SELL_MULTIPLIERS.length - 1].multiplier; // Fallback to highest multiplier
}

// Example usage in getSize function:
type GetFishFunc = (args?: { rndFish?: () => CatchDetails; unitSystem?: UnitSystem }) => {
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
};

export const getFish: GetFishFunc = (args = {}) => {
    const { rndFish = randomFish, unitSystem = "metric" } = args;

    const fish = rndFish();
    const { name, rarity, size, weight, sellValue, emote } = fish;

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

    return {
        name: fish.name,
        rarity: fish.rarity,
        rarityEmote: getValueEmote(actualSellValue),
        size: actualSize,
        formatedSize: formatSize(actualSize, unitSystem),
        prefix: prefix,
        multiplier: multiplier,
        weight: actualWeight,
        formatedWeight: formatWeight(actualWeight, unitSystem),
        sellMultiplier: sellMultiplier,
        sellValue: actualSellValue,
        emote: emote ? emote() : "",
    };
};
