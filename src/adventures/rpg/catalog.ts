import { AdventureCheck, isAdventureCheck } from "./checks";
import { ADVENTURE_ITEMS, getAdventureItem } from "./items";
import { pickSeeded, SeedPart } from "./random";
import { AdventureThemeCode, getAdventureTheme, isAdventureThemeCode } from "./themes";

export const ADVENTURE_RULES_VERSION = 2;

export const ADVENTURE_TEMPLATE_PLACEHOLDERS = [
    "player",
    "title",
    "theme",
    "event",
    "location",
    "enemy",
    "objective",
    "item",
    "approach",
    "check",
] as const;

export type AdventureTemplatePlaceholder = (typeof ADVENTURE_TEMPLATE_PLACEHOLDERS)[number];

export interface AdventureContext {
    readonly event: string;
    readonly location: string;
    readonly enemy: string;
    readonly objective: string;
}

export interface AdventureContextOptions {
    readonly events: readonly string[];
    readonly locations: readonly string[];
    readonly enemies: readonly string[];
    readonly objectives: readonly string[];
}

export interface AdventureApproachDefinition {
    readonly code: string;
    readonly label: string;
    readonly check: AdventureCheck;
    readonly winTemplate: string;
    readonly loseTemplate: string;
}

export interface AdventureDefinition {
    readonly id: string;
    readonly contentVersion: number;
    readonly theme: AdventureThemeCode;
    readonly title: string;
    readonly descriptionTemplate: string;
    readonly approaches: readonly AdventureApproachDefinition[];
    readonly contextOptions: AdventureContextOptions;
    readonly lootItemIds: readonly string[];
    readonly criticalFailureStatusCode: string;
    readonly presentation: "individual" | "grouped";
}

export type AdventureCatalog = readonly AdventureDefinition[];

export interface AdventureInstance {
    readonly id: string;
    readonly definitionId: string;
    readonly contentVersion: number;
    readonly rulesVersion: typeof ADVENTURE_RULES_VERSION;
    readonly theme: AdventureThemeCode;
    readonly title: string;
    readonly seed: string;
    readonly payoutRate: number;
    readonly context: AdventureContext;
    readonly startedAt: string;
}

export interface CreateAdventureInstanceInput {
    readonly id: string;
    readonly definitionId: string;
    readonly seed: SeedPart;
    readonly payoutRate: number;
    readonly startedAt?: string;
}

export interface CatalogValidationIssue {
    readonly path: string;
    readonly message: string;
}

const context = (
    events: readonly string[],
    locations: readonly string[],
    enemies: readonly string[],
    objectives: readonly string[],
): AdventureContextOptions => ({ events, locations, enemies, objectives });

