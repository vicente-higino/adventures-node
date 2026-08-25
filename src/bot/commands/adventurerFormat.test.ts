import { describe, expect, it } from "vitest";
import { formatAdventureBuffs, formatAdventureStatus } from "./adventurerFormat";

describe("compact character formatting", () => {
    it("shows only the strongest bonus for each theme", () => {
        expect(
            formatAdventureBuffs([
                { theme: "atlantis", modifier: 3 },
                { theme: "atlantis", modifier: 2 },
                { theme: "spy", modifier: 1 },
                { theme: "pirate", modifier: 2 },
            ]),
        ).toBe("Atlantis +15%, Pirate +10%, Spy +5%");
    });

    it("ignores inactive bonuses and compacts one status", () => {
        expect(
            formatAdventureBuffs([
                { theme: null, modifier: 3 },
                { theme: "horror", modifier: 0 },
            ]),
        ).toBe("none");
        expect(formatAdventureStatus(undefined)).toBeUndefined();
        expect(formatAdventureStatus({ name: "Inspired", modifier: 2, remainingAdventures: 1 })).toBe("Inspired +10% (1 adv)");
        expect(formatAdventureStatus({ name: "Rattled", modifier: -1, remainingAdventures: 1 })).toBe("Rattled -5% (1 adv)");
    });
});
