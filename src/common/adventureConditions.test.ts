import { describe, expect, it } from "vitest";
import { evaluateAdventureConditions, type AdventureConditionForResolution } from "./adventureConditions";

const conditions: AdventureConditionForResolution[] = [
    { id: 1, code: "fantasy.arcane-burn", name: "Arcane Burn", modifier: -1, checkCodes: ["arcana"], themeCodes: ["fantasy"] },
    { id: 2, code: "pirate.seasick", name: "Seasick", modifier: -1, checkCodes: ["agility"], themeCodes: ["pirate"] },
];

describe("adventure condition lifecycle", () => {
    it("applies only a matching status while advancing every active status", () => {
        expect(evaluateAdventureConditions(conditions, "arcana", "fantasy")).toEqual({
            conditionIdsToAdvance: [1, 2],
            modifier: { code: "fantasy.arcane-burn", label: "Arcane Burn", source: "status", modifier: -1 },
        });
    });

    it("still advances statuses when none apply to the completed adventure", () => {
        expect(evaluateAdventureConditions(conditions, "technology", "cyberpunk")).toEqual({ conditionIdsToAdvance: [1, 2], modifier: undefined });
    });
});
