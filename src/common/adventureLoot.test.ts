import { getAdventureItem } from "@/adventures/rpg";
import { describe, expect, it } from "vitest";
import { evaluateAdventureLootEligibility, getConvertedLootSilver, type OwnedAdventureLoot } from "./adventureLoot";

const commonLoot = getAdventureItem("pirate.tideworn-compass.v1")!;
const uncommonLoot = getAdventureItem("pirate.buccaneer-cutlass.v1")!;

function owned(overrides: Partial<OwnedAdventureLoot> = {}): OwnedAdventureLoot {
    return { code: "spy.hacking-kit.v1", quantity: 1, active: true, equippedSlot: "tool", theme: "spy", modifier: 1, ...overrides };
}

describe("adventure loot eligibility", () => {
    it("allows a new item that improves its slot and theme buff", () => {
        expect(evaluateAdventureLootEligibility(uncommonLoot, true, [owned({ equippedSlot: "weapon", modifier: 1 })])).toEqual({
            eligible: true,
            modifier: 2,
        });
    });

    it("converts duplicate loot to its fixed rarity silver value", () => {
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ code: commonLoot.id, equippedSlot: null })])).toEqual({
            eligible: false,
            reason: "duplicate",
            silverBonus: 50,
        });
    });

    it("converts loot that cannot improve the current theme or slot", () => {
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ theme: "pirate", modifier: 2 })])).toMatchObject({
            eligible: false,
            reason: "weaker-theme-buff",
        });
        expect(evaluateAdventureLootEligibility(commonLoot, true, [owned({ equippedSlot: commonLoot.slot, modifier: 1 })])).toMatchObject({
            eligible: false,
            reason: "weaker-slot-item",
        });
    });

    it("reads persisted silver conversions safely", () => {
        expect(getConvertedLootSilver({ convertedToSilver: 100 })).toBe(100);
        expect(getConvertedLootSilver({ convertedToSilver: "100" })).toBe(0);
        expect(getConvertedLootSilver(commonLoot)).toBe(0);
    });
});