export const ADVENTURE_CATALOG: AdventureCatalog = [
    {
        id: "fantasy.awakening-ruins.v1",
        contentVersion: 1,
        theme: "fantasy",
        title: "The Awakening Ruins",
        descriptionTemplate: "{event} envelops {location} as {enemy} closes in on {objective}.",
        approaches: [
            {
                code: "confront",
                label: "Confront",
                check: "might",
                winTemplate: "{player} drives back {enemy} and secures {objective}.",
                loseTemplate: "{player} is overwhelmed by {enemy} at {location}.",
            },
            {
                code: "decode",
                label: "Decode",
                check: "arcana",
                winTemplate: "{player} deciphers the wards around {objective}.",
                loseTemplate: "{player} triggers an arcane backlash while studying {objective}.",
            },
            {
                code: "infiltrate",
                label: "Infiltrate",
                check: "stealth",
                winTemplate: "{player} slips past {enemy} and recovers {objective} unseen.",
                loseTemplate: "{enemy} spots {player} before they reach {objective}.",
            },
        ],
        contextOptions: context(
            ["A blood moon", "A magical surge", "A ghostly fog"],
            ["the cursed forest", "the forgotten temple", "the haunted castle"],
            ["a necromancer", "a shadow beast", "an ice wraith"],
            ["an ancient rune", "a mystic orb", "a phoenix feather"],
        ),
        lootItemIds: ["fantasy.enchanted-dagger.v1", "fantasy.ancient-rune.v1", "fantasy.elven-bow.v1"],
        criticalFailureStatusCode: "fantasy.arcane-burn",
        presentation: "individual",
    },
    {
        id: "sci-fi.derelict-signal.v1",
        contentVersion: 1,
        theme: "sci-fi",
        title: "The Derelict Signal",
        descriptionTemplate: "During {event}, a signal from {location} reveals {enemy} guarding {objective}.",
        approaches: [
            {
                code: "hack",
                label: "Hack",
                check: "technology",
                winTemplate: "{player} overrides the security grid and retrieves {objective}.",
                loseTemplate: "The security grid locks {player} out of {location}.",
            },
            {
                code: "outmaneuver",
                label: "Outmaneuver",
                check: "agility",
                winTemplate: "{player} outmaneuvers {enemy} and reaches {objective}.",
                loseTemplate: "{enemy} corners {player} before they reach {objective}.",
            },
            {
                code: "analyze",
                label: "Analyze",
                check: "perception",
                winTemplate: "{player} traces the signal and exposes {enemy}'s blind spot.",
                loseTemplate: "{player} follows a decoy signal deeper into {location}.",
            },
        ],
        contextOptions: context(
            ["a plasma storm", "a communications blackout", "a temporal distortion"],
            ["a derelict star cruiser", "an asteroid lab", "an orbital station"],
            ["a hostile AI", "rogue androids", "space pirates"],
            ["a fusion core", "a neural uplink", "a tachyon scanner"],
        ),
        lootItemIds: ["sci-fi.tachyon-scanner.v1", "sci-fi.neural-uplink.v1", "sci-fi.plasma-rifle.v1"],
        criticalFailureStatusCode: "sci-fi.disoriented",
        presentation: "individual",
    },
    {
        id: "cyberpunk.neon-heist.v1",
        contentVersion: 1,
        theme: "cyberpunk",
        title: "The Neon Heist",
        descriptionTemplate: "{event} hits {location} while {enemy} transfers {objective}.",
        approaches: [
            {
                code: "breach",
                label: "Breach",
                check: "technology",
                winTemplate: "{player} breaches the network and reroutes {objective}.",
                loseTemplate: "A counter-intrusion traces {player} through {location}.",
            },
            {
                code: "ghost",
                label: "Ghost",
                check: "stealth",
                winTemplate: "{player} ghosts past {enemy} and extracts {objective}.",
                loseTemplate: "{player}'s signature flashes across every sensor in {location}.",
            },
            {
                code: "spoof",
                label: "Spoof",
                check: "deception",
                winTemplate: "{player} feeds {enemy} a false authorization and claims {objective}.",
                loseTemplate: "{enemy} sees through {player}'s credentials.",
            },
        ],
        contextOptions: context(
            ["a district-wide blackout", "a corporate lockdown", "a rogue data storm"],
            ["the neon arcology", "an underground data vault", "the midnight maglev"],
            ["corporate enforcers", "a hunter-killer AI", "a rival netrunner"],
            ["an encrypted data shard", "a prototype stealth module", "a stolen identity lattice"],
        ),
        lootItemIds: ["cyberpunk.hacking-deck.v1", "cyberpunk.stealth-module.v1", "cyberpunk.forged-identity.v1"],
        criticalFailureStatusCode: "cyberpunk.glitched",
        presentation: "individual",
    },
    {
        id: "mythological.trial-of-gods.v1",
        contentVersion: 1,
        theme: "mythological",
        title: "The Trial of Gods",
        descriptionTemplate: "{event} shakes {location}, where {enemy} challenges all who seek {objective}.",
        approaches: [
            {
                code: "challenge",
                label: "Challenge",
                check: "might",
                winTemplate: "{player} meets {enemy}'s challenge and earns {objective}.",
                loseTemplate: "{enemy} casts {player} from {location}.",
            },
            {
                code: "invoke",
                label: "Invoke",
                check: "spirit",
                winTemplate: "{player}'s conviction opens the way to {objective}.",
                loseTemplate: "{player}'s plea goes unanswered beneath {event}.",
            },
            {
                code: "recall",
                label: "Recall",
                check: "knowledge",
                winTemplate: "{player} recalls the old rite that binds {enemy}.",
                loseTemplate: "{player} speaks the rite incorrectly and loses {objective}.",
            },
        ],
        contextOptions: context(
            ["a divine thunderstorm", "an impossible eclipse", "a rain of golden fire"],
            ["the titan's causeway", "a ruined oracle", "the summit of trials"],
            ["a wrathful demigod", "a many-headed guardian", "a jealous oracle"],
            ["a blessed amulet", "a shard of the Aegis", "a sacred scroll"],
        ),
        lootItemIds: ["mythological.aegis-shard.v1", "mythological.sacred-scroll.v1", "mythological.blessed-amulet.v1"],
        criticalFailureStatusCode: "mythological.god-marked",
        presentation: "individual",
    },
    {
        id: "post-apocalyptic.fallout-cache.v1",
        contentVersion: 1,
        theme: "post-apocalyptic",
        title: "The Fallout Cache",
        descriptionTemplate: "{event} sweeps across {location}, exposing {objective} beneath the territory of {enemy}.",
        approaches: [
            {
                code: "scavenge",
                label: "Scavenge",
                check: "survival",
                winTemplate: "{player} finds a safe route through {location} to {objective}.",
                loseTemplate: "{player}'s supplies run out before reaching {objective}.",
            },
            {
                code: "withstand",
                label: "Withstand",
                check: "endurance",
                winTemplate: "{player} withstands {event} and carries {objective} to safety.",
                loseTemplate: "{event} forces {player} to abandon {objective}.",
            },
            {
                code: "repair",
                label: "Repair",
                check: "technology",
                winTemplate: "{player} restores the cache machinery and releases {objective}.",
                loseTemplate: "The ruined machinery fails beneath {player}'s hands.",
            },
        ],
        contextOptions: context(
            ["a radioactive dust storm", "an acid downpour", "a reactor flare"],
            ["the collapsed metro", "a buried shelter", "the glassed refinery"],
            ["wasteland raiders", "mutated scavengers", "a defense drone swarm"],
            ["a sealed water purifier", "a case of rad medicine", "a pre-war power cell"],
        ),
        lootItemIds: ["post-apocalyptic.rad-suit.v1", "post-apocalyptic.water-purifier.v1", "post-apocalyptic.jury-rig-kit.v1"],
        criticalFailureStatusCode: "post-apocalyptic.irradiated",
        presentation: "individual",
    },
    {
        id: "pirate.cursed-reef.v1",
        contentVersion: 1,
        theme: "pirate",
        title: "The Cursed Reef",
        descriptionTemplate: "{event} traps the crew near {location}, where {enemy} guards {objective}.",
        approaches: [
            {
                code: "navigate",
                label: "Navigate",
                check: "survival",
                winTemplate: "{player} charts a safe passage through {location} and reaches {objective}.",
                loseTemplate: "{player} loses the channel as {event} batters the ship.",
            },
            {
                code: "board",
                label: "Board",
                check: "agility",
                winTemplate: "{player} swings aboard, evades {enemy}, and seizes {objective}.",
                loseTemplate: "{player} is thrown overboard while facing {enemy}.",
            },
            {
                code: "parley",
                label: "Parley",
                check: "deception",
                winTemplate: "{player} tricks {enemy} into surrendering {objective}.",
                loseTemplate: "{enemy} spots the lie and strands {player} at {location}.",
            },
        ],
        contextOptions: context(
            ["a supernatural tempest", "a wall of ghostly fog", "a blood-red tide"],
            ["the Hidden Cove", "the Blacktooth Reef", "a moonlit shipwreck"],
            ["a sea witch", "rival pirates", "a spectral captain"],
            ["an enchanted compass", "a captain's signet", "a chart to the golden fleet"],
        ),
        lootItemIds: ["pirate.tideworn-compass.v1", "pirate.buccaneer-cutlass.v1", "pirate.captains-signet.v1"],
        criticalFailureStatusCode: "pirate.seasick",
        presentation: "individual",
    },
    {
        id: "steampunk.aether-engine.v1",
        contentVersion: 1,
        theme: "steampunk",
        title: "The Aether Engine",
        descriptionTemplate: "{event} cripples {location} while {enemy} attempts to steal {objective}.",
        approaches: [
            {
                code: "repair",
                label: "Repair",
                check: "technology",
                winTemplate: "{player} stabilizes {objective} before {location} falls.",
                loseTemplate: "A shower of gears drives {player} away from {objective}.",
            },
            {
                code: "inspect",
                label: "Inspect",
                check: "perception",
                winTemplate: "{player} finds the sabotaged valve and exposes {enemy}.",
                loseTemplate: "{player} overlooks a hairline fracture in {objective}.",
            },
            {
                code: "pursue",
                label: "Pursue",
                check: "agility",
                winTemplate: "{player} races across {location} and catches {enemy}.",
                loseTemplate: "{enemy} escapes {player} amid {event}.",
            },
        ],
        contextOptions: context(
            ["a boiler cascade", "an aetheric surge", "a clockwork uprising"],
            ["the airborne foundry", "a brasswork station", "the imperial skyship"],
            ["a masked saboteur", "rogue automatons", "an aether corsair"],
            ["the prototype aether engine", "a clockwork flight core", "the imperial gear-key"],
        ),
        lootItemIds: ["steampunk.brass-monocle.v1", "steampunk.aether-wrench.v1", "steampunk.clockwork-wings.v1"],
        criticalFailureStatusCode: "steampunk.soot-blinded",
        presentation: "individual",
    },
    {
        id: "superhero.city-under-siege.v1",
        contentVersion: 1,
        theme: "superhero",
        title: "City Under Siege",
        descriptionTemplate: "{event} engulfs {location} as {enemy} threatens {objective}.",
        approaches: [
            {
                code: "smash",
                label: "Smash",
                check: "might",
                winTemplate: "{player} breaks through {enemy}'s defenses and saves {objective}.",
                loseTemplate: "{enemy} hurls {player} across {location}.",
            },
            {
                code: "rescue",
                label: "Rescue",
                check: "agility",
                winTemplate: "{player} races through {event} and carries {objective} to safety.",
                loseTemplate: "Falling debris cuts {player} off from {objective}.",
            },
            {
                code: "rally",
                label: "Rally",
                check: "presence",
                winTemplate: "{player} rallies the city against {enemy} and protects {objective}.",
                loseTemplate: "Panic drowns out {player}'s call across {location}.",
            },
        ],
        contextOptions: context(
            ["a gravity inversion", "a citywide power surge", "a rain of meteors"],
            ["the central plaza", "the elevated rail", "the harbor district"],
            ["a colossal war machine", "a rogue supervillain", "an alien vanguard"],
            ["the evacuation convoy", "the city's fusion grid", "a trapped rescue team"],
        ),
        lootItemIds: ["superhero.titan-gauntlets.v1", "superhero.kinetic-suit.v1", "superhero.beacon-emblem.v1"],
        criticalFailureStatusCode: "superhero.shaken",
        presentation: "individual",
    },
    {
        id: "horror.whispering-house.v1",
        contentVersion: 1,
        theme: "horror",
        title: "The Whispering House",
        descriptionTemplate: "During {event}, {location} opens its doors and {enemy} awakens beside {objective}.",
        approaches: [
            {
                code: "banish",
                label: "Banish",
                check: "spirit",
                winTemplate: "{player} stands firm and banishes {enemy} from {location}.",
                loseTemplate: "{enemy}'s whisper breaks {player}'s resolve.",
            },
            {
                code: "investigate",
                label: "Investigate",
                check: "perception",
                winTemplate: "{player} finds the hidden path to {objective}.",
                loseTemplate: "{player} follows false footprints into {location}.",
            },
            {
                code: "research",
                label: "Research",
                check: "knowledge",
                winTemplate: "{player} identifies {enemy} and seals it with {objective}.",
                loseTemplate: "{player} reads the final warning a moment too late.",
            },
        ],
        contextOptions: context(
            ["a moonless midnight", "a funeral bell with no source", "an unnatural cold"],
            ["the abandoned manor", "a flooded catacomb", "the shuttered asylum"],
            ["a faceless apparition", "an ancient vampire", "a crawling shadow"],
            ["a silver crucifix", "the missing occult journal", "a hunter's lantern"],
        ),
        lootItemIds: ["horror.silver-crucifix.v1", "horror.occult-journal.v1", "horror.hunters-lantern.v1"],
        criticalFailureStatusCode: "horror.haunted",
        presentation: "individual",
    },
    {
        id: "western.dust-town-showdown.v1",
        contentVersion: 1,
        theme: "western",
        title: "Dust Town Showdown",
        descriptionTemplate: "{event} rolls into {location} just as {enemy} makes a play for {objective}.",
        approaches: [
            {
                code: "quickdraw",
                label: "Quickdraw",
                check: "agility",
                winTemplate: "{player} outdraws {enemy} and secures {objective}.",
                loseTemplate: "{enemy} knocks {player}'s weapon into the dust.",
            },
            {
                code: "stare-down",
                label: "Stare Down",
                check: "presence",
                winTemplate: "{player} stares {enemy} down without firing a shot.",
                loseTemplate: "{enemy} calls {player}'s bluff before the whole town.",
            },
            {
                code: "track",
                label: "Track",
                check: "survival",
                winTemplate: "{player} follows the trail from {location} straight to {objective}.",
                loseTemplate: "{event} erases the trail before {player} can follow.",
            },
        ],
        contextOptions: context(
            ["a black dust storm", "a scorching drought", "a midnight train whistle"],
            ["Red Mesa", "the abandoned silver mine", "a frontier rail station"],
            ["the Blackspur Gang", "a crooked marshal", "a masked bounty hunter"],
            ["the stolen payroll", "a sheriff's badge", "a map to the lost spring"],
        ),
        lootItemIds: ["western.quickdraw-revolver.v1", "western.sheriffs-badge.v1", "western.trail-saddlebags.v1"],
        criticalFailureStatusCode: "western.rattled",
        presentation: "individual",
    },
    {
        id: "spy.black-glass-operation.v1",
        contentVersion: 1,
        theme: "spy",
        title: "Operation Black Glass",
        descriptionTemplate: "Under cover of {event}, {enemy} moves {objective} through {location}.",
        approaches: [
            {
                code: "infiltrate",
                label: "Infiltrate",
                check: "stealth",
                winTemplate: "{player} enters {location} unseen and intercepts {objective}.",
                loseTemplate: "A hidden camera catches {player} inside {location}.",
            },
            {
                code: "impersonate",
                label: "Impersonate",
                check: "deception",
                winTemplate: "{player}'s cover convinces {enemy} to hand over {objective}.",
                loseTemplate: "{enemy} asks the one question {player}'s cover cannot answer.",
            },
            {
                code: "surveil",
                label: "Surveil",
                check: "perception",
                winTemplate: "{player} spots the switch and tracks the real {objective}.",
                loseTemplate: "{enemy}'s decoy leads {player} away from {location}.",
            },
        ],
        contextOptions: context(
            ["a diplomatic blackout", "a citywide evacuation drill", "a masquerade gala"],
            ["the glass embassy", "an alpine sleeper train", "a subterranean archive"],
            ["a double agent", "the Vesper syndicate", "an intelligence broker"],
            ["the cipher ledger", "a stolen biometric key", "the names of every field agent"],
        ),
        lootItemIds: ["spy.hacking-kit.v1", "spy.forged-passport.v1", "spy.laser-watch.v1"],
        criticalFailureStatusCode: "spy.compromised",
        presentation: "individual",
    },
    {
        id: "egyptian.sunken-tomb.v1",
        contentVersion: 1,
        theme: "egyptian",
        title: "The Sunken Tomb",
        descriptionTemplate: "{event} reveals a passage beneath {location}, where {enemy} guards {objective}.",
        approaches: [
            {
                code: "translate",
                label: "Translate",
                check: "knowledge",
                winTemplate: "{player} translates the warning and safely retrieves {objective}.",
                loseTemplate: "{player} mistranslates the warning and seals the passage.",
            },
            {
                code: "search",
                label: "Search",
                check: "perception",
                winTemplate: "{player} spots every trap between {location} and {objective}.",
                loseTemplate: "A hidden mechanism drops {player} into darkness.",
            },
            {
                code: "ward",
                label: "Ward",
                check: "spirit",
                winTemplate: "{player} resists {enemy}'s curse and claims {objective}.",
                loseTemplate: "{enemy}'s curse drives {player} from {location}.",
            },
        ],
        contextOptions: context(
            ["a sand-swallowing eclipse", "the Nile's sudden retreat", "a chorus beneath the dunes"],
            ["the temple of the forgotten sun", "a buried royal barge", "the obsidian pyramid"],
            ["a mummy high priest", "a living stone sphinx", "a swarm of scarab spirits"],
            ["a golden scarab", "a sealed papyrus scroll", "the pharaoh's ankh"],
        ),
        lootItemIds: ["egyptian.golden-scarab.v1", "egyptian.papyrus-scroll.v1", "egyptian.surveyors-ankh.v1"],
        criticalFailureStatusCode: "egyptian.cursed",
        presentation: "individual",
    },
    {
        id: "atlantis.drowned-archive.v1",
        contentVersion: 1,
        theme: "atlantis",
        title: "The Drowned Archive",
        descriptionTemplate: "{event} tears through {location}, awakening {enemy} beside {objective}.",
        approaches: [
            {
                code: "dive",
                label: "Dive",
                check: "endurance",
                winTemplate: "{player} withstands the crushing depth and reaches {objective}.",
                loseTemplate: "The pressure forces {player} back from {location}.",
            },
            {
                code: "navigate",
                label: "Navigate",
                check: "survival",
                winTemplate: "{player} reads the current and guides the party around {enemy}.",
                loseTemplate: "{event} sweeps {player} into a maze of flooded halls.",
            },
            {
                code: "awaken",
                label: "Awaken",
                check: "spirit",
                winTemplate: "{player} communes with the archive and awakens {objective}.",
                loseTemplate: "The voices of {location} overwhelm {player}.",
            },
        ],
        contextOptions: context(
            ["an abyssal quake", "a luminous red tide", "a collapsing current gate"],
            ["the drowned archive", "the coral throne room", "a shattered dome city"],
            ["a leviathan sentinel", "the drowned royal guard", "a siren archivist"],
            ["an oceanic tablet", "a sea crystal", "the pearl trident"],
        ),
        lootItemIds: ["atlantis.pearl-trident.v1", "atlantis.sea-crystal.v1", "atlantis.pressure-mantle.v1"],
        criticalFailureStatusCode: "atlantis.pressure-sick",
        presentation: "individual",
    },
    {
        id: "dinosaur.lost-valley.v1",
        contentVersion: 1,
        theme: "dinosaur",
        title: "The Lost Valley",
        descriptionTemplate: "{event} drives {enemy} through {location} toward {objective}.",
        approaches: [
            {
                code: "track",
                label: "Track",
                check: "survival",
                winTemplate: "{player} reads the tracks and reaches {objective} ahead of {enemy}.",
                loseTemplate: "{player} follows an old trail into {enemy}'s nesting ground.",
            },
            {
                code: "hold",
                label: "Hold",
                check: "might",
                winTemplate: "{player} holds the pass against {enemy} and protects {objective}.",
                loseTemplate: "{enemy} crashes through {player}'s defense.",
            },
            {
                code: "evade",
                label: "Evade",
                check: "agility",
                winTemplate: "{player} darts through {location} and evades {enemy}.",
                loseTemplate: "Falling timber traps {player} as {enemy} approaches.",
            },
        ],
        contextOptions: context(
            ["a volcanic tremor", "a primeval monsoon", "a stampede at dawn"],
            ["the fern-choked valley", "a basalt nesting ground", "the fossil river canyon"],
            ["a tyrannosaur", "a pack of raptors", "an armored ankylosaur"],
            ["the expedition's fire starter", "a clutch of fossilized eggs", "the missing survey beacon"],
        ),
        lootItemIds: ["dinosaur.stone-spear.v1", "dinosaur.fire-starter.v1", "dinosaur.bone-charm.v1"],
        criticalFailureStatusCode: "dinosaur.wounded",
        presentation: "individual",
    },
] as const;

