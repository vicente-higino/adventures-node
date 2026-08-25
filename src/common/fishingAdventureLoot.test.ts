import { describe, expect, it } from "vitest";
import {
    FISH_TRASH_REWARD_TABLE,
    FISHING_ADVENTURE_LOOT_TABLE,
    getFishingAdventureLootChancePerTrash,
} from "./fishingAdventureLoot";

describe("fishing adventure loot", () => {
    it("is substantially rarer than the five-percent adventure loot roll", () => {
        expect(getFishingAdventureLootChancePerTrash(0)).toBeCloseTo(0.005556, 6);
        expect(getFishingAdventureLootChancePerTrash(5)).toBeCloseTo(0.010011, 6);
        expect(getFishingAdventureLootChancePerTrash(5)).toBeLessThan(0.05);
    });

    it("uses a small weight in the existing trash reward pool", () => {
        expect(FISH_TRASH_REWARD_TABLE).toEqual([
            { type: "silver", weight: 5 },
            { type: "adventure-ticket", weight: 3 },
            { type: "legendary-event-ticket", weight: 2 },
            { type: "legendary-bait", weight: 1 },
            { type: "adventure-loot", weight: 0.25 },
        ]);
    });

    it("uses the adventure catalog's rarity weights", () => {
        const weightsByRarity = FISHING_ADVENTURE_LOOT_TABLE.reduce<Record<string, number>>((weights, entry) => {
            weights[entry.item.rarity] = (weights[entry.item.rarity] ?? 0) + entry.weight;
            return weights;
        }, {});

        expect(weightsByRarity).toEqual({ common: 910, uncommon: 350, rare: 112 });
    });
});
