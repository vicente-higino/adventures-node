import { afterEach, describe, expect, it, vi } from "vitest";
import { runGroupAdventure } from ".";

describe("legacy group adventure odds", () => {
    afterEach(() => vi.restoreAllMocks());

    it("uses the supplied payout-aware success chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        expect(runGroupAdventure(["Ada", "Lin"], 20).results.every(result => result.outcome === "lose")).toBe(true);

        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(runGroupAdventure(["Ada", "Lin"], 20).results.every(result => result.outcome === "win")).toBe(true);
    });

    it("rejects invalid success chances", () => {
        expect(() => runGroupAdventure(["Ada"], -1)).toThrow(RangeError);
        expect(() => runGroupAdventure(["Ada"], 101)).toThrow(RangeError);
    });
});
