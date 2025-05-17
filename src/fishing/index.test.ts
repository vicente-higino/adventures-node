import { describe, it, expect } from "vitest";
import { getSellMultiplier } from "./index";
import { SELL_MULTIPLIERS } from "./constants";

describe("getSellMultiplier", () => {
    it("returns the correct multiplier for values at thresholds", () => {
        expect(getSellMultiplier(0.1)).toBe(1.0);
        expect(getSellMultiplier(0.25)).toBe(1.75);
        expect(getSellMultiplier(0.5)).toBe(0.6);
        expect(getSellMultiplier(1.0)).toBe(0.8);
        expect(getSellMultiplier(1.5)).toBe(1.0);
        expect(getSellMultiplier(2.0)).toBe(1.5);
        expect(getSellMultiplier(3.0)).toBe(2.5);
    });

    it("returns the correct multiplier for values between thresholds", () => {
        expect(getSellMultiplier(0.05)).toBe(1.0); // < 0.1
        expect(getSellMultiplier(0.2)).toBe(1.75); // 0.1 - 0.25
        expect(getSellMultiplier(0.4)).toBe(0.6); // 0.25 - 0.5
        expect(getSellMultiplier(0.75)).toBe(0.8); // 0.5 - 1.0
        expect(getSellMultiplier(1.25)).toBe(1.0); // 1.0 - 1.5
        expect(getSellMultiplier(1.8)).toBe(1.5); // 1.5 - 2.0
        expect(getSellMultiplier(2.5)).toBe(2.5); // 2.0 - 3.0
    });

    it("returns the highest multiplier for values above the highest threshold", () => {
        expect(getSellMultiplier(3.1)).toBe(4.25);
        expect(getSellMultiplier(5)).toBe(4.25);
        expect(getSellMultiplier(100)).toBe(4.25);
    });

    it("handles edge cases correctly", () => {
        expect(getSellMultiplier(0)).toBe(1.0); // Smallest threshold
        expect(getSellMultiplier(-1)).toBe(1.0); // Negative values still return first multiplier
        expect(getSellMultiplier(Infinity)).toBe(4.25); // Infinity returns highest multiplier
    });

    it("returns fallback multiplier when no threshold matches", () => {
        // This is a theoretical test - in practice all numbers will match a threshold due to Infinity
        const highestMultiplier = SELL_MULTIPLIERS[SELL_MULTIPLIERS.length - 1].multiplier;
        expect(getSellMultiplier(Number.MAX_VALUE)).toBe(highestMultiplier);
    });
});
