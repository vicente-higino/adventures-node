import { adventureCatalog, AdventureApproach, AdventureCatalogEntry, selectRaidAdventure, selectRegularAdventure } from "@/adventures/catalog";
import { AdventureCheck, isAdventureCheck } from "@/adventures/rpg";

export interface AdventureLoadoutItemSnapshot {
    code: string;
    name: string;
    slot: string;
    theme: string | null;
    checkCode: string | null;
    modifier: number;
}

export interface AdventureLoadoutSnapshot {
    classCode: string | null;
    proficiencies: readonly string[];
    equippedItems: readonly AdventureLoadoutItemSnapshot[];
    capturedAt: string;
}

export interface StoredAdventureScenario {
    title: string;
    intro: string;
    theme: string;
    kind: "regular" | "raid";
    presentationMode: "individual" | "grouped";
    approaches: readonly AdventureApproach[];
}

export function selectNewAdventureScenario(raid = false): { entry: AdventureCatalogEntry; context: StoredAdventureScenario } {
    const entry = raid ? selectRaidAdventure() : selectRegularAdventure();
    return {
        entry,
        context: {
            title: entry.title,
            intro: entry.description(),
            theme: entry.themeId,
            kind: entry.kind,
            presentationMode: entry.presentationMode,
            approaches: entry.approaches,
        },
    };
}

export function getCatalogAdventure(scenarioId: string | null | undefined): AdventureCatalogEntry | undefined {
    return scenarioId ? adventureCatalog.find(entry => entry.id === scenarioId) : undefined;
}

export function parseStoredAdventureScenario(value: unknown): StoredAdventureScenario | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const candidate = value as Partial<StoredAdventureScenario>;
    if (
        typeof candidate.title !== "string" ||
        typeof candidate.intro !== "string" ||
        typeof candidate.theme !== "string" ||
        (candidate.kind !== "regular" && candidate.kind !== "raid") ||
        (candidate.presentationMode !== "individual" && candidate.presentationMode !== "grouped") ||
        !Array.isArray(candidate.approaches)
    ) {
        return undefined;
    }
    const approaches = candidate.approaches.filter((approach): approach is AdventureApproach =>
        Boolean(
            approach &&
                typeof approach === "object" &&
                typeof approach.id === "string" &&
                typeof approach.label === "string" &&
                isAdventureCheck(approach.check),
        ),
    );
    if (approaches.length !== candidate.approaches.length || approaches.length === 0) return undefined;
    return {
        title: candidate.title,
        intro: candidate.intro,
        theme: candidate.theme,
        kind: candidate.kind,
        presentationMode: candidate.presentationMode,
        approaches,
    };
}

export function resolveAdventureApproach(
    scenario: StoredAdventureScenario,
    requested: string | undefined,
    loadout: AdventureLoadoutSnapshot,
): AdventureApproach | undefined {
    const normalized = requested?.trim().toLowerCase();
    if (normalized && normalized !== "auto") {
        return scenario.approaches.find(
            approach => approach.id.toLowerCase() === normalized || approach.check === normalized || approach.label.toLowerCase() === normalized,
        );
    }

    const score = (check: AdventureCheck): number => {
        const classBonus = loadout.proficiencies.includes(check) ? 1 : 0;
        const itemBonus = loadout.equippedItems
            .filter(
                item =>
                    item.checkCode === check &&
                    (!item.theme || item.theme === "all" || scenario.theme === "special" || item.theme === scenario.theme),
            )
            .reduce((total, item) => total + item.modifier, 0);
        return classBonus + itemBonus;
    };
    return [...scenario.approaches].sort((left, right) => score(right.check) - score(left.check))[0];
}

export function formatAdventureApproaches(scenario: StoredAdventureScenario): string {
    return scenario.approaches.map(approach => `${approach.id} [${approach.check}]`).join(" | ");
}
