import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

const thresholds = [
    { l: "s", r: 1 },
    { l: "m", r: 1 },
    { l: "mm", r: 59, d: "minute" },
    { l: "h", r: 1 },
    { l: "hh", r: 23, d: "hour" },
    { l: "d", r: 1 },
    { l: "dd", r: 29, d: "day" },
    { l: "M", r: 1 },
    { l: "MM", r: 11, d: "month" },
    { l: "y", r: 1 },
    { l: "yy", d: "year" },
];
const config = { thresholds };
dayjs.extend(relativeTime, config);

/**
 * Formats time duration with seconds precision for durations under a minute
 */
export const formatTimeToWithSeconds = (date: Date, hourWithSeconds = false): string => {
    const diff = dayjs(date).diff(dayjs(), "second");
    const absDiff = Math.abs(diff);

    if (absDiff < 60) {
        return `${Math.abs(diff)} second${absDiff !== 1 ? "s" : ""}`;
    }

    const minutes = Math.round(absDiff / 60);
    const seconds = absDiff % 60;

    if (minutes < 60) {
        // return `${minutes} minute${minutes !== 1 ? "s" : ""}${seconds > 0 ? ` ${seconds} second${seconds !== 1 ? "s" : ""}` : ""}`;
        if (hourWithSeconds) {
            return `${minutes} minute${minutes !== 1 ? "s" : ""}${seconds > 0 ? ` ${seconds} second${seconds !== 1 ? "s" : ""}` : ""}`;
        }
        return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }

    return dayjs().to(date, true);
};
export function formatMinutes(totalMilliseconds: number): string {
    const d = dayjs.duration(totalMilliseconds, "milliseconds");

    const hours = d.hours();
    const minutes = d.minutes();

    const parts: string[] = [];

    if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    }

    if (minutes > 0 || parts.length === 0) {
        parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    }

    return parts.join(" ");
}
