import { raidAdventureCatalog, regularAdventureCatalogByTheme } from "./content";
import { AdventureCatalogEntry, RegularAdventureThemeId } from "./types";

export interface LegacyRegularThemeWeight {
    themeId: RegularAdventureThemeId;
    /** Number of encounter slots the legacy regular catalog gives this theme. */
    weight: number;
}

/**
 * The old engine effectively weighted themes by their number of definitions.
 * Keeping these values explicit preserves that balance while excluding the ten
 * custom/raid stories that previously leaked into small-party selection.
 */
export const LEGACY_REGULAR_THEME_WEIGHTS: readonly LegacyRegularThemeWeight[] = Object.freeze([
    { themeId: "fantasy", weight: 2 },
    { themeId: "sci-fi", weight: 2 },
    { themeId: "cyberpunk", weight: 2 },
    { themeId: "mythological", weight: 2 },
    { themeId: "post-apocalyptic", weight: 4 },
    { themeId: "pirate", weight: 4 },
    { themeId: "steampunk", weight: 3 },
    { themeId: "superhero", weight: 4 },
    { themeId: "horror", weight: 1 },
    { themeId: "western", weight: 4 },
    { themeId: "spy", weight: 4 },
    { themeId: "egyptian", weight: 4 },
    { themeId: "atlantis", weight: 10 },
    { themeId: "dinosaur", weight: 4 },
]);

export const LEGACY_REGULAR_ENCOUNTER_WEIGHT = LEGACY_REGULAR_THEME_WEIGHTS.reduce((total, entry) => total + entry.weight, 0);

export const DEFAULT_RAID_PARTY_SIZE = 12;

function draw(random: () => number): number {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError(`Adventure selection random source must return a finite value from 0 (inclusive) to 1 (exclusive); received ${value}.`);
    }
    return value;
}

function selectAtRandom(entries: readonly AdventureCatalogEntry[], random: () => number): AdventureCatalogEntry {
    if (entries.length === 0) {
        throw new Error("Cannot select an adventure from an empty catalog.");
    }
    return entries[Math.floor(draw(random) * entries.length)];
}

/** Selects only a regular encounter, preserving the legacy definition-count weighting. */
export function selectRegularAdventure(random: () => number = Math.random): AdventureCatalogEntry {
    let slot = draw(random) * LEGACY_REGULAR_ENCOUNTER_WEIGHT;
    let selectedTheme = LEGACY_REGULAR_THEME_WEIGHTS[LEGACY_REGULAR_THEME_WEIGHTS.length - 1].themeId;

    for (const entry of LEGACY_REGULAR_THEME_WEIGHTS) {
        if (slot < entry.weight) {
            selectedTheme = entry.themeId;
            break;
        }
        slot -= entry.weight;
    }

    return selectAtRandom(regularAdventureCatalogByTheme[selectedTheme], random);
}

/** Selects only one of the ten grouped custom encounters. */
export function selectRaidAdventure(random: () => number = Math.random): AdventureCatalogEntry {
    return selectAtRandom(raidAdventureCatalog, random);
}

export interface AdventureAtStartOptions {
    partySize: number;
    raidPartySize?: number;
    random?: () => number;
}

/**
 * Chooses the scenario when an adventure starts, so callers can persist its ID
 * and use the same prose and approaches when it resolves.
 */
export function selectAdventureAtStart({
    partySize,
    raidPartySize = DEFAULT_RAID_PARTY_SIZE,
    random = Math.random,
}: AdventureAtStartOptions): AdventureCatalogEntry {
    if (!Number.isInteger(partySize) || partySize < 0) {
        throw new RangeError(`Party size must be a non-negative integer; received ${partySize}.`);
    }
    if (!Number.isInteger(raidPartySize) || raidPartySize < 1) {
        throw new RangeError(`Raid party size must be a positive integer; received ${raidPartySize}.`);
    }

    return partySize >= raidPartySize ? selectRaidAdventure(random) : selectRegularAdventure(random);
}
