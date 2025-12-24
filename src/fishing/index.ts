import { boxMullerTransform, formatSize, formatWeight, pickRandom, roundToDecimalPlaces, sendActionToAllChannel, UnitSystem } from "@/utils/misc";
import { fishTable } from "./fishTable";
import { Rarity, CatchDetails, RARITY_WEIGHTS_DEFAULT, SELL_MULTIPLIERS, SIZE_PREFIXES, VALUE_EMOTES } from "./constants";
import cron from "node-cron";
import { getBotConfig } from "@/bot";
import { prisma } from "@/prisma";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatMinutes } from "@/utils/time";
import { EVENT_STARTED_EMOTES } from "@/emotes";
dayjs.extend(duration);
dayjs.extend(relativeTime);
let rarityWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT;

// Track if a Legendary event is currently active
let legendaryEventActive = false;
let legendaryEventTimeout: NodeJS.Timeout | null = null;
let legendaryEventRecordId: number | null = null;

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
    changes: Partial<Record<Rarity, number | ((current: number) => number)>>,
    baseWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT,
): void {
    const newWeights: Record<Rarity, number> = { ...baseWeights };
    for (const key in changes) {
        if (changes[key as Rarity] !== undefined) {
            const current = baseWeights[key as Rarity];
            const change = changes[key as Rarity];
            newWeights[key as Rarity] = typeof change === "function" ? change(current) : change!;
        }
    }
    console.log(formatRarityWeightDisplay(newWeights));
    setRarityWeights(newWeights);
}

export function resetRarityWeights() {
    setRarityWeights(RARITY_WEIGHTS_DEFAULT);
}

export function weightToChance(weight: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (weight / totalWeight) * 100; // Convert to percentage
}
function chanceToWeight(chance: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (chance / 100) * totalWeight; // Convert to weight
}
function getTotalWeight(weights: Record<Rarity, number> = rarityWeights): number {
    return Object.values(weights).reduce((total, weight) => total + weight, 0);
}
export function getChanceByRarity(rarity: Rarity, weights: Record<Rarity, number> = rarityWeights): number {
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
        .map(([rarity, weight]) => `${rarity}: ${roundToDecimalPlaces(weightToChance(weight, totalWeight), 2).toFixed(2)}%`)
        .join(", ");
}

function endLegendaryEvent(name: string) {
    // will be replaced at runtime with async updater if DB is available
    if (!legendaryEventActive) return;
    legendaryEventActive = false;
    resetRarityWeights();
    sendActionToAllChannel(`The ${name} has ended. Legendary fish odds are back to normal.`);
    if (legendaryEventTimeout) {
        clearTimeout(legendaryEventTimeout);
        legendaryEventTimeout = null;
    }
    // persist end to DB (fire-and-forget)
    if (legendaryEventRecordId) {
        prisma
            .legendaryEvent.update({ where: { id: legendaryEventRecordId }, data: { active: false } })
            .catch(err => console.error("Failed to mark legendary event ended in DB:", err));
        legendaryEventRecordId = null;
    }
}

export const legendaryEventTaskPerChannel = (channels: string[]) =>
    cron.createTask("*/1 * * * *", c => {
        if (legendaryEventActive) {
            console.log(`[${c.dateLocalIso}] Legendary event already active, skipping random event.`);
            return;
        }
        // console.log(`[${c.dateLocalIso}] Running legendary event task for channels: ${channels.join(", ")}`);
        const chance = 5 / (7 * 24 * 60);
        const shouldRun = chance > Math.random();
        if (shouldRun) {
            const legendaryWeight = Math.round(boxMullerTransform(25, 10, 20));
            manualLegendaryEventTask(legendaryWeight, 90 * 60 * 1000);
        }
    });

/**
 * Manually starts a Legendary Fishing Event for the given channels.
 * @param legendaryWeight Legendary rarity weight to set during the event
 * @param durationMs Duration of the event in milliseconds
 */
export function manualLegendaryEventTask(
    legendaryWeight: number,
    durationMs: number,
    name: string = "Legendary Fishing Event",
    msg: string = "Legendary fish are much more likely for the next",
): boolean {
    if (legendaryEventActive) {
        return false;
    }
    legendaryEventActive = true;
    const legendaryChanceBefore = getChanceByRarity("Legendary");
    modifyRarityWeights({ Legendary: legendaryWeight, Common: w => w - legendaryWeight + 1 });
    const legendaryChanceAfter = getChanceByRarity("Legendary");
    const chanceStr = `${roundToDecimalPlaces(legendaryChanceBefore, 2).toFixed(2)}% -> ${roundToDecimalPlaces(legendaryChanceAfter, 2).toFixed(2)}%`;
    sendActionToAllChannel(`A ${name} has started! ${msg} ${formatMinutes(durationMs)}! ${chanceStr} ${pickRandom(EVENT_STARTED_EMOTES)}`);

    // persist event to DB
    prisma
        .legendaryEvent
        .create({ data: { name, legendaryWeight, message: msg, startedAt: new Date(), endsAt: new Date(Date.now() + durationMs) } })
        .then(rec => {
            legendaryEventRecordId = rec.id;
        })
        .catch(err => console.error("Failed to persist legendary event:", err));

    legendaryEventTimeout = setTimeout(() => {
        endLegendaryEvent(name);
    }, durationMs);
    return true;
}

export function startLegendaryTasks(): void {
    const { channels } = getBotConfig();
    // resume active event from DB if present
    prisma
        .legendaryEvent
        .findFirst({ where: { active: true }, orderBy: { startedAt: "desc" } })
        .then(active => {
            if (active) {
                legendaryEventActive = true;
                legendaryEventRecordId = active.id;
                // apply weights
                modifyRarityWeights({ Legendary: active.legendaryWeight, Common: w => w - active.legendaryWeight + 1 });
                const remaining = new Date(active.endsAt).getTime() - Date.now();
                if (remaining > 0) {
                    legendaryEventTimeout = setTimeout(() => endLegendaryEvent(active.name), remaining);
                    // sendActionToAllChannel(`Resuming ${active.name}! Legendary fish are still more likely for the next ${formatMinutes(remaining)}.`);
                } else {
                    // event expired but still marked active in DB; end it
                    endLegendaryEvent(active.name);
                }
            }
        })
        .catch(err => console.error("Failed to load active legendary event:", err));

    legendaryEventTaskPerChannel(channels).start();
    cron.schedule(
        "0 0 25 12 *",
        () => {
            manualLegendaryEventTask(
                100,
                24 * 60 * 60 * 1000,
                "Legendary Christmas Event",
                "Holiday magic is in the water, and legendary fish are much more likely for the next",
            );
        },
        { timezone: "UTC" },
    );
}

// Admin helpers
export async function listLegendaryEvents(activeOnly = true) {
    const where = activeOnly ? { active: true } : {};
    return prisma.legendaryEvent.findMany({ where, orderBy: { startedAt: "desc" } });
}

export async function endLegendaryEventById(id: number): Promise<boolean> {
    try {
        const ev = await prisma.legendaryEvent.findUnique({ where: { id } });
        if (!ev || !ev.active) return false;
        // If this is the currently-running event in memory, end it properly
        if (legendaryEventRecordId === id) {
            endLegendaryEvent(ev.name);
        } else {
            // Mark inactive and announce
            await prisma.legendaryEvent.update({ where: { id }, data: { active: false } });
            sendActionToAllChannel(`The ${ev.name} has been force-ended by an admin.`);
        }
        return true;
    } catch (err) {
        console.error("Failed to end legendary event by id:", err);
        return false;
    }
}