const DEFINITION_BY_ID: ReadonlyMap<string, AdventureDefinition> = new Map(ADVENTURE_CATALOG.map(definition => [definition.id, definition]));

export function getAdventureDefinition(id: string): AdventureDefinition | undefined {
    return DEFINITION_BY_ID.get(id);
}

export function getThemeAdventures(theme: AdventureThemeCode): readonly AdventureDefinition[] {
    return ADVENTURE_CATALOG.filter(definition => definition.theme === theme);
}

export function extractTemplatePlaceholders(template: string): readonly string[] {
    return [...template.matchAll(/\{([a-z][a-z0-9]*)\}/gi)].map(match => match[1]);
}

export function validateAdventureTemplate(template: string, allowed: readonly string[] = ADVENTURE_TEMPLATE_PLACEHOLDERS): readonly string[] {
    const issues: string[] = [];
    const placeholders = extractTemplatePlaceholders(template);
    const unknown = [...new Set(placeholders.filter(placeholder => !allowed.includes(placeholder)))];

    if (!template.trim()) issues.push("Template cannot be empty");
    if (unknown.length) issues.push(`Unknown placeholders: ${unknown.join(", ")}`);

    const withoutValidPlaceholders = template.replace(/\{[a-z][a-z0-9]*\}/gi, "");
    if (withoutValidPlaceholders.includes("{") || withoutValidPlaceholders.includes("}"))
        issues.push("Template contains malformed placeholder braces");

    return issues;
}

