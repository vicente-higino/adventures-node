import { boxMullerTransform, formatSize, formatWeight, pickRandom, roundToDecimalPlaces, sendActionToAllChannel, sendActionToChannel, UnitSystem } from "@/utils/misc";
import { fishTable } from "./fishTable";
import { Rarity, CatchDetails, RARITY_WEIGHTS_DEFAULT, SELL_MULTIPLIERS, SIZE_PREFIXES, VALUE_EMOTES } from "./constants";
import cron from 'node-cron';
import { getBotConfig, isChannelLive } from "@/bot";

let rarityWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT;

export function setRarityWeights(weights: Record<Rarity, number>) {
    rarityWeights = { ...RARITY_WEIGHTS_DEFAULT, ...weights };
}

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
    const totalWeight = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
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
    for (const [rarity, weight] of Object.entries(rarityWeights)) {
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
type GetFishFunc = (args?: {
    rndFish?: () => CatchDetails;
    unitSystem?: UnitSystem;
}) => {
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
    const {
        rndFish = randomFish,
        unitSystem = "metric",
    } = args;

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

/**
 * Returns a new rarity weights object with modifications applied.
 * @param baseWeights The base weights to start from (default: RARITY_WEIGHTS)
 * @param changes An object with rarity keys and new weights or adjustment functions
 * @example
 *   modifyRarityWeights({ Legendary: w => w * 5 })
 *   modifyRarityWeights({ Legendary: 10, Common: 1 })
 */
export function modifyRarityWeights(
    changes: Partial<{ [K in Rarity]: number | ((current: number) => number) }>,
    baseWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT
): void {
    const newWeights: Record<Rarity, number> = { ...baseWeights };
    for (const key in changes) {
        if (changes[key as Rarity] !== undefined) {
            const current = baseWeights[key as Rarity];
            const change = changes[key as Rarity];
            newWeights[key as Rarity] =
                typeof change === "function" ? change(current) : change!;
        }
    }
    console.log(formatRarityWeightDisplay(newWeights));
    setRarityWeights(newWeights);
}

export function resetRarityWeights() {
    setRarityWeights(RARITY_WEIGHTS_DEFAULT);
}

function weightToChance(weight: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (weight / totalWeight) * 100; // Convert to percentage
}
function chanceToWeight(chance: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (chance / 100) * totalWeight; // Convert to weight
}
function getTotalWeight(weights: Record<Rarity, number> = rarityWeights): number {
    return Object.values(weights).reduce((total, weight) => total + weight, 0);
}
function getChanceByRarity(rarity: Rarity, weights: Record<Rarity, number> = rarityWeights): number {
    const totalWeight = getTotalWeight(weights);
    return weightToChance(weights[rarity], totalWeight);
}
function getRarityByChance(chance: number, weights: Record<Rarity, number> = rarityWeights): Rarity | null {
    const totalWeight = getTotalWeight(weights);
    const weight = chanceToWeight(chance, totalWeight);
    for (const [rarity, w] of Object.entries(weights)) {
        if (w >= weight) {
            return rarity as Rarity;
        }
    }
    return null; // No rarity found for the given chance

}
export function formatRarityWeightDisplay(weights: Record<Rarity, number> = rarityWeights): string {
    const totalWeight = getTotalWeight(weights);
    return Object.entries(weights)
        .map(([rarity, weight]) => `${rarity}: ${weightToChance(weight, totalWeight).toFixed(2)}%`)
        .join(", ");
}

export const legendaryEventTaskPerChannel = (channel: string) => cron.createTask('*/1 * * * *', (c) => {
    console.log(`[${c.dateLocalIso}] Running legendary event task for channel ${channel}`);
    const chance = 5 / (7 * 24 * 60);
    const shouldRun = chance > Math.random() && !isChannelLive(channel);
    if (shouldRun) {
        // Temporarily boost Legendary rarity
        const legendaryChanceBefore = getChanceByRarity("Legendary");
        modifyRarityWeights({ Legendary: Math.round(boxMullerTransform(25, 10, 20)) });
        const legendaryChanceAfter = getChanceByRarity("Legendary");
        const chanceStr = `${legendaryChanceBefore.toPrecision(2)}% -> ${legendaryChanceAfter.toPrecision(2)}%`
        sendActionToChannel(channel, `🌟 A Legendary Fishing Event has started! Legendary fish are much more likely for the next hour! ${chanceStr} 🎣`);
        c.task?.stop()
        setTimeout(() => {
            resetRarityWeights();
            sendActionToChannel(channel, "⏰ The Legendary Fishing Event has ended. Legendary fish odds are back to normal.");
            c.task?.start()
        }, 60 * 60 * 1000);
    }
});

export async function startLegendaryTasks() {
    const { channels } = getBotConfig();
    for (const channel of channels) {
        legendaryEventTaskPerChannel(channel).start()
    }
}