import { GetBot, getBotConfig } from "@/bot";
import Qty from "js-quantities";

export function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
function configurableRoundingFormatter(maxDecimals: number): Qty.Formatter {
    return function (scalar, units) {
        const pow = Math.pow(10, maxDecimals);
        const rounded = Math.round(scalar * pow) / pow;

        return rounded + " " + units;
    };
}
Qty.formatter = configurableRoundingFormatter(2);

export type UnitSystem = "metric" | "imperial";

export function formatSize(size: number, unitSystem: UnitSystem = "metric"): string {
    if (unitSystem === "metric") {
        const qty = Qty(`${size} cm`);
        if (qty.scalar < 1) {
            return qty.toPrec("0.01 mm").format("mm");
        } else if (qty.scalar < 100) {
            return qty.toPrec("0.01 cm").format("cm");
        } else {
            return qty.toPrec("0.01 m").format("m");
        }
    } else {
        // Convert cm to inches first
        const qty = Qty(`${size} cm`).to("in");
        if (qty.scalar < 1) {
            return qty.toPrec("0.01 in").format("in");
        } else if (qty.scalar < 36) {
            return qty.toPrec("0.01 in").format("in");
        } else {
            return qty.to("ft").toPrec("0.01 ft").format("ft");
        }
    }
}

export function formatWeight(weight: number, unitSystem: UnitSystem = "metric"): string {
    if (unitSystem === "metric") {
        const qty = Qty(`${weight} kg`);
        if (qty.scalar < 0.001) {
            return qty.toPrec("0.01 mg").format("mg");
        } else if (qty.scalar < 1) {
            return qty.toPrec("0.01 g").format("g");
        } else if (qty.scalar < 1000) {
            return qty.toPrec("0.01 kg").format("kg");
        } else {
            return qty.toPrec("0.01 t").format("t");
        }
    } else {
        // Convert kg to pounds
        const qty = Qty(`${weight} kg`).to("lb");
        if (qty.scalar < 0.0006) {
            return qty.to("kg").format("mg");
        } else if (qty.scalar < 1) {
            return qty.toPrec("0.01 oz").format("oz");
        } else if (qty.scalar < 2000) {
            return qty.toPrec("0.01 lb").format("lb");
        } else {
            return qty.to("ton").toPrec("0.01 ton").format("ton");
        }
    }
}

export function roundToDecimalPlaces(value: number, decimalPlaces = 2): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
}

export function formatSilver(silver: number): string {
    // let amount = Math.abs(silver);
    // if (amount >= 1_000_000_000) {
    //     return `${roundToDecimalPlaces(silver / 1_000_000_000, 3)}B`;
    // }
    // if (amount >= 1_000_000) {
    //     return `${roundToDecimalPlaces(silver / 1_000_000, 3)}M`;
    // }
    // if (amount >= 1000) {
    //     return `${roundToDecimalPlaces(silver / 1000)}K`;
    // }
    return silver.toString();
}

/**
 * Calculates a numeric amount based on a string input and an available amount.
 *
 * Supports:
 * - "all": Returns the full available amount.
 * - Percentage (e.g., "50%"): Returns the specified percentage of the available amount.
 * - Numeric values with optional suffixes: "k", "m", "b".
 * - Plain numeric values.
 * - Delta values (e.g., "+100", "-50") if allowDelta is true.
 * - "to:X" (e.g., "to:1000"): Calculates the required buy-in to reach X silver after payout.
 * - "k:X" (e.g., "k:100"): Keeps X silver in balance and joins with the rest.
 *
 * @param amountStr - The input string representing the desired amount.
 * @param availableAmount - The maximum available amount to calculate against.
 * @param currentAmount - The current amount (for delta calculations).
 * @param allowDelta - Whether to allow "+amount" or "-amount" syntax.
 * @param payoutRate - The payout rate for "to:X" calculations.
 * @returns The calculated amount as a number, clamped between 0 and availableAmount.
 */
