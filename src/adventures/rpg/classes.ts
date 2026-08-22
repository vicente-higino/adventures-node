import { AdventureCheck } from "./checks";

export const ADVENTURE_CLASS_CODES = [
    "warrior",
    "barbarian",
    "guardian",
    "rogue",
    "ranger",
    "monk",
    "wizard",
    "warlock",
    "cleric",
    "druid",
    "bard",
    "paladin",
    "artificer",
    "engineer",
    "gunslinger",
    "operative",
    "investigator",
    "diplomat",
] as const;

export type AdventureClassCode = (typeof ADVENTURE_CLASS_CODES)[number];

export interface AdventureClassDefinition {
    readonly code: AdventureClassCode;
    readonly name: string;
    readonly description: string;
    readonly proficiencies: readonly [AdventureCheck, AdventureCheck];
    readonly aliases?: readonly string[];
}

export const ADVENTURE_CLASSES: readonly AdventureClassDefinition[] = [
    { code: "warrior", name: "Warrior", description: "A disciplined combatant who holds the line.", proficiencies: ["might", "endurance"] },
    {
        code: "barbarian",
        name: "Barbarian",
        description: "A relentless wanderer who thrives in hostile lands.",
        proficiencies: ["might", "survival"],
    },
    { code: "guardian", name: "Guardian", description: "A steadfast protector with uncommon resolve.", proficiencies: ["endurance", "spirit"] },
    { code: "rogue", name: "Rogue", description: "A nimble infiltrator who prefers unseen routes.", proficiencies: ["agility", "stealth"] },
    { code: "ranger", name: "Ranger", description: "An alert pathfinder at home beyond the map.", proficiencies: ["survival", "perception"] },
    { code: "monk", name: "Monk", description: "A focused traveler who pairs motion with discipline.", proficiencies: ["agility", "spirit"] },
    { code: "wizard", name: "Wizard", description: "A learned spellcaster who studies dangerous mysteries.", proficiencies: ["arcana", "knowledge"] },
    { code: "warlock", name: "Warlock", description: "An occult negotiator wielding forbidden power.", proficiencies: ["arcana", "deception"] },
    { code: "cleric", name: "Cleric", description: "A keeper of sacred lore and spiritual wards.", proficiencies: ["spirit", "knowledge"] },
    { code: "druid", name: "Druid", description: "A mystic attuned to wilderness and primal magic.", proficiencies: ["survival", "arcana"] },
    { code: "bard", name: "Bard", description: "A magnetic storyteller skilled at misdirection.", proficiencies: ["presence", "deception"] },
    { code: "paladin", name: "Paladin", description: "A formidable champion driven by conviction.", proficiencies: ["might", "spirit"] },
    {
        code: "artificer",
        name: "Artificer",
        description: "An inventor who turns theory into remarkable tools.",
        proficiencies: ["technology", "knowledge"],
    },
    {
        code: "engineer",
        name: "Engineer",
        description: "A practical builder who keeps machines running under pressure.",
        proficiencies: ["technology", "endurance"],
    },
    { code: "gunslinger", name: "Gunslinger", description: "A quick-handed scout with an eye for danger.", proficiencies: ["agility", "perception"] },
    {
        code: "operative",
        name: "Operative",
        description: "A covert specialist comfortable behind enemy lines.",
        proficiencies: ["stealth", "deception"],
    },
    {
        code: "investigator",
        name: "Investigator",
        description: "A patient analyst who notices what others miss.",
        proficiencies: ["perception", "knowledge"],
    },
    { code: "diplomat", name: "Diplomat", description: "A perceptive envoy who can redirect a room.", proficiencies: ["presence", "perception"] },
] as const;

const CLASS_BY_CODE: ReadonlyMap<AdventureClassCode, AdventureClassDefinition> = new Map(
    ADVENTURE_CLASSES.map(definition => [definition.code, definition]),
);

const CLASS_BY_INPUT: ReadonlyMap<string, AdventureClassDefinition> = new Map(
    ADVENTURE_CLASSES.flatMap(definition =>
        [definition.code, definition.name, ...(definition.aliases ?? [])].map(value => [normalizeClassInput(value), definition] as const),
    ),
);

function normalizeClassInput(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
}

export function isAdventureClassCode(value: unknown): value is AdventureClassCode {
    return typeof value === "string" && (ADVENTURE_CLASS_CODES as readonly string[]).includes(value);
}

export function getAdventureClass(code: AdventureClassCode): AdventureClassDefinition {
    const definition = CLASS_BY_CODE.get(code);
    if (!definition) throw new Error(`Unknown adventure class: ${code}`);
    return definition;
}

export function parseAdventureClass(value: string): AdventureClassDefinition | undefined {
    return CLASS_BY_INPUT.get(normalizeClassInput(value));
}

export function formatAdventureClassNames(): string {
    return ADVENTURE_CLASSES.map(definition => definition.name).join(", ");
}

export function isClassProficient(classCode: AdventureClassCode, check: AdventureCheck): boolean {
    return getAdventureClass(classCode).proficiencies.includes(check);
}
