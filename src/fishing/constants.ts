import { VALUE_EMOTES_LIST } from "@/emotes";

export type Rarity = "Legendary" | "Epic" | "Rare" | "Fine" | "Uncommon" | "Common" | "Trash";

// Define points per rarity tier
export const RARITY_POINTS: Record<Rarity, number> = { Legendary: 1000, Epic: 250, Rare: 100, Fine: 75, Uncommon: 50, Common: 25, Trash: 1 } as const;

export type Quality = "Normal" | "Shining" | "Glistening" | "Opulent" | "Radiant" | "Alpha";

export const QUALITY_MULTIPLIERS: Record<Quality, number> = {
    Normal: 1.0,
    Shining: 2.5,
    Glistening: 5,
    Opulent: 7.5,
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
export const VALUE_EMOTES: { threshold: number; emote: string }[] = [
    { threshold: 10, emote: VALUE_EMOTES_LIST.WAJAJA.name }, //  < 10
    { threshold: 50, emote: VALUE_EMOTES_LIST.pogg.name }, //  < 50
    { threshold: 100, emote: VALUE_EMOTES_LIST.poggSpin.name }, //  < 100
    { threshold: 140, emote: VALUE_EMOTES_LIST.YIPPIE.name }, //  < 140
    { threshold: 300, emote: VALUE_EMOTES_LIST.POGGIES.name }, //  < 300
    { threshold: 600, emote: VALUE_EMOTES_LIST.POGGERS.name }, //  < 600
    { threshold: 800, emote: VALUE_EMOTES_LIST.Pog.name }, //  < 800
    { threshold: 1000, emote: VALUE_EMOTES_LIST.HOLY.name }, //  < 1000
    { threshold: 2500, emote: VALUE_EMOTES_LIST.Cereal.name }, //  < 2500
    { threshold: 5000, emote: VALUE_EMOTES_LIST.MUGA.name }, //  < 5000
    { threshold: Infinity, emote: VALUE_EMOTES_LIST.OOOO.name }, // >= 5000
];

// Define rarity weights
export const RARITY_WEIGHTS_DEFAULT: Record<Rarity, number> = {
    Legendary: 1, // 0.1% chance each
    Trash: 15, // 1.5%
    Epic: 35, // 3.5% chance
    Rare: 55, // 5.5% chance
    Fine: 95, // 9.5% chance
    Uncommon: 150, // 15% chance
    Common: 649, // 65% chance
};

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


export const fishingRodLevels = [
    { level: 0, name: "Wooden Rod", qualityChance: [1.0] },
    { level: 1, name: "Reinforced Rod", qualityChance: [1.0, 0.05] },
    { level: 2, name: "Fiberglass Rod", qualityChance: [1.0, 0.15, 0.05] },
    { level: 3, name: "Carbon Fiber Rod", qualityChance: [1.0, 0.5, 0.25, 0.05] },
    { level: 4, name: "Titanium Rod", qualityChance: [1.0, 0.8, 0.45, 0.15, 0.05] },
    { level: 5, name: "Mythril Rod", qualityChance: [1.0, 0.98, 0.75, 0.55, 0.25, 0.05] },
    { level: 6, name: "Legendary Rod", qualityChance: [1.0, 0.99, 0.85, 0.75, 0.55, 0.12] }
] as const;

export type FishingRodLevel = typeof fishingRodLevels[number];