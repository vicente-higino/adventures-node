import { describe, expect, it } from "vitest";
import {
    calculateFishingFine,
    calculateRandomFishingFine,
    formatFishingFineRates,
    formatUserFishingFineRates,
    getFishingFineChance,
} from "./fishingFine";

describe("calculateFishingFine", () => {
    it.each([
        [100, 1],
        [500, 5],
        [1_000, 11],
        [2_500, 33],
        [5_000, 77],
        [10_000, 177],
        [25_000, 552],
        [50_000, 1_302],
        [100_000, 3_052],
        [200_000, 7_052],
    ])("calculates a progressive fine for %i silver net worth: %i silver", (silverNetWorth, expectedFine) => {
        expect(calculateFishingFine(silverNetWorth)).toBe(expectedFine);
    });

    it("rounds down fractional silver", () => {
        expect(calculateFishingFine(1_001)).toBe(11);
    });

    it("randomizes the fine between 50% and 150% of the progressive amount", () => {
        expect(calculateRandomFishingFine(500, () => 0)).toBe(3);
        expect(calculateRandomFishingFine(500, () => 0.999999)).toBe(7);
    });

    it("keeps small fines at least one silver", () => {
        expect(calculateRandomFishingFine(100, () => 0)).toBe(1);
        expect(calculateRandomFishingFine(100, () => 0.999999)).toBe(1);
    });

    it("formats the marginal brackets for users", () => {
        expect(formatFishingFineRates()).toBe(
            "Fishing fines (progressive): <=500: 1% | 501-1,000: 1.25% | 1,001-2,500: 1.5% | 2,501-5,000: 1.75% | 5,001-10,000: 2% | 10,001-25,000: 2.5% | 25,001-50,000: 3% | 50,001-100,000: 3.5% | 100,001+: 4%. Final fine varies 50-150%.",
        );
    });

    it("formats the personalized rate and estimated fine separately", () => {
        expect(formatUserFishingFineRates("viewer", 10_076, 6)).toBe(
            "@viewer: 2.5% marginal rate, 0.7% catch chance per eligible cast. Estimated fine: 90-268 silver.",
        );
    });

    it.each([
        [0, 0.01],
        [1, 0.0095],
        [6, 0.007],
        [10, 0.005],
        [20, 0.005],
    ])("sets the fine chance for rod level %i to %i", (rodLevel, expectedChance) => {
        expect(getFishingFineChance(rodLevel)).toBe(expectedChance);
    });

    it("does not increase the fine chance for a negative rod level", () => {
        expect(getFishingFineChance(-1)).toBe(0.01);
    });
});
