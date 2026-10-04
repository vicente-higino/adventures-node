import { AdventureItemDefinition, AdventureItemRarity, getAdventureItemModifier } from "@/adventures/rpg";

export const ADVENTURE_LOOT_SILVER_BY_RARITY: Readonly<Record<AdventureItemRarity, number>> = {
    common: 1_000,
    uncommon: 5_000,
    rare: 10_000,
    epic: 50_000,
};

export interface OwnedAdventureLoot {
    code: string;
    quantity: number;
    active: boolean;
    equipment: boolean;
    theme: string | null;
    modifier: number;
}

export type AdventureLootConversionReason = "duplicate" | "inactive" | "not-equipment" | "weaker-theme-buff";

export type AdventureLootEligibility =
    | { eligible: true; modifier: number }
    | { eligible: false; reason: AdventureLootConversionReason; silverBonus: number };

/** Keeps only loot that can immediately improve the player's strongest bonus for its theme. */
export function evaluateAdventureLootEligibility(
    candidate: AdventureItemDefinition,
    persistedItemActive: boolean,
    ownedItems: readonly OwnedAdventureLoot[],
): AdventureLootEligibility {
    const silverBonus = ADVENTURE_LOOT_SILVER_BY_RARITY[candidate.rarity];
    const convert = (reason: AdventureLootConversionReason): AdventureLootEligibility => ({ eligible: false, reason, silverBonus });

    if (!persistedItemActive) return convert("inactive");
    if (candidate.kind !== "equipment") return convert("not-equipment");
    if (ownedItems.some(item => item.quantity > 0 && item.code === candidate.id)) return convert("duplicate");

    const modifier = getAdventureItemModifier(candidate);
    if (ownedItems.some(item => item.quantity > 0 && item.active && item.equipment && item.theme === candidate.theme && item.modifier >= modifier)) {
        return convert("weaker-theme-buff");
    }

    return { eligible: true, modifier };
}

export function getConvertedLootSilver(snapshot: unknown): number {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return 0;
    const convertedToSilver = (snapshot as Record<string, unknown>).convertedToSilver;
    return typeof convertedToSilver === "number" && Number.isSafeInteger(convertedToSilver) && convertedToSilver > 0 ? convertedToSilver : 0;
}