export function renderAdventureTemplate(template: string, values: Readonly<Partial<Record<AdventureTemplatePlaceholder, string | number>>>): string {
    const templateIssues = validateAdventureTemplate(template);
    if (templateIssues.length) throw new Error(templateIssues.join("; "));

    return template.replace(/\{([a-z][a-z0-9]*)\}/gi, (_match, placeholder: AdventureTemplatePlaceholder) => {
        const value = values[placeholder];
        if (value === undefined || value === null) throw new Error(`Missing template value: ${placeholder}`);
        return String(value);
    });
}

export function createAdventureInstance(input: CreateAdventureInstanceInput): AdventureInstance {
    if (!input.id.trim()) throw new Error("Adventure instance ID cannot be empty");
    if (!Number.isFinite(input.payoutRate) || input.payoutRate <= 0) throw new RangeError("Payout rate must be finite and greater than zero");

    const definition = getAdventureDefinition(input.definitionId);
    if (!definition) throw new Error(`Unknown adventure definition: ${input.definitionId}`);

    const seed = String(input.seed);
    const contextSeed = ["adventure-rpg-v1", seed, input.id, definition.id] as const;
    const selectedContext: AdventureContext = {
        event: pickSeeded(definition.contextOptions.events, ...contextSeed, "event"),
        location: pickSeeded(definition.contextOptions.locations, ...contextSeed, "location"),
        enemy: pickSeeded(definition.contextOptions.enemies, ...contextSeed, "enemy"),
        objective: pickSeeded(definition.contextOptions.objectives, ...contextSeed, "objective"),
    };

    return {
        id: input.id,
        definitionId: definition.id,
        contentVersion: definition.contentVersion,
        rulesVersion: ADVENTURE_RULES_VERSION,
        theme: definition.theme,
        title: definition.title,
        seed,
        payoutRate: input.payoutRate,
        context: selectedContext,
        startedAt: input.startedAt ?? new Date().toISOString(),
    };
}

