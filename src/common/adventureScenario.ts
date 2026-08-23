import { adventureCatalog, AdventureApproach, AdventureCatalogEntry, selectRaidAdventure, selectRegularAdventure } from "@/adventures/catalog";
import { isAdventureCheck } from "@/adventures/rpg";

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

export function getAutomaticAdventureApproach(scenario: StoredAdventureScenario): AdventureApproach {
    return scenario.approaches[0];
}
