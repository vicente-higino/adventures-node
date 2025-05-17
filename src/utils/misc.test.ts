import { describe, expect, it, test } from "vitest";
import { boxMullerTransform, formatSize, formatWeight, roundToDecimalPlaces, limitMessageLength, limitAdvMessage, calculateAmount } from "./misc";

describe("formatSize", () => {
    // Metric tests
    test("formats small sizes in mm (metric)", () => {
        expect(formatSize(0.5)).toBe("5 mm");
    });

    test("formats medium sizes in cm (metric)", () => {
        expect(formatSize(50)).toBe("50 cm");
    });

    test("formats large sizes in m (metric)", () => {
        expect(formatSize(150)).toBe("1.5 m");
    });

    // Imperial tests
    test("formats small sizes in inches (imperial)", () => {
        expect(formatSize(0.5, "imperial")).toBe("0.2 in");
    });

    test("formats medium sizes in inches (imperial)", () => {
        expect(formatSize(25, "imperial")).toBe("9.84 in");
    });

    test("formats mixed sizes in feet and inches (imperial)", () => {
        expect(formatSize(45, "imperial")).toBe("17.72 in");
    });

    test("formats large sizes in feet (imperial)", () => {
        expect(formatSize(300, "imperial")).toBe("9.84 ft");
    });
});

describe("formatWeight", () => {
    // Metric tests
    test("formats small weights in grams (metric)", () => {
        expect(formatWeight(0.000005)).toBe("5 mg");
        expect(formatWeight(roundToDecimalPlaces(0.000005, 6))).toBe("5 mg");
        expect(formatWeight(roundToDecimalPlaces(0.00005, 6))).toBe("50 mg");
        expect(formatWeight(roundToDecimalPlaces(0.0001, 6))).toBe("100 mg");
        expect(formatWeight(roundToDecimalPlaces(0.000999, 6))).toBe("999 mg");
        expect(formatWeight(roundToDecimalPlaces(0.001, 6))).toBe("1 g");
        expect(formatWeight(0.5)).toBe("500 g");
    });

    test("formats medium weights in kg (metric)", () => {
        expect(formatWeight(50)).toBe("50 kg");
    });

    test("formats large weights in tonnes (metric)", () => {
        expect(formatWeight(5000)).toBe("5 t");
    });

    // Imperial tests
    test("formats small weights in ounces (imperial)", () => {
        expect(formatWeight(0.000005, "imperial")).toBe("5 mg");
        expect(formatWeight(0.00005, "imperial")).toBe("50 mg");
        expect(formatWeight(0.00028, "imperial")).toBe("0.01 oz");
        expect(formatWeight(0.05, "imperial")).toBe("1.76 oz");
    });

    test("formats medium weights in pounds (imperial)", () => {
        expect(formatWeight(50, "imperial")).toBe("110.23 lbs");
    });

    test("formats large weights in tons (imperial)", () => {
        expect(formatWeight(5000, "imperial")).toBe("5.51 tn");
    });
});
describe("boxMullerTransform", () => {
    test("generates a random number with default parameters", () => {
        const result = boxMullerTransform();
        console.log("Generated random number (default parameters):", result);
        expect(result).toBeGreaterThanOrEqual(0.01); // Default min value
    });

    test("generates a random number with specified mean and standard deviation", () => {
        const mean = 100;
        const stdDev = 50;
        const result = boxMullerTransform(mean, stdDev, stdDev);
        console.log(`Generated random number (mean: ${mean}, stdDev: ${stdDev}):`, result);
        expect(result).toBeGreaterThanOrEqual(0.01); // Default min value
        // Check if the result is within a reasonable range
        expect(result).toBeGreaterThanOrEqual(mean - 3 * stdDev);
        expect(result).toBeLessThanOrEqual(mean + 3 * stdDev);
    });

    test("respects the minimum value constraint", () => {
        const min = 10;
        const result = boxMullerTransform(0, 1, min);
        console.log("Generated random number (min constraint):", result);
        expect(result).toBeGreaterThanOrEqual(min);
    });

    test("generates different values on subsequent calls", () => {
        // Use parameters less likely to hit the minimum clamp value twice
        const result1 = boxMullerTransform(50, 20);
        const result2 = boxMullerTransform(50, 20);
        console.log("Generated random numbers (subsequent calls):", result1, result2);
        expect(result1).not.toBe(result2); // Random values should differ
    });

    test("handles edge cases with mean and stdDev set to 0", () => {
        const result = boxMullerTransform(0, 0);
        console.log("Generated random number (mean and stdDev set to 0):", result);
        expect(result).toBe(0.01); // Should return the minimum value
    });
});

