import { VALUE_EMOTES_LIST } from "@/emotes";
import { EmoteName } from "@/emotes/emotesData";
import type { FishQuality as Quality, Rarity } from "@prisma/client";

export { Quality, Rarity };

// Define points per rarity tier
export const RARITY_POINTS: Record<Rarity, number> = {
    Legendary: 5000,
    Mythic: 1000,
    Exotic: 500,
    Epic: 250,
    Rare: 100,
    Fine: 75,
    Uncommon: 50,
    Common: 25,
    Trash: 1,
} as const;

export const QUALITY_MULTIPLIERS: Record<Quality, number> = {
    Normal: 1.0,
    Shining: 1.8,
    Glistening: 4,
    Opulent: 6,
    Radiant: 10,
    Alpha: 15,
} as const;

export const QUALITY_ARRAY: Quality[] = ["Normal", "Shining", "Glistening", "Opulent", "Radiant", "Alpha"];

export interface CatchDetails {
    sellValue: number;
    name: string;
    rarity: Rarity;
    size: number; // in centimeters
    weight: number; // in kilograms
    emote?: (channel?: string) => string;
}
export const VALUE_EMOTES: { threshold: number; emote: EmoteName }[] = [
    { threshold: 10, emote: VALUE_EMOTES_LIST.WAJAJA.name }, //  < 10
    { threshold: 50, emote: VALUE_EMOTES_LIST.pogg.name }, //  < 50
    { threshold: 100, emote: VALUE_EMOTES_LIST.poggSpin.name }, //  < 100
    { threshold: 140, emote: VALUE_EMOTES_LIST.YIPPIE.name }, //  < 140
    { threshold: 300, emote: VALUE_EMOTES_LIST.POGGIES.name }, //  < 300
    { threshold: 600, emote: VALUE_EMOTES_LIST.POGGERS.name }, //  < 600
    { threshold: 800, emote: VALUE_EMOTES_LIST.Pog.name }, //  < 800
    { threshold: 1000, emote: VALUE_EMOTES_LIST.HOLY.name }, //  < 1000
    { threshold: 5000, emote: VALUE_EMOTES_LIST.Cereal.name }, //  < 2500
    { threshold: 15000, emote: VALUE_EMOTES_LIST.MUGA.name }, //  < 5000
    { threshold: Infinity, emote: VALUE_EMOTES_LIST.OOOO.name }, // >= 5000
];
type PercentageMap = Record<Rarity, number>;
type WeightMap = Record<Rarity, number>;
export function createRarityWeightsWithPercentage(
    percentages: PercentageMap,
    precision = 1000 // 1000 = 0.1% resolution
): WeightMap {
    const entries = Object.entries(percentages) as [Rarity, number][];
    const totalPercent = entries.reduce((sum, [, p]) => sum + p, 0);
    if (Math.abs(totalPercent - 100) > 1e-6) {
        throw new Error(`Percentages must sum to 100, got ${totalPercent}`);
    }
    const weights: Partial<WeightMap> = {};
    let total = 0;

    // Convert % → weights
    for (const [rarity, percent] of entries) {
        const weight = Math.round((percent / 100) * precision);
        weights[rarity] = weight;
        total += weight;
    }

    // Fix rounding drift so sum === precision
    const diff = precision - total;
    if (diff !== 0) {
        // adjust the largest bucket (usually Common)
        const largest = entries.reduce((a, b) =>
            percentages[a[0]] > percentages[b[0]] ? a : b
        )[0];

        weights[largest]! += diff;
    }

    return weights as WeightMap;
}
// Define rarity weights
export const RARITY_WEIGHTS_DEFAULT = createRarityWeightsWithPercentage({
    Legendary: 0.1, // 0.1% chance each
    Mythic: 0, //need upgraded rods to get these, so 0% chance with default rod
    Exotic: 0,
    Trash: 1.5, // 1.5%
    Epic: 3.5, // 3.5% chance
    Rare: 5.5, // 5.5% chance
    Fine: 9.5, // 9.5% chance
    Uncommon: 15, // 15% chance
    Common: 64.9, // 64.9% chance
});

export type RarityWeights = Record<Rarity, number>;

// Size prefix ranges and their thresholds (maximum values)
export const SIZE_PREFIXES: { name: string; threshold: number }[] = [
    { name: "Minuscule", threshold: 0.1 },
    { name: "Microscopic", threshold: 0.2 },
    { name: "Tiny", threshold: 0.5 },
    { name: "Small", threshold: 1.0 },
    { name: "", threshold: 1.5 },
    { name: "Large", threshold: 1.75 },
    { name: "Huge", threshold: 2.25 },
    { name: "Massive", threshold: 2.75 },
    { name: "Gigantic", threshold: 3.25 },
    { name: "Colossal", threshold: Infinity },
];

