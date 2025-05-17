import { describe, beforeEach, afterEach, test, expect, vi } from "vitest";
import { formatTimeToWithSeconds } from "./time";

describe("formatTimeToWithSeconds", () => {
    beforeEach(() => {
        // Mock the current date to ensure consistent test results
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-04-20T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("formats seconds correctly for time less than 1 minute in the future", () => {
        const date = new Date("2025-04-20T12:00:30.000Z"); // 30 seconds in the future
        expect(formatTimeToWithSeconds(date)).toBe("30 seconds");
    });

    test("formats seconds correctly for time less than 1 minute in the past", () => {
        const date = new Date("2025-04-20T11:59:40.000Z"); // 20 seconds in the past
        expect(formatTimeToWithSeconds(date)).toBe("20 seconds");
    });

    test("formats minutes and seconds correctly for time between 1 and 60 minutes in the future", () => {
        const date = new Date("2025-04-20T12:05:15.000Z"); // 5 minutes 15 seconds in the future
        expect(formatTimeToWithSeconds(date)).toBe("5 minutes 15 seconds");
    });

    test("formats singular minute and seconds correctly", () => {
        const date = new Date("2025-04-20T12:01:01.000Z"); // 1 minute 1 second in the future
        expect(formatTimeToWithSeconds(date)).toBe("1 minute 1 second");
    });

    test("formats minutes with zero seconds correctly", () => {
        const date = new Date("2025-04-20T12:49:00.000Z"); // 49 minutes in the future
        expect(formatTimeToWithSeconds(date)).toBe("49 minutes");
    });

    test("uses dayjs relative time for durations over 60 minutes in the future", () => {
        const date = new Date("2025-04-20T14:30:00.000Z"); // 2.5 hours in the future
        expect(formatTimeToWithSeconds(date)).toBe("3 hours");
    });

    test("uses dayjs relative time for durations over 60 minutes in the past", () => {
        const date = new Date("2025-04-20T09:30:00.000Z"); // 2.5 hours in the past
        expect(formatTimeToWithSeconds(date)).toBe("3 hours");
    });
});