describe("limitMessageLength", () => {
    it("returns the same message if under 1440 chars", () => {
        const msg = "a".repeat(100);
        const result = limitMessageLength(msg);
        console.log("limitMessageLength (under 1440):", result);
        expect(result).toBe(msg);
    });

    it("truncates and adds ellipsis if over 1440 chars", () => {
        const msg = "a".repeat(1450);
        const result = limitMessageLength(msg);
        console.log("limitMessageLength (over 1440):", result);
        expect(result.length).toBe(1440);
        expect(result.endsWith("…")).toBe(true);
        expect(result.startsWith("a")).toBe(true);
    });

    it("returns exactly 1440 chars if input is 1440 chars", () => {
        const msg = "b".repeat(1440);
        const result = limitMessageLength(msg);
        console.log("limitMessageLength (exact 1440):", result);
        expect(result).toBe(msg);
    });
});

describe("limitAdvMessage", () => {
    it("returns advMsg unchanged if fits with base", () => {
        const base = " ending!";
        const advMsg = "short message";
        const result = limitAdvMessage(base, advMsg);
        console.log("limitAdvMessage (fits):", result);
        expect(result).toBe(advMsg);
    });

    it("truncates advMsg and adds suffix if too long", () => {
        const base = " ending!";
        const advMsg = "x".repeat(1440 - base.length + 10);
        const result = limitAdvMessage(base, advMsg);
        console.log("limitAdvMessage (truncated):", result);
        const suffix = " and others…";
        const msg = `${result}${base}`;
        expect(result.endsWith(suffix)).toBe(true);
        expect(result.length).toBe(1440 - base.length);
        expect(msg.length).toBe(1440);
    });

    it("returns suffix if base is too long to allow advMsg", () => {
        const base = "x".repeat(1440);
        const advMsg = "a".repeat(500);
        const result = limitAdvMessage(base, advMsg);
        const msg = `${result}${base}`;
        const truncMsg = limitMessageLength(msg);
        console.log("limitAdvMessage (base too long):", truncMsg);
        const suffix = " and others…";
        expect(result).toBe(suffix); // advMsg cannot fit, so result is just the suffix
        expect(msg.length).toBe(1440 + suffix.length);
        expect(truncMsg.length).toBe(1440);
    });
});

