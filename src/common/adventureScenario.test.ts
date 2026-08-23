import { describe, expect, it } from "vitest";
import { getAutomaticAdventureApproach, parseStoredAdventureScenario, type StoredAdventureScenario } from "./adventureScenario";

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

    it("uses one automatic internal approach regardless of old manual input", () => {
        expect(getAutomaticAdventureApproach(scenario).id).toBe("force");
    });
});
