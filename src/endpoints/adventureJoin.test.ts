import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePayoutRate } from "./adventureJoin";

describe("generatePayoutRate", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        { random: 0.99995, payout: 5, frequency: "0.01%" },
        { random: 0.9997, payout: 4, frequency: "0.04%" },
        { random: 0.998, payout: 3, frequency: "0.20%" },
        { random: 0.98, payout: 2, frequency: "2.25%" },
    ])("returns $payout x for its super-rare $frequency tier", ({ random, payout }) => {
        vi.spyOn(Math, "random").mockReturnValue(random);
        expect(generatePayoutRate()).toBe(payout);
    });

    it("should return a value between 1.7 and 1.9 for the next 5% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.926);
        const result = generatePayoutRate();
        console.log("Test: Next 5% chance (expected 1.7-1.9) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.7);
        expect(result).toBeLessThanOrEqual(1.9);
    });

    it("should return a value between 1.5 and 1.6 for the next 27.5% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.7);
        const result = generatePayoutRate();
        console.log("Test: Next 27.5% chance (expected 1.5-1.6) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.5);
        expect(result).toBeLessThanOrEqual(1.6);
    });

    it("should return a value between 1.3 and 1.4 for the remaining 65% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);
        const result = generatePayoutRate();
        console.log("Test: Remaining 65% chance (expected 1.3-1.4) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.3);
        expect(result).toBeLessThanOrEqual(1.4);
    });
});