export const SELL_MULTIPLIERS: { threshold: number; multiplier: number }[] = [
    { threshold: 0.1, multiplier: 1.0 }, // < 0.1
    { threshold: 0.25, multiplier: 1.75 }, // 0.1 - 0.25
    { threshold: 0.5, multiplier: 0.6 }, // 0.25 - 0.5
    { threshold: 1.0, multiplier: 0.8 }, // 0.5 - 1.0
    { threshold: 1.5, multiplier: 1.0 }, // 1.0 - 1.5
    { threshold: 2.0, multiplier: 1.5 }, // 1.5 - 2.0
    { threshold: 3.0, multiplier: 2.5 }, // 2.0 - 3.0
    { threshold: Infinity, multiplier: 4.25 }, // > 3.0
];
type WeightModifier = (weight: number) => number;
type WeightModifiers = Partial<Record<Rarity, WeightModifier>>;
type PercentageDeltas = Partial<Record<Rarity, number>>;
export type FishingRodLevel = {
    level: number;
    name: string;
    qualityChance: number[]; // Cumulative chances for each quality tier, starting from Normal. Length determines number of quality tiers available.
    weightModifier: WeightModifiers; // Modifiers to rarity weights when using this rod
};
export function createWeightModifiersFromPercentages(
    base: Record<Rarity, number>,
    deltas: PercentageDeltas,
    precision = 1000
): WeightModifiers {
    const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);

    const basePercent: Record<Rarity, number> = {} as any;
    for (const r in base) {
        basePercent[r as Rarity] = (base[r as Rarity] / baseTotal) * 100;
    }

    const nextPercent: Record<Rarity, number> = { ...basePercent };
    let deltaSum = 0;

    for (const r in deltas) {
        const rarity = r as Rarity;
        const d = deltas[rarity]!;
        nextPercent[rarity] += d;
        deltaSum += d;
    }

    const unspecified = (Object.keys(base) as Rarity[]).filter(
        r => !(r in deltas)
    );

    if (unspecified.length > 0 && deltaSum !== 0) {
        const pool = unspecified.reduce((sum, r) => sum + basePercent[r], 0);
        for (const r of unspecified) {
            const share = basePercent[r] / pool;
            nextPercent[r] -= deltaSum * share;
        }
    }
    const targetWeights: Record<Rarity, number> = {} as any;
    for (const r in nextPercent) {
        targetWeights[r as Rarity] = Math.round(
            (nextPercent[r as Rarity] / 100) * precision
        );
    }
    const modifiers: WeightModifiers = {};
    for (const r in base) {
        const rarity = r as Rarity;
        const delta = targetWeights[rarity] - base[rarity];

        if (delta !== 0) {
            modifiers[rarity] = (w: number) => w + delta;
        }
    }
    return modifiers;
}
export const fishingRodLevels: FishingRodLevel[] = [
    { level: 0, name: "Wooden Rod", qualityChance: [1.0], weightModifier: {} },
    {
        level: 1,
        name: "Reinforced Rod",
        qualityChance: [1.0, 0.05],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Exotic: 0.5,
            Epic: 1.5,
            Uncommon: 3,
            Trash: 0
        })
    },
    {
        level: 2,
        name: "Fiberglass Rod",
        qualityChance: [1.0, 0.15, 0.05],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Mythic: 0.3,
            Exotic: 1,
            Fine: 1.5,
            Uncommon: 7,
            Trash: 0
        })
    },
    {
        level: 3,
        name: "Carbon Fiber Rod",
        qualityChance: [1.0, 0.5, 0.25, 0.05],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Legendary: 0.1,
            Mythic: 0.5,
            Exotic: 2,
            Epic: 0.5,
            Rare: 1,
            Fine: 4,
            Uncommon: 10,
            Trash: 0
        })
    },
    {
        level: 4,
        name: "Titanium Rod",
        qualityChance: [1.0, 0.8, 0.45, 0.15, 0.05],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Legendary: 0.3,
            Mythic: 0.8,
            Exotic: 3,
            Epic: 2,
            Rare: 5,
            Fine: 10,
            Uncommon: 15,
            Trash: 0
        })
    },
    {
        level: 5,
        name: "Mythril Rod",
        qualityChance: [1.0, 0.98, 0.75, 0.55, 0.25, 0.05],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Legendary: 0.5,
            Mythic: 1.5,
            Exotic: 4,
            Epic: 3,
            Rare: 8,
            Fine: 10,
            Uncommon: 10,
            Trash: 0
        })
    },
    {
        level: 6,
        name: "Legendary Rod",
        qualityChance: [1.0, 0.99, 0.85, 0.75, 0.55, 0.12],
        weightModifier: createWeightModifiersFromPercentages(RARITY_WEIGHTS_DEFAULT, {
            Legendary: 0.9,
            Mythic: 2,
            Exotic: 5,
            Epic: 4,
            Rare: 10,
            Fine: 5,
            Uncommon: 10,
            Trash: 0
        })
    },
] as const;

// Rod upgrade costs (silver needed to upgrade to next level)
export const ROD_UPGRADE_COSTS: Record<number, number> = {
    0: 1000, // Wooden to Reinforced
    1: 15_000, // Reinforced to Fiberglass
    2: 75_000, // Fiberglass to Carbon Fiber
    3: 250_000, // Carbon Fiber to Titanium
    4: 500_000, // Titanium to Mythril
    5: 750_000, // Mythril to Legendary
} as const;