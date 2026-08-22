export const ADVENTURE_CATALOG_VERSION = 1 as const;

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

export const REGULAR_ADVENTURE_THEME_IDS = [
    "fantasy",
    "sci-fi",
    "cyberpunk",
    "mythological",
    "post-apocalyptic",
    "pirate",
    "steampunk",
    "superhero",
    "horror",
    "western",
    "spy",
    "egyptian",
    "atlantis",
    "dinosaur",
] as const;

export type RegularAdventureThemeId = (typeof REGULAR_ADVENTURE_THEME_IDS)[number];
export type AdventureThemeId = RegularAdventureThemeId | "special";
export type AdventurePresentationMode = "individual" | "grouped";
export type AdventureCatalogKind = "regular" | "raid";

/** The structural shape of the prose objects in the legacy theme modules. */
export interface LegacyAdventure {
    description: () => string;
    endWin?: (names?: string) => string;
    endLose?: (names?: string) => string;
    winMessages: ((name: string) => string)[];
    loseMessages: ((name: string) => string)[];
}

export interface AdventureApproach {
    /** Stable command-friendly identifier, such as `navigate`. */
    id: string;
    label: string;
    check: AdventureCheck;
}

export type AdventureApproaches = readonly [AdventureApproach, AdventureApproach, AdventureApproach];

/**
 * Versioned metadata wrapped around an existing adventure. The legacy functions
 * are exposed directly so current prose/rendering can be reused without copying it.
 */
export interface AdventureCatalogEntry extends LegacyAdventure {
    id: `${string}.v${number}`;
    themeId: AdventureThemeId;
    title: string;
    contentVersion: typeof ADVENTURE_CATALOG_VERSION;
    kind: AdventureCatalogKind;
    presentationMode: AdventurePresentationMode;
    approaches: AdventureApproaches;
    /** Exact object exported by the original theme array. */
    legacyAdventure: LegacyAdventure;
}