export function calculateAmount(amountStr: string, availableAmount: number, currentAmount?: number, allowDelta = true, payoutRate?: number): number {
    const cleanedAmountStr = amountStr.trim().toLowerCase();
    let isDelta = false;
    let sign = 1;
    let amountPart = cleanedAmountStr;

    // Handle "to:X" syntax
    if (cleanedAmountStr.startsWith("to:")) {
        if (!payoutRate || payoutRate <= 1) return 0;
        // Parse the target value (support K/M/B suffixes)
        const targetStr = cleanedAmountStr.slice(3);
        const match = targetStr.match(/^(\d+(\.\d+)?)([kmb])?$/);
        if (match) {
            let target = parseFloat(match[1]);
            const suffix = match[3];
            if (suffix === "k") target *= 1_000;
            else if (suffix === "m") target *= 1_000_000;
            else if (suffix === "b") target *= 1_000_000_000;
            const totalAvailable = availableAmount; // this is balance+buyin for update, or just balance for new join
            // The user wants: (buyin * payoutRate) + (totalAvailable - buyin) = target
            // => buyin * (payoutRate - 1) = target - totalAvailable
            // => buyin = (target - totalAvailable) / (payoutRate - 1)
            let requiredBuyin = Math.floor((target - totalAvailable) / (payoutRate - 1));
            // Clamp between 0 and totalAvailable
            if (requiredBuyin < 0) requiredBuyin = 0;
            if (requiredBuyin > totalAvailable) requiredBuyin = totalAvailable;
            return requiredBuyin;
        }
        return 0;
    }

    // Handle "k:X" syntax (keep X in balance, join with the rest)
    if (cleanedAmountStr.startsWith("k:")) {
        // Parse the keep value (support K/M/B suffixes)
        const keepStr = cleanedAmountStr.slice(2);
        const match = keepStr.match(/^(\d+(\.\d+)?)([kmb])?$/);
        if (match) {
            let keep = parseFloat(match[1]);
            const suffix = match[3];
            if (suffix === "k") keep *= 1_000;
            else if (suffix === "m") keep *= 1_000_000;
            else if (suffix === "b") keep *= 1_000_000_000;
            let joinAmount = availableAmount - keep;
            if (joinAmount < 0) joinAmount = 0;
            if (joinAmount > availableAmount) joinAmount = availableAmount;
            return Math.round(joinAmount);
        }
        return 0;
    }

    // If allowDelta is false, reject any string starting with + or -
    if (!allowDelta && (cleanedAmountStr.startsWith("+") || cleanedAmountStr.startsWith("-"))) {
        return 0;
    }

    if (allowDelta && (cleanedAmountStr.startsWith("+") || cleanedAmountStr.startsWith("-"))) {
        isDelta = true;
        sign = cleanedAmountStr.startsWith("-") ? -1 : 1;
        amountPart = cleanedAmountStr.slice(1); // Remove the '+' or '-'
    } else if (cleanedAmountStr.startsWith("-")) {
        // Handle negative numbers when delta is not explicitly allowed/used (e.g., "-50")
        // Treat them as invalid absolute values -> 0
        return 0;
    }

    let calculatedValue: number;

    if (amountPart === "all") {
        // 'all' doesn't make sense for delta, treat as absolute
        calculatedValue = availableAmount;
        isDelta = false; // Override delta flag
    } else if (amountPart.endsWith("%")) {
        const percentage = parseFloat(amountPart.slice(0, -1));
        if (isNaN(percentage)) {
            calculatedValue = 0;
        } else {
            // Percentage base depends on whether it's a delta calculation with a current amount
            const baseForPercent = isDelta && typeof currentAmount === "number" ? currentAmount : availableAmount;
            calculatedValue = Math.round((percentage / 100) * baseForPercent);
        }
    } else {
        // Try to parse K/M/B suffixes or plain number
        const match = amountPart.match(/^(\d+(\.\d+)?)([kmb])?$/);
        if (match) {
            let num = parseFloat(match[1]);
            const suffix = match[3];
            if (suffix === "k") num *= 1_000;
            else if (suffix === "m") num *= 1_000_000;
            else if (suffix === "b") num *= 1_000_000_000;
            calculatedValue = Math.round(num);
        } else {
            // If regex doesn't match, it's invalid (don't fallback to parseInt)
            calculatedValue = 0;
        }
    }

    // Apply delta logic if applicable
    if (isDelta && typeof currentAmount === "number") {
        const result = currentAmount + sign * Math.abs(calculatedValue);
        // Clamp delta result
        return Math.max(0, Math.min(Math.round(result), availableAmount));
    } else {
        // Treat as absolute value or delta without currentAmount
        // Clamp the absolute magnitude
        return Math.max(0, Math.min(calculatedValue, availableAmount));
    }
}