describe("calculateAmount", () => {
    const available = 1000;
    const current = 500;

    // --- Absolute Values ---
    describe("Absolute Values", () => {
        it('should return available amount for "all"', () => {
            expect(calculateAmount("all", available)).toBe(available);
        });

        it('should return available amount for "ALL"', () => {
            expect(calculateAmount("ALL", available)).toBe(available);
        });

        it("should return correct amount for plain numbers", () => {
            expect(calculateAmount("1000", available)).toBe(1000);
            expect(calculateAmount("100", available)).toBe(100);
            expect(calculateAmount("0", available)).toBe(0);
            expect(calculateAmount("-0", available)).toBe(0);
            expect(calculateAmount("-50", available)).toBe(50);
        });

        it("should clamp plain numbers to available amount", () => {
            expect(calculateAmount("1500", available)).toBe(available);
        });

        it("should return 0 for invalid numeric input", () => {
            expect(calculateAmount("abc", available)).toBe(0);
            expect(calculateAmount("", available)).toBe(0);
        });
    });

    // --- Suffixes (k, m, b) ---
    describe("Suffixes (k, m, b)", () => {
        it("should handle 'k' suffix", () => {
            expect(calculateAmount("1k", 2000)).toBe(1000);
            expect(calculateAmount("0.5k", available)).toBe(500);
            expect(calculateAmount("1.5k", 2000)).toBe(1500);
        });

        it("should handle 'm' suffix", () => {
            expect(calculateAmount("1m", 2_000_000)).toBe(1_000_000);
            expect(calculateAmount("0.5m", 1_000_000)).toBe(500_000);
        });

        it("should handle 'b' suffix", () => {
            expect(calculateAmount("1b", 2_000_000_000)).toBe(1_000_000_000);
            expect(calculateAmount("0.5b", 1_000_000_000)).toBe(500_000_000);
        });

        it("should clamp suffix values to available amount", () => {
            expect(calculateAmount("2k", available)).toBe(available);
            expect(calculateAmount("1.1k", available)).toBe(available);
        });

        it("should return 0 for invalid suffix format", () => {
            expect(calculateAmount("1km", available)).toBe(0);
            expect(calculateAmount("k", available)).toBe(0);
        });
    });

    // --- Percentages ---
    describe("Percentages", () => {
        it("should calculate percentage of available amount", () => {
            expect(calculateAmount("50%", available)).toBe(500);
            expect(calculateAmount("100%", available)).toBe(1000);
            expect(calculateAmount("0%", available)).toBe(0);
            expect(calculateAmount("25%", available)).toBe(250);
            expect(calculateAmount("75.5%", available)).toBe(755); // floor
        });

        it("should clamp percentage result to available amount", () => {
            expect(calculateAmount("150%", available)).toBe(available);
        });

        it("should return 0 for invalid percentage format", () => {
            expect(calculateAmount("%", available)).toBe(0);
            expect(calculateAmount("abc%", available)).toBe(0);
        });
    });

    // --- Delta Values ---
    describe("Delta Values (allowDelta=true)", () => {
        it("should add positive delta to current amount", () => {
            expect(calculateAmount("+100", available, current)).toBe(current + 100); // 600
            // Expect the *clamped* value
            expect(calculateAmount("+1k", available, current)).toBe(available); // 500 + 1000 = 1500 -> clamped to 1000
        });

        it("should subtract negative delta from current amount", () => {
            expect(calculateAmount("-100", available, current)).toBe(current - 100); // 400
            expect(calculateAmount("-1k", available, current)).toBe(0); // 500 - 1000 -> clamped to 0
        });

        it("should clamp delta results between 0 and available amount", () => {
            expect(calculateAmount("+600", available, current)).toBe(available); // 500 + 600 = 1100 -> 1000
            expect(calculateAmount("-600", available, current)).toBe(0); // 500 - 600 = -100 -> 0
        });

        it("should handle percentage delta based on current amount", () => {
            expect(calculateAmount("+10%", available, current)).toBe(current + 50); // 550
            expect(calculateAmount("-50%", available, current)).toBe(current - 250); // 250
            expect(calculateAmount("+200%", available, current)).toBe(available); // 500 + 1000 = 1500 -> 1000
            expect(calculateAmount("-200%", available, current)).toBe(0); // 500 - 1000 = -500 -> 0
        });

        it('should treat "+all" as absolute "all"', () => {
            expect(calculateAmount("+all", available, current)).toBe(available);
        });

        it('should treat "-all" as absolute "all" (sign ignored)', () => {
            // The logic treats 'all' as absolute, overriding the delta flag.
            expect(calculateAmount("-all", available, current)).toBe(available);
        });

        it("should handle delta without current amount (behaves like absolute)", () => {
            expect(calculateAmount("+100", available)).toBe(100);
            // Sign is ignored, absolute value taken and clamped
            expect(calculateAmount("-100", available)).toBe(100);
            expect(calculateAmount("+50%", available)).toBe(500); // % of available
            // Sign is ignored, absolute value taken and clamped
            expect(calculateAmount("-50%", available)).toBe(500);
        });
    });

    // --- Delta Values (allowDelta=false) ---
    describe("Delta Values (allowDelta=false)", () => {
        it("should treat delta strings as invalid when allowDelta is false", () => {
            expect(calculateAmount("+100", available, current, false)).toBe(0);
            expect(calculateAmount("-50", available, current, false)).toBe(0);
            expect(calculateAmount("+10%", available, current, false)).toBe(0);
            expect(calculateAmount("-50%", available, current, false)).toBe(0);
        });

        it("should still process non-delta strings correctly", () => {
            expect(calculateAmount("100", available, current, false)).toBe(100);
            // Percentage should be based on available (1000), not current (500)
            expect(calculateAmount("50%", available, current, false)).toBe(500);
            expect(calculateAmount("all", available, current, false)).toBe(available);
            expect(calculateAmount("1k", available, current, false)).toBe(1000); // Should be clamped to available
        });
    });

    // --- Edge Cases ---
    describe("Edge Cases", () => {
        it("should handle availableAmount = 0", () => {
            expect(calculateAmount("100", 0)).toBe(0);
            expect(calculateAmount("all", 0)).toBe(0);
            expect(calculateAmount("50%", 0)).toBe(0);
            expect(calculateAmount("+10", 0, 0)).toBe(0);
            expect(calculateAmount("-10", 0, 0)).toBe(0);
        });

        it("should handle currentAmount = 0 for deltas", () => {
            expect(calculateAmount("+100", available, 0)).toBe(100);
            expect(calculateAmount("-100", available, 0)).toBe(0); // 0 - 100 -> 0
            expect(calculateAmount("+50%", available, 0)).toBe(0); // 50% of 0 is 0
            expect(calculateAmount("-50%", available, 0)).toBe(0); // 50% of 0 is 0
        });

        it("should handle large numbers correctly", () => {
            const largeAvailable = 5_000_000_000;
            expect(calculateAmount("2b", largeAvailable)).toBe(2_000_000_000);
            expect(calculateAmount("6b", largeAvailable)).toBe(largeAvailable);
            expect(calculateAmount("+1b", largeAvailable, 3_000_000_000)).toBe(4_000_000_000);
            expect(calculateAmount("-4b", largeAvailable, 3_000_000_000)).toBe(0);
        });

        it("should handle floating point percentages", () => {
            // Using Math.round now, 33.3% of 1000 is 333
            expect(calculateAmount("33.3%", 1000)).toBe(333);
        });

        it("should handle floating point suffixes", () => {
            expect(calculateAmount("1.001k", 2000)).toBe(1001); // round(1001)
            expect(calculateAmount("1.234k", 2000)).toBe(1234); // round(1234)
            expect(calculateAmount("1.999k", 2000)).toBe(1999); // round(1999)
        });
    });
});
