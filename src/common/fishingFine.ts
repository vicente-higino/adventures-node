// Edit these upper limits and marginal rates to adjust the progressive fine.
export const FISHING_FINE_BRACKETS = [
    { upTo: 500, ratePercent: 1 },
    { upTo: 1_000, ratePercent: 1.25 },
    { upTo: 2_500, ratePercent: 1.5 },
    { upTo: 5_000, ratePercent: 1.75 },
    { upTo: 10_000, ratePercent: 2 },
    { upTo: 25_000, ratePercent: 2.5 },
    { upTo: 50_000, ratePercent: 3 },
    { upTo: 100_000, ratePercent: 3.5 },
    { upTo: Infinity, ratePercent: 4 },
] as const;

const BASE_FISHING_FINE_CHANCE = 0.01;
const FISHING_FINE_CHANCE_REDUCTION_PER_ROD_LEVEL = 0.0005;
const MIN_FISHING_FINE_CHANCE = 0.005;

export function getFishingFineChance(rodLevel: number): number {
    return Math.max(MIN_FISHING_FINE_CHANCE, BASE_FISHING_FINE_CHANCE - Math.max(0, rodLevel) * FISHING_FINE_CHANCE_REDUCTION_PER_ROD_LEVEL);
}

export function formatFishingFineRates(): string {
    let lowerLimit = 0;

    const brackets = FISHING_FINE_BRACKETS.map(bracket => {
        const range =
            bracket.upTo === Infinity
                ? `${(lowerLimit + 1).toLocaleString()}+`
                : lowerLimit === 0
                  ? `<=${bracket.upTo.toLocaleString()}`
                  : `${(lowerLimit + 1).toLocaleString()}-${bracket.upTo.toLocaleString()}`;
        lowerLimit = bracket.upTo;
        return `${range}: ${bracket.ratePercent}%`;
    });

    return `Fishing fines (progressive): ${brackets.join(" | ")}. Final fine varies 50-150%.`;
}

export function calculateFishingFine(silverNetWorth: number): number {
    let lowerLimit = 0;
    let fine = 0;

    for (const bracket of FISHING_FINE_BRACKETS) {
        const taxableSilver = Math.max(0, Math.min(silverNetWorth, bracket.upTo) - lowerLimit);
        fine += taxableSilver * (bracket.ratePercent / 100);
        lowerLimit = bracket.upTo;

        if (silverNetWorth <= bracket.upTo) {
            break;
        }
    }

    return Math.floor(fine);
}

export function calculateRandomFishingFine(silverNetWorth: number, random: () => number = Math.random): number {
    const { minimumFine, maximumFine } = getFishingFineAmountRange(silverNetWorth);
    if (maximumFine <= 0) {
        return 0;
    }

    return minimumFine + Math.floor(random() * (maximumFine - minimumFine + 1));
}

export function getFishingFineAmountRange(silverNetWorth: number): { minimumFine: number; maximumFine: number } {
    const baseFine = calculateFishingFine(silverNetWorth);
    if (baseFine <= 0) {
        return { minimumFine: 0, maximumFine: 0 };
    }

    const minimumFine = Math.max(1, Math.ceil(baseFine * 0.5));
    const maximumFine = Math.max(minimumFine, Math.floor(baseFine * 1.5));
    return { minimumFine, maximumFine };
}

export function formatUserFishingFineRates(userDisplayName: string, silverBalance: number, rodLevel: number): string {
    const bracketIndex = FISHING_FINE_BRACKETS.findIndex(bracket => silverBalance <= bracket.upTo);
    const bracket = FISHING_FINE_BRACKETS[bracketIndex === -1 ? FISHING_FINE_BRACKETS.length - 1 : bracketIndex];
    const { minimumFine, maximumFine } = getFishingFineAmountRange(silverBalance);
    const fineText = maximumFine > 0 ? ` Estimated fine: ${minimumFine.toLocaleString()}-${maximumFine.toLocaleString()} silver.` : "";
    const catchChance = `${(getFishingFineChance(rodLevel) * 100).toLocaleString()}%`;

    return `@${userDisplayName}: ${bracket.ratePercent}% marginal rate, ${catchChance} catch chance.${fineText}`;
}
