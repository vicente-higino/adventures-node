import { randomFish, getFish, getValueEmote } from "../fishing";
import { fishTable } from "./fishTable"; // Corrected import path
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fishingModule from "../fishing";
import { CatchDetails, Rarity } from "./constants";

/**
 * Test suite for fishing functionality
 */

// Helper function to run multiple trials and collect results
function runMultipleTrials(trials: number): Record<Rarity, number> {
    const results: Record<Rarity, number> = { Legendary: 0, Epic: 0, Rare: 0, Fine: 0, Uncommon: 0, Common: 0, Trash: 0 };

    for (let i = 0; i < trials; i++) {
        const fish = randomFish();
        results[fish.rarity]++;
    }

    return results;
}

describe("Fishing Module", () => {
    describe("randomFish function", () => {
        it("should return a valid fish", () => {
            const fish = randomFish();

            expect(fish).toBeDefined();
            expect(typeof fish.name).toBe("string");
            expect(["Legendary", "Epic", "Rare", "Fine", "Uncommon", "Common", "Trash"]).toContain(fish.rarity);
            expect(typeof fish.size).toBe("number");
            expect(typeof fish.weight).toBe("number");
        });

        it("should never return undefined after multiple calls", () => {
            for (let i = 0; i < 100; i++) {
                expect(randomFish()).toBeDefined();
            }
        });

        it("should distribute fish rarities according to expected weights", () => {
            // Run many trials and check if distribution roughly matches weights
            const trials = 100000;
            const results = runMultipleTrials(trials);

            // Expected percentages based on weights (total weight is 1001)
            const expectedPercentages = {
                Legendary: 0.001, // 1/1000
                Epic: 0.035, // 35/1000
                Rare: 0.055, // 55/1000
                Fine: 0.095, // 95/1000
                Uncommon: 0.15, // 150/1000
                Common: 0.649, // 649/1000
                Trash: 0.015, // 15/1000
            };

            // Check if distribution is roughly as expected (within 30% margin)
            // Using a larger margin because random distribution can vary more in tests
            Object.entries(results).forEach(([rarity, count]) => {
                const percentage = count / trials;
                const expected = expectedPercentages[rarity as Rarity];
                const margin = expected * 0.3; // 30% margin of error for randomness

                // Log for informational purposes
                console.log(`${rarity}: ${count} (${(percentage * 100).toFixed(2)}%), Expected: ${(expected * 100).toFixed(2)}%`);

                // Assert with proper Vitest assertion
                expect(
                    Math.abs(percentage - expected),
                    `${rarity} distribution (${percentage.toFixed(4)}) should be within 30% of expected (${expected})`,
                ).toBeLessThanOrEqual(margin);
            });
        });

        it("should be able to return all fish from the fishTable", () => {
            // This test checks if randomFish can potentially return all fish entries from fishTable
            // We need to access the fishTable directly

            // Make sure fishTable exists and is an array
            expect(fishTable).toBeDefined();
            expect(Array.isArray(fishTable)).toBe(true);

            // Create a Set to track unique fish names we've found
            const foundFish = new Set();
            const totalFish = fishTable.length;

            // We'll run many trials (much more than the number of fish)
            // to increase chances of finding all fish
            let trials = 0;
            const maxTrials = 100000;

            while (foundFish.size < totalFish && trials < maxTrials) {
                const fish = randomFish();
                foundFish.add(fish.name);
                trials++;
            }

            // Log statistics
            console.log(`Found ${foundFish.size} unique fish out of ${totalFish} after ${trials} trials`);

            // We should find all fish eventually, but to avoid flaky tests,
            // we'll check that we found at least 95% of all fish
            const foundPercentage = foundFish.size / totalFish;
            console.log(`Found ${(foundPercentage * 100).toFixed(2)}% of all fish`);

            // At minimum we should find most of the fish
            expect(foundPercentage, "Should find at least 95% of all fish").toBeGreaterThanOrEqual(0.95);

            // In a perfect world, we'd find all fish
            // This may occasionally fail due to randomness, but with 100k trials it's unlikely
            expect(foundFish.size, "Should eventually find all fish").toBe(totalFish);
        });
    });

    describe("getFish function", () => {
        // Mock Math.random for predictable results
        let randomIndex = 0;
        const mockRandom = vi.spyOn(Math, "random");

        beforeEach(() => {
            // Reset the mock before each test
            mockRandom.mockReset();
            randomIndex = 0;
            vi.restoreAllMocks();
        });

        it("should return a complete fish object with all expected properties", () => {
            // Mock random to return consistent values
            mockRandom.mockImplementation(() => 0.5);

            const result = getFish();

            expect(result).toHaveProperty("name");
            expect(result).toHaveProperty("rarity");
            expect(result).toHaveProperty("rarityEmote");
            expect(result).toHaveProperty("size");
            expect(result).toHaveProperty("formatedSize");
            expect(result).toHaveProperty("prefix");
            expect(result).toHaveProperty("multiplier");
            expect(result).toHaveProperty("weight");
            expect(result).toHaveProperty("formatedWeight");
            expect(result).toHaveProperty("sellMultiplier");
            expect(result).toHaveProperty("sellValue");
        });

        it("should correctly format sizes and weights in metric units by default", () => {
            // Mock random to return consistent values
            const values = [0.3, 0.7, 0.5, 0.6];
            mockRandom.mockImplementation(() => {
                return values[randomIndex++ % values.length];
            });

            // Mock a fish with known measurements
            const mockFish: CatchDetails = {
                name: "Test Fish",
                rarity: "Common",
                size: 100, // 100cm
                weight: 10, // 10kg
                sellValue: 25,
            };

            const randomFishMock = vi.spyOn(fishingModule, "randomFish").mockImplementation(() => mockFish) as any;

            // Get fish with default metric units
            const result = getFish(randomFishMock);

            // Check that formatted values use metric units
            expect(result.formatedSize).toMatch(/(m$|cm$|mm$)/);
            expect(result.formatedWeight).toMatch(/(kg$|g$|t$)/);
        });

        it("should correctly format sizes and weights in imperial units when specified", () => {
            // Mock random to return consistent values
            const values = [0.3, 0.7, 0.5, 0.6];
            mockRandom.mockImplementation(() => {
                return values[randomIndex++ % values.length];
            });

            // Mock a fish with known measurements
            const mockFish: CatchDetails = {
                name: "Test Fish",
                rarity: "Common",
                size: 100, // 100cm would be ~39.37 inches
                weight: 10, // 10kg would be ~22.05 pounds
                sellValue: 25,
            };

            const randomFishMock = vi.spyOn(fishingModule, "randomFish").mockImplementation(() => mockFish) as any;

            // Get fish with imperial units
            const result = getFish({ rndFish: randomFishMock, unitSystem: "imperial" });

            // Check that formatted values use imperial units
            expect(result.formatedSize).toMatch(/ft$|in$/);
            expect(result.formatedWeight).toMatch(/oz$|lbs$/);
        });

        it("should assign the correct value emote based on sell value", () => {
            // Test with different sell values
            [5, 25, 75, 125, 250, 500, 800, 1500].forEach(sellValue => {
                const emote = getValueEmote(sellValue);
                expect(typeof emote).toBe("string");
                expect(emote.length).toBeGreaterThan(0);
            });
        });

        it("should handle trash items correctly", () => {
            // Reset mocks for this test

            // Mock randomFish to return a trash item
            const mockFish: CatchDetails = { name: "Plastic Bag", rarity: "Trash", size: 25, weight: 0.01, sellValue: 1 };

            // Import the actual function to mock it properly
            const randomFishMock = vi.spyOn(fishingModule, "randomFish").mockImplementation(() => mockFish) as any;

            // Call getFish which should use our mocked randomFish
            const result = getFish({ rndFish: randomFishMock });

            // Verify the mock was called

            // Check expected results
            expect(result.rarity).toBe("Trash");
            expect(result.size).toBe(mockFish.size); // For trash, size doesn't get modified
            expect(result.weight).toBe(mockFish.weight); // For trash, weight doesn't get modified
            expect(result.sellValue).toBe(1); // Trash always has a sell value of 1

            // Clean up
            randomFishMock.mockRestore();
        });

        it("should handle special emote fish correctly", () => {
            // Reset mocks for this test

            // Mock a special fish with custom emote
            const mockFish: CatchDetails = { name: "Mushy", rarity: "Legendary", size: 40, weight: 4, sellValue: 5000, emote: () => "mushyJam" };

            // Import the actual function to mock it properly
            const randomFishMock = vi.spyOn(fishingModule, "randomFish").mockImplementation(() => mockFish) as any;

            // Call getFish which should use our mocked randomFish
            const result = getFish({ rndFish: randomFishMock });
            expect(result.name).toBe("Mushy");
            expect(result.emote).toBe("mushyJam");

            // Clean up
        });
    });
});