export function renderAdventureDescription(instance: AdventureInstance): string {
    const definition = getAdventureDefinition(instance.definitionId);
    if (!definition) throw new Error(`Unknown adventure definition: ${instance.definitionId}`);
    return renderAdventureTemplate(definition.descriptionTemplate, { ...instance.context, title: instance.title, theme: definition.theme });
}

export function renderAdventureOutcome(
    instance: AdventureInstance,
    approachCode: string,
    player: string,
    success: boolean,
    item = instance.context.objective,
): string {
    const definition = getAdventureDefinition(instance.definitionId);
    if (!definition) throw new Error(`Unknown adventure definition: ${instance.definitionId}`);
    const approach = definition.approaches.find(candidate => candidate.code === approachCode);
    if (!approach) throw new Error(`Unknown approach ${approachCode} for ${definition.id}`);

    return renderAdventureTemplate(success ? approach.winTemplate : approach.loseTemplate, {
        ...instance.context,
        player,
        title: instance.title,
        theme: definition.theme,
        approach: approach.label,
        check: approach.check,
        item,
    });
}

export function validateAdventureCatalog(catalog: AdventureCatalog = ADVENTURE_CATALOG): readonly CatalogValidationIssue[] {
    const issues: CatalogValidationIssue[] = [];
    const definitionIds = new Set<string>();

    for (const [definitionIndex, definition] of catalog.entries()) {
        const path = `catalog[${definitionIndex}]`;

        if (definitionIds.has(definition.id)) issues.push({ path: `${path}.id`, message: `Duplicate definition ID: ${definition.id}` });
        definitionIds.add(definition.id);

        if (!isAdventureThemeCode(definition.theme)) issues.push({ path: `${path}.theme`, message: `Unknown theme: ${definition.theme}` });
        if (!definition.id.startsWith(`${definition.theme}.`) || !definition.id.endsWith(`.v${definition.contentVersion}`)) {
            issues.push({ path: `${path}.id`, message: "Definition ID must contain its theme and end in its content version" });
        }
        if (!Number.isInteger(definition.contentVersion) || definition.contentVersion < 1) {
            issues.push({ path: `${path}.contentVersion`, message: "Content version must be a positive integer" });
        }

        for (const message of validateAdventureTemplate(definition.descriptionTemplate)) {
            issues.push({ path: `${path}.descriptionTemplate`, message });
        }

        if (definition.approaches.length < 3 || definition.approaches.length > 5) {
            issues.push({ path: `${path}.approaches`, message: "An adventure must expose between three and five approaches" });
        }

        const approachCodes = new Set<string>();
        const relevantChecks = isAdventureThemeCode(definition.theme) ? getAdventureTheme(definition.theme).relevantChecks : [];
        for (const [approachIndex, approach] of definition.approaches.entries()) {
            const approachPath = `${path}.approaches[${approachIndex}]`;
            if (approachCodes.has(approach.code)) issues.push({ path: `${approachPath}.code`, message: `Duplicate approach code: ${approach.code}` });
            approachCodes.add(approach.code);
            if (!isAdventureCheck(approach.check)) issues.push({ path: `${approachPath}.check`, message: `Unknown check: ${approach.check}` });
            if (!relevantChecks.includes(approach.check))
                issues.push({ path: `${approachPath}.check`, message: `${approach.check} is not relevant to ${definition.theme}` });
            for (const [field, template] of [
                ["winTemplate", approach.winTemplate],
                ["loseTemplate", approach.loseTemplate],
            ] as const) {
                for (const message of validateAdventureTemplate(template)) issues.push({ path: `${approachPath}.${field}`, message });
            }
        }

        for (const [key, values] of Object.entries(definition.contextOptions)) {
            if (!values.length || values.some((value: string) => !value.trim())) {
                issues.push({ path: `${path}.contextOptions.${key}`, message: "Context options cannot be empty" });
            }
        }

        for (const itemId of definition.lootItemIds) {
            const item = getAdventureItem(itemId);
            if (!item) issues.push({ path: `${path}.lootItemIds`, message: `Unknown loot item: ${itemId}` });
            else if (item.theme !== definition.theme)
                issues.push({ path: `${path}.lootItemIds`, message: `${itemId} belongs to ${item.theme}, not ${definition.theme}` });
        }

        if (
            isAdventureThemeCode(definition.theme) &&
            definition.criticalFailureStatusCode !== getAdventureTheme(definition.theme).criticalFailureStatus.code
        ) {
            issues.push({ path: `${path}.criticalFailureStatusCode`, message: "Critical-failure status does not match the theme" });
        }
    }

    return issues;
}

export function validateAdventureItems(): readonly CatalogValidationIssue[] {
    const issues: CatalogValidationIssue[] = [];
    const ids = new Set<string>();

    for (const [index, item] of ADVENTURE_ITEMS.entries()) {
        const path = `items[${index}]`;
        if (ids.has(item.id)) issues.push({ path: `${path}.id`, message: `Duplicate item ID: ${item.id}` });
        ids.add(item.id);
        if (item.bonus.modifier !== 1) issues.push({ path: `${path}.bonus.modifier`, message: "Mechanical item bonuses cannot exceed +1" });
        if (!isAdventureCheck(item.bonus.check)) issues.push({ path: `${path}.bonus.check`, message: `Unknown check: ${item.bonus.check}` });
        if (!isAdventureThemeCode(item.theme)) issues.push({ path: `${path}.theme`, message: `Unknown theme: ${item.theme}` });
        else if (!getAdventureTheme(item.theme).relevantChecks.includes(item.bonus.check)) {
            issues.push({ path: `${path}.bonus.check`, message: `${item.bonus.check} is not relevant to ${item.theme}` });
        }
        if (item.kind === "equipment" && item.slot === "none") issues.push({ path: `${path}.slot`, message: "Equipment requires a slot" });
    }

    return issues;
}
