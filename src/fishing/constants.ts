import { VALUE_EMOTES_LIST } from "@/emotes";
import { EmoteName } from "@/emotes/emotesData";
import type { Rarity, FishQuality as Quality } from "@prisma/client";

export { Rarity, Quality };

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

// Define rarity weights
export const RARITY_WEIGHTS_DEFAULT: Record<Rarity, number> = {
    Legendary: 1, // 0.1% chance each
    Mythic: 0, //need upgraded rods to get these, so 0% chance with default rod
    Exotic: 0,
    Trash: 15, // 1.5%
    Epic: 35, // 3.5% chance
    Rare: 55, // 5.5% chance
    Fine: 95, // 9.5% chance
    Uncommon: 150, // 15% chance
    Common: 649, // 65% chance
};

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

export type FishingRodLevel = {
    level: number;
    name: string;
    qualityChance: number[]; // Cumulative chances for each quality tier, starting from Normal. Length determines number of quality tiers available.
    weightModifier: Partial<Record<Rarity, (current: number) => number>>; // Modifiers to rarity weights when using this rod
};

export const fishingRodLevels: FishingRodLevel[] = [
    { level: 0, name: "Wooden Rod", qualityChance: [1.0], weightModifier: {} },
    {
        level: 1,
        name: "Reinforced Rod",
        qualityChance: [1.0, 0.05],
        weightModifier: { Exotic: w => w + 10, Uncommon: w => w + 15, Common: w => w - 25 },
    },
    {
        level: 2,
        name: "Fiberglass Rod",
        qualityChance: [1.0, 0.15, 0.05],
        weightModifier: { Mythic: w => w + 10, Exotic: w => w + 25, Fine: w => w + 15, Uncommon: w => w + 35, Common: w => w - 85 },
    },
    {
        level: 3,
        name: "Carbon Fiber Rod",
        qualityChance: [1.0, 0.5, 0.25, 0.05],
        weightModifier: {
            Legendary: w => w + 1,
            Mythic: w => w + 15,
            Exotic: w => w + 35,
            Epic: w => w + 5,
            Rare: w => w + 5,
            Fine: w => w + 15,
            Uncommon: w => w + 24,
            Common: w => w - 100,
        },
    },
    {
        level: 4,
        name: "Titanium Rod",
        qualityChance: [1.0, 0.8, 0.45, 0.15, 0.05],
        weightModifier: {
            Legendary: w => w + 3,
            Mythic: w => w + 20,
            Exotic: w => w + 40,
            Epic: w => w + 15,
            Rare: w => w + 15,
            Fine: w => w + 15,
            Uncommon: w => w + 22,
            Common: w => w - 130,
        },
    },
    {
        level: 5,
        name: "Mythril Rod",
        qualityChance: [1.0, 0.98, 0.75, 0.55, 0.25, 0.05],
        weightModifier: {
            Legendary: w => w + 5,
            Mythic: w => w + 40,
            Exotic: w => w + 55,
            Epic: w => w + 30,
            Rare: w => w + 30,
            Fine: w => w - 10,
            Uncommon: w => w - 20,
            Common: w => w - 130,
        },
    },
    {
        level: 6,
        name: "Legendary Rod",
        qualityChance: [1.0, 0.99, 0.85, 0.75, 0.55, 0.12],
        weightModifier: {
            Legendary: w => w + 9,
            Mythic: w => w + 60,
            Exotic: w => w + 75,
            Epic: w => w + 35,
            Rare: w => w + 10,
            Fine: w => w - 20,
            Uncommon: w => w - 20,
            Common: w => w - 149,
        },
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