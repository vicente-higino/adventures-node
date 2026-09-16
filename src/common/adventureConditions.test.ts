import { describe, expect, it } from "vitest";
import { evaluateAdventureConditions, type AdventureConditionForResolution } from "./adventureConditions";

const conditions: AdventureConditionForResolution[] = [
    { id: 1, code: "fantasy.arcane-burn", name: "Arcane Burn", modifier: -1, checkCodes: ["arcana"], themeCodes: ["fantasy"] },
    { id: 2, code: "pirate.seasick", name: "Seasick", modifier: -1, checkCodes: ["agility"], themeCodes: ["pirate"] },
];

describe("adventure condition lifecycle", () => {
    it("applies the one active status and advances every legacy status", () => {
        expect(evaluateAdventureConditions(conditions)).toEqual({
            conditionIdsToAdvance: [1, 2],
            modifier: { code: "fantasy.arcane-burn", label: "Arcane Burn", source: "status", modifier: -1 },
        });
    });

    it("supports a one-adventure positive status worth ten percentage points", () => {
        expect(
            evaluateAdventureConditions([{ id: 3, code: "special.inspired", name: "Inspired", modifier: 2, checkCodes: [], themeCodes: [] }]),
        ).toEqual({ conditionIdsToAdvance: [3], modifier: { code: "special.inspired", label: "Inspired", source: "status", modifier: 2 } });
    });
});
