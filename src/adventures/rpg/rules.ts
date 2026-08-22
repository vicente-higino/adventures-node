import { AdventureCheck } from "./checks";
import { SeedPart, rollPlayerD20 } from "./random";

export const ADVENTURE_DC = 11;
export const MIN_MODIFIER = -4;
export const MAX_MODIFIER = 4;
export const MIN_SUCCESS_CHANCE = 30;
export const MAX_SUCCESS_CHANCE = 70;
export const MIN_PAYOUT_CHANCE_CAP = 55;

export type ModifierSourceKind = "class" | "item" | "status" | "consumable" | "party" | "other";

export interface ModifierEntry {
    readonly code: string;
    readonly label: string;
    readonly source: ModifierSourceKind;
    readonly modifier: number;
}

export interface AppliedModifierEntry extends ModifierEntry {
    readonly appliedModifier: number;
}

export interface ModifierBreakdown {
    readonly entries: readonly AppliedModifierEntry[];
    readonly rawTotal: number;
    readonly clampedTotal: number;
    readonly effectiveModifier: number;
    readonly baseChancePercent: number;
    readonly payoutChanceCapPercent: number;
    readonly chancePercent: number;
    readonly modifierWasClamped: boolean;
    readonly payoutWasCapped: boolean;
}

export type CriticalRoll = "critical-success" | "critical-failure" | null;

export interface AdventureCheckResolution {
    readonly check: AdventureCheck;
    readonly dc: typeof ADVENTURE_DC;
    readonly roll: number;
    readonly modifier: number;
    readonly total: number;
    readonly chancePercent: number;
    readonly success: boolean;
    readonly critical: CriticalRoll;
    readonly modifierBreakdown: ModifierBreakdown;
}

export interface ResolveAdventureCheckInput {
    readonly adventureSeed: SeedPart;
    readonly playerId: SeedPart;
    readonly check: AdventureCheck;
    readonly payoutRate: number;
    readonly modifiers?: readonly ModifierEntry[];
}

export function clampModifier(modifier: number): number {
    if (!Number.isFinite(modifier)) throw new RangeError("Modifier must be finite");
    return Math.max(MIN_MODIFIER, Math.min(MAX_MODIFIER, Math.trunc(modifier)));
}

export function successChanceForModifier(modifier: number): number {
    return 50 + clampModifier(modifier) * 5;
}

/** Payout-aware ceiling, bounded to 55-70% for supported adventure rates. */
export function payoutAwareChanceCap(payoutRate: number): number {
    if (!Number.isFinite(payoutRate) || payoutRate <= 0) throw new RangeError("Payout rate must be finite and greater than zero");
    return Math.max(MIN_PAYOUT_CHANCE_CAP, Math.min(MAX_SUCCESS_CHANCE, Math.floor((1 / payoutRate) * 20) * 5));
}

export function successChance(modifier: number, payoutRate = 1): number {
    const rawChance = successChanceForModifier(modifier);
    const applicablePayoutCap = Math.max(MIN_SUCCESS_CHANCE, payoutAwareChanceCap(payoutRate));
    return Math.max(MIN_SUCCESS_CHANCE, Math.min(rawChance, applicablePayoutCap));
}

function modifierForChance(chancePercent: number): number {
    return clampModifier((chancePercent - 50) / 5);
}

export function calculateModifierBreakdown(entries: readonly ModifierEntry[], payoutRate = 1): ModifierBreakdown {
    for (const entry of entries) {
        if (!entry.code.trim() || !entry.label.trim()) throw new Error("Modifier entries require a code and label");
        if (!Number.isFinite(entry.modifier) || !Number.isInteger(entry.modifier))
            throw new RangeError("Modifier entry values must be finite integers");
    }

    const rawTotal = entries.reduce((total, entry) => total + entry.modifier, 0);
    const clampedTotal = clampModifier(rawTotal);
    const baseChancePercent = successChanceForModifier(clampedTotal);
    const payoutChanceCapPercent = payoutAwareChanceCap(payoutRate);
    const chancePercent = successChance(clampedTotal, payoutRate);
    const effectiveModifier = modifierForChance(chancePercent);
    let remaining = effectiveModifier;
    const appliedEntries = entries.map(entry => {
        const desired = entry.modifier;
        let appliedModifier = 0;

        if (desired > 0 && remaining > 0) {
            appliedModifier = Math.min(desired, remaining);
            remaining -= appliedModifier;
        } else if (desired < 0 && remaining < 0) {
            appliedModifier = Math.max(desired, remaining);
            remaining -= appliedModifier;
        }

        return { ...entry, appliedModifier };
    });

    return {
        entries: appliedEntries,
        rawTotal,
        clampedTotal,
        effectiveModifier,
        baseChancePercent,
        payoutChanceCapPercent,
        chancePercent,
        modifierWasClamped: rawTotal !== clampedTotal,
        payoutWasCapped: chancePercent < baseChancePercent,
    };
}

export function resolveAdventureCheck(input: ResolveAdventureCheckInput): AdventureCheckResolution {
    const modifierBreakdown = calculateModifierBreakdown(input.modifiers ?? [], input.payoutRate);
    const roll = rollPlayerD20(input.adventureSeed, input.playerId);
    const total = roll + modifierBreakdown.effectiveModifier;

    return {
        check: input.check,
        dc: ADVENTURE_DC,
        roll,
        modifier: modifierBreakdown.effectiveModifier,
        total,
        chancePercent: modifierBreakdown.chancePercent,
        success: total >= ADVENTURE_DC,
        critical: roll === 20 ? "critical-success" : roll === 1 ? "critical-failure" : null,
        modifierBreakdown,
    };
}
