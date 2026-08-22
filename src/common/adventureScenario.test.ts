import { describe, expect, it } from "vitest";
import { parseStoredAdventureScenario, resolveAdventureApproach, type StoredAdventureScenario } from "./adventureScenario";

const scenario: StoredAdventureScenario = {
    title: "Clockwork Vault",
    intro: "Gears begin to turn.",
    theme: "steampunk",
    kind: "regular",
    presentationMode: "individual",
    approaches: [
        { id: "force", label: "Force the door", check: "might" },
        { id: "repair", label: "Repair the lock", check: "technology" },
        { id: "study", label: "Study the mechanism", check: "knowledge" },
    ],
};

describe("persisted adventure scenarios", () => {
    it("rejects malformed persisted context", () => {
        expect(parseStoredAdventureScenario(scenario)).toEqual(scenario);
        expect(parseStoredAdventureScenario({ ...scenario, approaches: [{ id: "bad", label: "Bad", check: "luck" }] })).toBeUndefined();
        expect(parseStoredAdventureScenario({ ...scenario, presentationMode: "huge" })).toBeUndefined();
    });

    it("accepts an explicit approach and otherwise picks the best frozen loadout", () => {
        const loadout = {
            classCode: "engineer",
            proficiencies: ["technology", "endurance"],
            equippedItems: [{ code: "wrench", name: "Wrench", slot: "tool", theme: "steampunk", checkCode: "technology", modifier: 1 }],
            capturedAt: "2026-08-22T00:00:00.000Z",
        };

        expect(resolveAdventureApproach(scenario, "study", loadout)?.id).toBe("study");
        expect(resolveAdventureApproach(scenario, "KNOWLEDGE", loadout)?.id).toBe("study");
        expect(resolveAdventureApproach(scenario, undefined, loadout)?.id).toBe("repair");
        expect(resolveAdventureApproach(scenario, "dance", loadout)).toBeUndefined();
    });
});
