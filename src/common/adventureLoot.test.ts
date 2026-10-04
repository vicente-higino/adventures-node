import { getAdventureItem } from "@/adventures/rpg";
import { describe, expect, it } from "vitest";
import { ADVENTURE_LOOT_SILVER_BY_RARITY, evaluateAdventureLootEligibility, getConvertedLootSilver, type OwnedAdventureLoot } from "./adventureLoot";

const commonLoot = getAdventureItem("pirate.tideworn-compass.v1")!;
const uncommonLoot = getAdventureItem("pirate.buccaneer-cutlass.v1")!;

function owned(overrides: Partial<OwnedAdventureLoot> = {}): OwnedAdventureLoot {
    return { code: "spy.hacking-kit.v1", quantity: 1, active: true, equipment: true, theme: "spy", modifier: 1, ...overrides };
}

describe("adventure loot eligibility", () => {
    it("converts loot to the configured silver amount for each rarity", () => {
        expect(ADVENTURE_LOOT_SILVER_BY_RARITY).toEqual({ common: 1_000, uncommon: 5_000, rare: 10_000, epic: 50_000 });
    });

    it("allows a new item that improves its theme buff regardless of gear category", () => {
        expect(evaluateAdventureLootEligibility(uncommonLoot, true, [owned({ theme: "pirate", modifier: 1 })])).toEqual({
            eligible: true,
            modifier: 2,
        });
    });

    it("converts duplicate loot to its fixed rarity silver value", () => {
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ code: commonLoot.id })])).toEqual({
            eligible: false,
            reason: "duplicate",
            silverBonus: 1_000,
        });
    });

    it("converts loot that cannot improve the current theme", () => {
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ theme: "pirate", modifier: 2 })])).toMatchObject({
            eligible: false,
            reason: "weaker-theme-buff",
        });
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ equipment: false, theme: "pirate", modifier: 4 })])).toMatchObject({
            eligible: true,
        });
    });

    it("reads persisted silver conversions safely", () => {
        expect(getConvertedLootSilver({ convertedToSilver: 100 })).toBe(100);
        expect(getConvertedLootSilver({ convertedToSilver: "100" })).toBe(0);
        expect(getConvertedLootSilver(commonLoot)).toBe(0);
    });
});
