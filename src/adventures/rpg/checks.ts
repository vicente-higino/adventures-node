export const ADVENTURE_CHECKS = [
    "might",
    "agility",
    "endurance",
    "stealth",
    "survival",
    "perception",
    "knowledge",
    "technology",
    "arcana",
    "spirit",
    "presence",
    "deception",
] as const;

export type AdventureCheck = (typeof ADVENTURE_CHECKS)[number];

export const ADVENTURE_CHECK_LABELS: Readonly<Record<AdventureCheck, string>> = {
    might: "Might",
    agility: "Agility",
    endurance: "Endurance",
    stealth: "Stealth",
    survival: "Survival",
    perception: "Perception",
    knowledge: "Knowledge",
    technology: "Technology",
    arcana: "Arcana",
    spirit: "Spirit",
    presence: "Presence",
    deception: "Deception",
};

export function isAdventureCheck(value: unknown): value is AdventureCheck {
    return typeof value === "string" && (ADVENTURE_CHECKS as readonly string[]).includes(value);
}

export function parseAdventureCheck(value: string): AdventureCheck | undefined {
    const normalized = value.trim().toLowerCase();
    return isAdventureCheck(normalized) ? normalized : undefined;
}

export function formatAdventureCheckModifiers(checks: readonly AdventureCheck[], modifier: number): string {
    const signedModifier = `${modifier >= 0 ? "+" : ""}${modifier}`;
    return checks.map(check => `${ADVENTURE_CHECK_LABELS[check]} ${signedModifier}`).join(", ");
}