/**
 * Generates a random number following a normal (Gaussian) distribution
 * using the Box-Muller transform.
 *
 * @param mean - The mean (μ) of the normal distribution. Defaults to 0.
 * @param stdDev - The standard deviation (σ) of the normal distribution. Defaults to 1.
 * @param min - The minimum value to return. Ensures the result is not less than this value. Defaults to 0.01.
 * @returns A random number following the specified normal distribution, constrained to be at least `min`.
 *
 * @remarks
 * This function uses two uniformly distributed random numbers to generate
 * a normally distributed random number. The result is scaled and shifted
 * based on the provided mean and standard deviation.
 *
 * @example
 * ```typescript
 * const randomValue = boxMullerTransform(5, 2, 1);
 * console.log(randomValue); // Outputs a random number with mean 5, stdDev 2, and minimum 1
 * ```
 */
export function boxMullerTransform(mean = 0, stdDev = 1, min = 0.01) {
    // Generate two uniform random numbers between 0 and 1
    let u1 = 0,
        u2 = 0;

    // Make sure u1 is not 0 to avoid log(0)
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();

    // Perform Box-Muller transform
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Scale and shift by mean and standard deviation
    return Math.max(min, z0 * stdDev + mean);
}

export function limitMessageLength(message: string): string {
    if (message.length > 1440) {
        return message.slice(0, 1439) + "…";
    }
    return message;
}

export function limitAdvMessage(base: string, advMsg: string): string {
    const maxLen = 1440 - base.length;
    if (advMsg.length > maxLen) {
        const suffix = " and others…";
        return advMsg.slice(0, Math.max(0, maxLen - suffix.length)) + suffix;
    }
    return advMsg;
}

export function sendMessageToChannel(channel: string, message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    console.log(`Sending message to ${channel}: ${message}`);
    GetBot()
        ?.say(channel, message)
        .catch(err => {
            console.error(`Error sending message to ${channel}:`, err);
        });
}
export function sendActionToChannel(channel: string, message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    console.log(`Sending message to ${channel}: ${message}`);
    GetBot()
        ?.action(channel, message)
        .catch(err => {
            console.error(`Error sending message to ${channel}:`, err);
        });
}

export function sendMessageToAllChannel(message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const { channels } = getBotConfig();
    for (const channel of channels) {
        console.log(`Sending message to ${channel}: ${message}`);
        GetBot()
            ?.say(channel, message)
            .catch(err => {
                console.error(`Error sending message to ${channel}:`, err);
            });
    }
}
export function sendActionToAllChannel(message: string) {
    // Placeholder function to send a message to a channel
    // Replace with actual implementation
    const { channels } = getBotConfig();
    for (const channel of channels) {
        console.log(`Sending message to ${channel}: ${message}`);
        GetBot()
            ?.action(channel, message)
            .catch(err => {
                console.error(`Error sending message to ${channel}:`, err);
            });
    }
}

export function calculateWinStreakBonus(streak: number, wager: number): number {
    if (streak <= 2) return 0;
    if (wager < 100) return 0; // Minimum 100 silver wager required for streak bonus
    return Math.min((streak - 2) * 100, 1000);
}

export function calculateLoseStreakBonus(streak: number, wager: number): number {
    if (streak <= 2) return 0;
    if (wager < 100) return 0; // Minimum 100 silver wager required for streak bonus
    return Math.min((streak - 2) * 50, 500);
}
