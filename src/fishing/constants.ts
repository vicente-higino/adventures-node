export type Rarity = "Legendary" | "Epic" | "Rare" | "Fine" | "Uncommon" | "Common" | "Trash";

// Define points per rarity tier
export const RARITY_POINTS: Record<Rarity, number> = { Legendary: 1000, Epic: 250, Rare: 100, Fine: 75, Uncommon: 50, Common: 25, Trash: 1 } as const;

export interface CatchDetails {
    sellValue: number;
    name: string;
    rarity: Rarity;
    size: number; // in centimeters
    weight: number; // in kilograms
    emote?: () => string;
}

export const VALUE_EMOTES: { threshold: number; emote: string }[] = [
    { threshold: 10, emote: "WAJAJA" }, //  < 10
    { threshold: 50, emote: "pogg" }, //  < 50
    { threshold: 100, emote: "poggSpin" }, //  < 100
    { threshold: 140, emote: "YIPPIE" }, //  < 140
    { threshold: 300, emote: "POGGIES" }, //  < 300
    { threshold: 600, emote: "POGGERS" }, //  < 600
    { threshold: 800, emote: "Pog" }, //  < 800
    { threshold: 1000, emote: "HOLY" }, //  < 1000
    { threshold: 2500, emote: "Cereal" }, //  < 2500
    { threshold: 5000, emote: "MUGA" }, //  < 5000
    { threshold: Infinity, emote: "OOOO" }, // >= 5000
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
