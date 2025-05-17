import { describe, it, expect, vi } from "vitest";
import { generatePayoutRate } from "./adventureJoin";

describe("generatePayoutRate", () => {
    it("should return 2.0 for the top 2.5% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.976);
        const result = generatePayoutRate();
        console.log("Test: Top 2.5% chance (expected 2.0) - Result:", result);
        expect(result).toBe(2.0);
        vi.restoreAllMocks();
    });

    it("should return a value between 1.7 and 1.9 for the next 5% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.926);
        const result = generatePayoutRate();
        console.log("Test: Next 5% chance (expected 1.7-1.9) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.7);
        expect(result).toBeLessThanOrEqual(1.9);
        vi.restoreAllMocks();
    });

    it("should return a value between 1.5 and 1.6 for the next 27.5% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.7);
        const result = generatePayoutRate();
        console.log("Test: Next 27.5% chance (expected 1.5-1.6) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.5);
        expect(result).toBeLessThanOrEqual(1.6);
        vi.restoreAllMocks();
    });

    it("should return a value between 1.3 and 1.4 for the remaining 65% chance", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.5);
        const result = generatePayoutRate();
        console.log("Test: Remaining 65% chance (expected 1.3-1.4) - Result:", result);
        expect(result).toBeGreaterThanOrEqual(1.3);
        expect(result).toBeLessThanOrEqual(1.4);
        vi.restoreAllMocks();
    });
});
