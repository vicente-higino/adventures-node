import { AdventureCheck } from "./checks";

export const ADVENTURE_THEME_CODES = [
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

export type AdventureThemeCode = (typeof ADVENTURE_THEME_CODES)[number];

export interface AdventureStatusDefinition {
    readonly code: string;
    readonly label: string;
    readonly description: string;
    readonly modifier: -1 | 1;
    readonly affectedChecks: readonly AdventureCheck[];
    readonly durationAdventures: number;
}

export interface AdventureThemeDefinition {
    readonly code: AdventureThemeCode;
    readonly name: string;
    readonly emoji: string;
    readonly relevantChecks: readonly AdventureCheck[];
    readonly criticalFailureStatus: AdventureStatusDefinition;
}

export const ADVENTURE_THEMES: readonly AdventureThemeDefinition[] = [
    {
        code: "fantasy",
        name: "Fantasy",
        emoji: "🧙",
        relevantChecks: ["might", "arcana", "knowledge", "spirit", "stealth"],
        criticalFailureStatus: {
            code: "fantasy.arcane-burn",
            label: "Arcane Burn",
            description: "Unstable magic clouds the adventurer's control during their next expedition.",
            modifier: -1,
            affectedChecks: ["arcana", "knowledge"],
            durationAdventures: 1,
        },
    },
    {
        code: "sci-fi",
        name: "Sci-Fi",
        emoji: "🚀",
        relevantChecks: ["technology", "agility", "endurance", "knowledge", "perception"],
        criticalFailureStatus: {
            code: "sci-fi.disoriented",
            label: "Disoriented",
            description: "A temporal distortion makes instruments and instincts difficult to trust.",
            modifier: -1,
            affectedChecks: ["knowledge", "perception"],
            durationAdventures: 1,
        },
    },
    {
        code: "cyberpunk",
        name: "Cyberpunk",
        emoji: "🌃",
        relevantChecks: ["technology", "stealth", "deception", "agility", "presence"],
        criticalFailureStatus: {
            code: "cyberpunk.glitched",
            label: "Glitched",
            description: "Corrupted augment firmware interferes with the next operation.",
            modifier: -1,
            affectedChecks: ["technology", "agility"],
            durationAdventures: 1,
        },
    },
    {
        code: "mythological",
        name: "Mythological",
        emoji: "⚡",
        relevantChecks: ["might", "spirit", "knowledge", "arcana", "endurance"],
        criticalFailureStatus: {
            code: "mythological.god-marked",
            label: "God-Marked",
            description: "A displeased deity tests the adventurer's strength and resolve.",
            modifier: -1,
            affectedChecks: ["might", "spirit"],
            durationAdventures: 1,
        },
    },
    {
        code: "post-apocalyptic",
        name: "Post-Apocalyptic",
        emoji: "☢️",
        relevantChecks: ["survival", "endurance", "technology", "perception", "might"],
        criticalFailureStatus: {
            code: "post-apocalyptic.irradiated",
            label: "Irradiated",
            description: "Exposure leaves the adventurer weakened for their next journey.",
            modifier: -1,
            affectedChecks: ["endurance", "survival"],
            durationAdventures: 1,
        },
    },
    {
        code: "pirate",
        name: "Pirate",
        emoji: "🏴‍☠️",
        relevantChecks: ["survival", "agility", "endurance", "presence", "deception"],
        criticalFailureStatus: {
            code: "pirate.seasick",
            label: "Seasick",
            description: "Rough seas leave the adventurer unsteady on the next voyage.",
            modifier: -1,
            affectedChecks: ["agility", "endurance"],
            durationAdventures: 1,
        },
    },
    {
        code: "steampunk",
        name: "Steampunk",
        emoji: "⚙️",
        relevantChecks: ["technology", "knowledge", "agility", "perception", "presence"],
        criticalFailureStatus: {
            code: "steampunk.soot-blinded",
            label: "Soot-Blinded",
            description: "A boiler burst obscures fine details during the next mission.",
            modifier: -1,
            affectedChecks: ["perception", "technology"],
            durationAdventures: 1,
        },
    },
    {
        code: "superhero",
        name: "Superhero",
        emoji: "🦸",
        relevantChecks: ["might", "agility", "endurance", "spirit", "presence"],
        criticalFailureStatus: {
            code: "superhero.shaken",
            label: "Shaken",
            description: "A public defeat rattles the hero's confidence for one adventure.",
            modifier: -1,
            affectedChecks: ["spirit", "presence"],
            durationAdventures: 1,
        },
    },
    {
        code: "horror",
        name: "Horror",
        emoji: "👻",
        relevantChecks: ["spirit", "perception", "knowledge", "stealth", "endurance"],
        criticalFailureStatus: {
            code: "horror.haunted",
            label: "Haunted",
            description: "Something followed the adventurer home and whispers at the edge of thought.",
            modifier: -1,
            affectedChecks: ["spirit", "perception"],
            durationAdventures: 1,
        },
    },
    {
        code: "western",
        name: "Western",
        emoji: "🤠",
        relevantChecks: ["agility", "presence", "perception", "survival", "deception"],
        criticalFailureStatus: {
            code: "western.rattled",
            label: "Rattled",
            description: "A close call leaves the adventurer's hand and judgment less certain.",
            modifier: -1,
            affectedChecks: ["agility", "perception"],
            durationAdventures: 1,
        },
    },
    {
        code: "spy",
        name: "Spy",
        emoji: "🕵️",
        relevantChecks: ["stealth", "deception", "technology", "presence", "perception"],
        criticalFailureStatus: {
            code: "spy.compromised",
            label: "Compromised",
            description: "The adversary has seen through part of the agent's cover.",
            modifier: -1,
            affectedChecks: ["stealth", "deception"],
            durationAdventures: 1,
        },
    },
    {
        code: "egyptian",
        name: "Egyptian",
        emoji: "𓂀",
        relevantChecks: ["knowledge", "perception", "survival", "spirit", "arcana"],
        criticalFailureStatus: {
            code: "egyptian.cursed",
            label: "Cursed",
            description: "An ancient warning weighs upon the adventurer's next expedition.",
            modifier: -1,
            affectedChecks: ["spirit", "arcana"],
            durationAdventures: 1,
        },
    },
    {
        code: "atlantis",
        name: "Atlantis",
        emoji: "🔱",
        relevantChecks: ["endurance", "survival", "knowledge", "might", "spirit"],
        criticalFailureStatus: {
            code: "atlantis.pressure-sick",
            label: "Pressure-Sick",
            description: "The crushing depths sap the adventurer's stamina and bearings.",
            modifier: -1,
            affectedChecks: ["endurance", "survival"],
            durationAdventures: 1,
        },
    },
    {
        code: "dinosaur",
        name: "Dinosaur",
        emoji: "🦖",
        relevantChecks: ["survival", "might", "agility", "perception", "endurance"],
        criticalFailureStatus: {
            code: "dinosaur.wounded",
            label: "Wounded",
            description: "A prehistoric predator leaves an injury that needs one adventure to mend.",
            modifier: -1,
            affectedChecks: ["might", "agility"],
            durationAdventures: 1,
        },
    },
] as const;

const THEME_BY_CODE: ReadonlyMap<AdventureThemeCode, AdventureThemeDefinition> = new Map(ADVENTURE_THEMES.map(theme => [theme.code, theme]));

export function isAdventureThemeCode(value: unknown): value is AdventureThemeCode {
    return typeof value === "string" && (ADVENTURE_THEME_CODES as readonly string[]).includes(value);
}

export function getAdventureTheme(code: AdventureThemeCode): AdventureThemeDefinition {
    const theme = THEME_BY_CODE.get(code);
    if (!theme) throw new Error(`Unknown adventure theme: ${code}`);
    return theme;
}
