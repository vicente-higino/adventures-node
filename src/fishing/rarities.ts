import logger from "@/logger";
import { RARITY_WEIGHTS_DEFAULT, Rarity, RarityWeights } from "./constants";
import { roundToDecimalPlaces } from "@/utils/misc";
import { getRod } from "@/fishing";

let rarityWeights: Record<Rarity, number> = { ...RARITY_WEIGHTS_DEFAULT };

export function getRarityWeights(rodLevel: number = 0): Record<Rarity, number> {
    // return a shallow copy to avoid external mutation
    const rod = getRod(rodLevel);
    const weights = createRarityWeights(rod.weightModifier, rarityWeights);
    logger.debug(`Rarity weights for rod level ${rodLevel} (${rod.name}): ${formatRarityWeightDisplay(weights)}`);
    return weights;
}

export function setRarityWeights(weights: Record<Rarity, number>) {
    rarityWeights = { ...weights };
}

export function modifyRarityWeights(
    changes: Partial<Record<Rarity, number | ((current: number) => number)>>,
    baseWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT,
): void {
    const newWeights: Record<Rarity, number> = { ...baseWeights };
    for (const key in changes) {
        if (changes[key as Rarity] !== undefined) {
            const current = baseWeights[key as Rarity];
            const change = changes[key as Rarity];
            newWeights[key as Rarity] = typeof change === "function" ? (change as any)(current) : (change as number);
        }
    }
    logger.debug(formatRarityWeightDisplay(newWeights));
    setRarityWeights(newWeights);
}
export function createRarityWeights(
    changes: Partial<Record<Rarity, number | ((current: number) => number)>>,
    baseWeights: Record<Rarity, number> = RARITY_WEIGHTS_DEFAULT,
): RarityWeights {
    const newWeights: Record<Rarity, number> = { ...baseWeights };
    for (const key in changes) {
        if (changes[key as Rarity] !== undefined) {
            const current = baseWeights[key as Rarity];
            const change = changes[key as Rarity];
            newWeights[key as Rarity] = typeof change === "function" ? (change as any)(current) : (change as number);
        }
    }
    return newWeights;
}

export function resetRarityWeights() {
    setRarityWeights(RARITY_WEIGHTS_DEFAULT);
}

export function weightToChance(weight: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (weight / totalWeight) * 100;
}
function chanceToWeight(chance: number, totalWeight: number = getTotalWeight(rarityWeights)): number {
    return (chance / 100) * totalWeight;
}
export function getTotalWeight(weights: Record<Rarity, number> = rarityWeights): number {
    return Object.values(weights).reduce((total, w) => total + w, 0);
}
export function getChanceByRarity(rarity: Rarity, weights: Record<Rarity, number> = rarityWeights): number {
    const totalWeight = getTotalWeight(weights);
    return weightToChance(weights[rarity], totalWeight);
}
export function getRarityByChance(chance: number, weights: Record<Rarity, number> = rarityWeights): Rarity | null {
    const totalWeight = getTotalWeight(weights);
    const weight = chanceToWeight(chance, totalWeight);
    for (const [rarity, w] of Object.entries(weights)) {
        if (w >= weight) {
            return rarity as Rarity;
        }
    }
    return null;
}
export function formatRarityWeightDisplay(weights: Record<Rarity, number> = rarityWeights): string {
    const totalWeight = getTotalWeight(weights);
    return Object.entries(weights)
        .map(([rarity, weight]) => `${rarity}: ${roundToDecimalPlaces(weightToChance(weight, totalWeight), 2).toFixed(2)}%`)
        .join(", ");
}
