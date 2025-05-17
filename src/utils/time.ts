import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/**
 * Formats time duration with seconds precision for durations under a minute
 */
export const formatTimeToWithSeconds = (date: Date, hourWithSeconds = false): string => {
    const diff = dayjs(date).diff(dayjs(), "second");
    const absDiff = Math.abs(diff);

    if (absDiff < 60) {
        return `${Math.abs(diff)} seconds`;
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
