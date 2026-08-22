import { atlantisAdventures } from "../atlantis";
import { customAdventures } from "../custom";
import { cyberpunkAdventures } from "../cyberpunk";
import { dinoAdventures } from "../dino";
import { egyptAdventures } from "../egypt";
import { fantasyAdventures } from "../fantasy";
import { heroAdventures } from "../hero";
import { horrorAdventures } from "../horror";
import { mythologicalAdventures } from "../mythological";
import { pirateAdventures } from "../pirate";
import { postApocAdventures } from "../postApoc";
import { sciFiAdventures } from "../sciFi";
import { spyAdventures } from "../spy";
import { steampunkAdventures } from "../steampunk";
import { westAdventures } from "../west";
import {
    ADVENTURE_CATALOG_VERSION,
    AdventureApproaches,
    AdventureCatalogEntry,
    AdventureCatalogKind,
    AdventureCheck,
    AdventurePresentationMode,
    AdventureThemeId,
    LegacyAdventure,
    RegularAdventureThemeId,
} from "./types";

type ApproachInput = readonly [id: string, label: string, check: AdventureCheck];

interface CatalogMetadata {
    slug: string;
    title: string;
    approaches: AdventureApproaches;
}

function approaches(first: ApproachInput, second: ApproachInput, third: ApproachInput): AdventureApproaches {
    return [
        { id: first[0], label: first[1], check: first[2] },
        { id: second[0], label: second[1], check: second[2] },
        { id: third[0], label: third[1], check: third[2] },
    ];
}

function adaptTheme(
    themeId: AdventureThemeId,
    legacyAdventures: readonly LegacyAdventure[],
    metadata: readonly CatalogMetadata[],
    kind: AdventureCatalogKind,
    presentationMode: AdventurePresentationMode,
): readonly AdventureCatalogEntry[] {
    if (legacyAdventures.length !== metadata.length) {
        throw new Error(`Adventure catalog metadata for ${themeId} has ${metadata.length} entries for ${legacyAdventures.length} adventures.`);
    }

    return Object.freeze(
        legacyAdventures.map((legacyAdventure, index) => {
            const definition = metadata[index];
            return Object.freeze({
                ...legacyAdventure,
                id: `${themeId}.${definition.slug}.v${ADVENTURE_CATALOG_VERSION}` as const,
                themeId,
                title: definition.title,
                contentVersion: ADVENTURE_CATALOG_VERSION,
                kind,
                presentationMode,
                approaches: Object.freeze(definition.approaches),
                legacyAdventure,
            });
        }),
    );
}

const fantasyMetadata: readonly CatalogMetadata[] = [
    {
        slug: "forgotten-lore",
        title: "Mysteries of Forgotten Lore",
        approaches: approaches(
            ["confront", "Confront the guardians", "might"],
            ["decipher", "Decipher the magic", "arcana"],
            ["investigate", "Search for hidden clues", "perception"],
        ),
    },
    {
        slug: "stirring-below",
        title: "The Stirring Below",
        approaches: approaches(
            ["delve", "Delve into the wilds", "survival"],
            ["research", "Research the old legends", "knowledge"],
            ["ward", "Ward against the darkness", "spirit"],
        ),
    },
];

const sciFiMetadata: readonly CatalogMetadata[] = [
    {
        slug: "forgotten-salvage",
        title: "Secrets of the Forgotten Wreck",
        approaches: approaches(
            ["hack", "Bypass the security grid", "technology"],
            ["board", "Board through the debris", "agility"],
            ["endure", "Weather the anomaly", "endurance"],
        ),
    },
    {
        slug: "mysterious-signal",
        title: "The Mysterious Signal",
        approaches: approaches(
            ["decode", "Decode the transmission", "knowledge"],
            ["scan", "Scan for an ambush", "perception"],
            ["negotiate", "Answer the unknown caller", "presence"],
        ),
    },
];

const cyberpunkMetadata: readonly CatalogMetadata[] = [
    {
        slug: "urban-data-run",
        title: "Urban Data Run",
        approaches: approaches(
            ["breach", "Breach corporate ICE", "technology"],
            ["infiltrate", "Infiltrate the facility", "stealth"],
            ["bluff", "Bluff the security team", "deception"],
        ),
    },
    {
        slug: "high-stakes-raid",
        title: "High-Stakes Raid",
        approaches: approaches(
            ["ghost", "Ghost past security", "stealth"],
            ["divert", "Create a diversion", "deception"],
            ["escape", "Make a rooftop escape", "agility"],
        ),
    },
];

const mythologicalMetadata: readonly CatalogMetadata[] = [
    {
        slug: "divine-quest",
        title: "The Divine Quest",
        approaches: approaches(
            ["prove", "Prove your strength", "might"],
            ["interpret", "Interpret the ancient riddle", "knowledge"],
            ["pray", "Seek divine favor", "spirit"],
        ),
    },
    {
        slug: "call-of-the-gods",
        title: "Call of the Gods",
        approaches: approaches(
            ["challenge", "Challenge the guardian", "might"],
            ["invoke", "Invoke forgotten power", "arcana"],
            ["appeal", "Appeal to the oracle", "presence"],
        ),
    },
];

const postApocalypticMetadata: readonly CatalogMetadata[] = [
    {
        slug: "resource-scramble",
        title: "The Resource Scramble",
        approaches: approaches(
            ["scavenge", "Scavenge the ruins", "survival"],
            ["repair", "Repair the old machinery", "technology"],
            ["barter", "Barter for supplies", "presence"],
        ),
    },
    {
        slug: "guarded-cache",
        title: "The Guarded Cache",
        approaches: approaches(
            ["sneak", "Sneak past the raiders", "stealth"],
            ["disarm", "Disarm their traps", "perception"],
            ["outwit", "Feed them a false trail", "deception"],
        ),
    },
    {
        slug: "fragile-peace",
        title: "Fragile Peace",
        approaches: approaches(
            ["defend", "Defend the settlement", "might"],
            ["withstand", "Withstand the disaster", "endurance"],
            ["rally", "Rally the survivors", "presence"],
        ),
    },
    {
        slug: "signal-of-hope",
        title: "Signal of Hope",
        approaches: approaches(
            ["trace", "Trace the signal", "technology"],
            ["navigate", "Navigate to its source", "survival"],
            ["inspect", "Inspect for a trap", "perception"],
        ),
    },
];

const pirateMetadata: readonly CatalogMetadata[] = [
    {
        slug: "tempest-map",
        title: "The Tempest Map",
        approaches: approaches(
            ["navigate", "Navigate the treacherous waters", "survival"],
            ["fight", "Fight through the rival crew", "might"],
            ["outsmart", "Outsmart the treasure guards", "deception"],
        ),
    },
    {
        slug: "race-for-treasure",
        title: "Race for the Hidden Treasure",
        approaches: approaches(
            ["race", "Race to the hiding place", "agility"],
            ["sneak", "Slip past the competition", "stealth"],
            ["bribe", "Bribe a local guide", "presence"],
        ),
    },
    {
        slug: "tide-relic",
        title: "The Tide Relic",
        approaches: approaches(
            ["steal", "Steal the guarded relic", "stealth"],
            ["solve", "Solve the tidal puzzle", "knowledge"],
            ["endure", "Brave the violent current", "endurance"],
        ),
    },
    {
        slug: "lost-clue",
        title: "Clue of the Lost Hoard",
        approaches: approaches(
            ["decipher", "Decipher the clue", "knowledge"],
            ["weather", "Weather the storm", "survival"],
            ["wager", "Wager for the answer", "presence"],
        ),
    },
];

const steampunkMetadata: readonly CatalogMetadata[] = [
    {
        slug: "mechanical-disruption",
        title: "The Mechanical Disruption",
        approaches: approaches(
            ["repair", "Repair the mechanism", "technology"],
            ["restore", "Restore order by force", "might"],
            ["mediate", "Mediate with the saboteurs", "presence"],
        ),
    },
    {
        slug: "secret-meeting",
        title: "The Secret Meeting",
        approaches: approaches(
            ["infiltrate", "Infiltrate the meeting", "stealth"],
            ["decode", "Decode the conspirators' message", "knowledge"],
            ["expose", "Expose the impostor", "perception"],
        ),
    },
    {
        slug: "legendary-invention",
        title: "The Legendary Invention",
        approaches: approaches(
            ["track", "Track the invention", "survival"],
            ["disarm", "Disarm its defenses", "technology"],
            ["evade", "Evade the treasure hunters", "agility"],
        ),
    },
];

const superheroMetadata: readonly CatalogMetadata[] = [
    {
        slug: "city-crisis",
        title: "Crisis in the City",
        approaches: approaches(
            ["battle", "Battle the villain", "might"],
            ["rescue", "Race to rescue civilians", "agility"],
            ["coordinate", "Coordinate the response", "presence"],
        ),
    },
    {
        slug: "villain-takeover",
        title: "The Villain Takeover",
        approaches: approaches(
            ["infiltrate", "Infiltrate the occupied site", "stealth"],
            ["disable", "Disable the villain's device", "technology"],
            ["inspire", "Inspire the citizens", "spirit"],
        ),
    },
    {
        slug: "chaos-unleashed",
        title: "Chaos Unleashed",
        approaches: approaches(
            ["contain", "Contain the destruction", "endurance"],
            ["evacuate", "Find a safe evacuation route", "perception"],
            ["confront", "Confront the source", "might"],
        ),
    },
    {
        slug: "sinister-plan",
        title: "The Sinister Plan",
        approaches: approaches(
            ["investigate", "Uncover the plan", "knowledge"],
            ["intercept", "Intercept the villain", "agility"],
            ["misdirect", "Misdirect the henchmen", "deception"],
        ),
    },
];

const horrorMetadata: readonly CatalogMetadata[] = [
    {
        slug: "face-your-fears",
        title: "Face Your Fears",
        approaches: approaches(
            ["banish", "Banish the horror", "spirit"],
            ["investigate", "Solve the mystery", "perception"],
            ["hide", "Hide from the darkness", "stealth"],
        ),
    },
];

const westernMetadata: readonly CatalogMetadata[] = [
    {
        slug: "fortune-favors-bold",
        title: "Fortune Favors the Bold",
        approaches: approaches(
            ["duel", "Win the duel", "agility"],
            ["track", "Track the outlaws", "survival"],
            ["bluff", "Bluff the gang", "deception"],
        ),
    },
    {
        slug: "buried-treasure",
        title: "Rumors of Buried Treasure",
        approaches: approaches(
            ["prospect", "Prospect the badlands", "perception"],
            ["decode", "Decode the old riddle", "knowledge"],
            ["partner", "Recruit a local partner", "presence"],
        ),
    },
    {
        slug: "mysterious-stranger",
        title: "The Mysterious Stranger",
        approaches: approaches(
            ["befriend", "Befriend the stranger", "presence"],
            ["read", "Read their true intentions", "perception"],
            ["shadow", "Shadow them unnoticed", "stealth"],
        ),
    },
    {
        slug: "frontier-threat",
        title: "Threat on the Frontier",
        approaches: approaches(
            ["fight", "Face the threat", "might"],
            ["negotiate", "Negotiate a peace", "presence"],
            ["trap", "Set a clever trap", "survival"],
        ),
    },
];

const spyMetadata: readonly CatalogMetadata[] = [
    {
        slug: "urgent-mission",
        title: "The Urgent Mission",
        approaches: approaches(
            ["extract", "Extract the intelligence", "stealth"],
            ["outwit", "Outwit the enemy agent", "deception"],
            ["escape", "Make a fast escape", "agility"],
        ),
    },
    {
        slug: "stolen-asset",
        title: "The Stolen Asset",
        approaches: approaches(
            ["infiltrate", "Infiltrate the facility", "stealth"],
            ["hack", "Hack the security system", "technology"],
            ["impersonate", "Impersonate an official", "deception"],
        ),
    },
    {
        slug: "enemy-trap",
        title: "The Enemy Trap",
        approaches: approaches(
            ["spot", "Spot the trap", "perception"],
            ["disable", "Disable its mechanism", "technology"],
            ["resist", "Push through the ambush", "endurance"],
        ),
    },
    {
        slug: "critical-delivery",
        title: "The Critical Delivery",
        approaches: approaches(
            ["courier", "Outrun the pursuit", "agility"],
            ["route", "Plan a hidden route", "knowledge"],
            ["talk", "Talk past the checkpoint", "presence"],
        ),
    },
];

const egyptianMetadata: readonly CatalogMetadata[] = [
    {
        slug: "pharaohs-relics",
        title: "Relics of the Pharaohs",
        approaches: approaches(
            ["excavate", "Excavate the ruins", "knowledge"],
            ["explore", "Cross the desert", "survival"],
            ["defeat", "Defeat the tomb guardian", "might"],
        ),
    },
    {
        slug: "trial-in-the-shadow",
        title: "Trial in the Shadow",
        approaches: approaches(
            ["observe", "Read the temple signs", "perception"],
            ["invoke", "Invoke an ancient ward", "arcana"],
            ["endure", "Endure the pharaoh's trial", "endurance"],
        ),
    },
    {
        slug: "secret-passage",
        title: "The Secret Passage",
        approaches: approaches(
            ["disarm", "Disarm the tomb traps", "perception"],
            ["squeeze", "Slip through the ruins", "agility"],
            ["translate", "Translate the inscriptions", "knowledge"],
        ),
    },
    {
        slug: "legendary-relic",
        title: "The Legendary Relic",
        approaches: approaches(
            ["seek", "Seek guidance from spirits", "spirit"],
            ["bargain", "Bargain with the guardians", "presence"],
            ["survive", "Survive the desert omen", "survival"],
        ),
    },
];

const atlantisMetadata: readonly CatalogMetadata[] = [
    {
        slug: "ancient-dive",
        title: "Dive for Ancient Secrets",
        approaches: approaches(
            ["dive", "Dive into the depths", "endurance"],
            ["navigate", "Navigate the ruins", "survival"],
            ["battle", "Battle the sea guardian", "might"],
        ),
    },
    {
        slug: "opening-gates",
        title: "The Opening Gates",
        approaches: approaches(
            ["decode", "Decode the gate mechanism", "technology"],
            ["study", "Study the city's secrets", "knowledge"],
            ["sneak", "Sneak past the danger", "stealth"],
        ),
    },
    {
        slug: "fabled-treasure",
        title: "The Fabled Treasure",
        approaches: approaches(
            ["follow", "Follow the scattered clues", "perception"],
            ["solve", "Solve the sunken puzzle", "knowledge"],
            ["brave", "Brave the violent seas", "endurance"],
        ),
    },
    {
        slug: "undersea-festival",
        title: "The Undersea Festival",
        approaches: approaches(
            ["perform", "Win the festival contest", "agility"],
            ["charm", "Charm the local court", "presence"],
            ["celebrate", "Join the sacred rites", "spirit"],
        ),
    },
    {
        slug: "gate-guardian",
        title: "The Gate Guardian",
        approaches: approaches(
            ["defeat", "Defeat the guardian", "might"],
            ["slip", "Slip by unnoticed", "stealth"],
            ["bribe", "Bribe the guardian", "deception"],
        ),
    },
    {
        slug: "mysterious-current",
        title: "The Mysterious Current",
        approaches: approaches(
            ["ride", "Ride the current", "agility"],
            ["resist", "Resist its pull", "endurance"],
            ["chart", "Chart where it leads", "survival"],
        ),
    },
    {
        slug: "sunken-legend",
        title: "The Sunken Legend",
        approaches: approaches(
            ["interpret", "Interpret the legend", "knowledge"],
            ["commune", "Commune with ancient spirits", "spirit"],
            ["search", "Search the hidden chamber", "perception"],
        ),
    },
    {
        slug: "volcanic-vent",
        title: "The Volcanic Vent",
        approaches: approaches(
            ["withstand", "Withstand the vent's heat", "endurance"],
            ["survey", "Survey the new passage", "perception"],
            ["stabilize", "Stabilize the ancient machinery", "technology"],
        ),
    },
    {
        slug: "sunken-ship",
        title: "The Sunken Ship",
        approaches: approaches(
            ["salvage", "Salvage the wreck", "technology"],
            ["explore", "Explore the flooded hold", "survival"],
            ["decode", "Decode the captain's log", "knowledge"],
        ),
    },
    {
        slug: "luminous-bloom",
        title: "The Luminous Bloom",
        approaches: approaches(
            ["observe", "Observe the glowing trail", "perception"],
            ["attune", "Attune to the bloom", "arcana"],
            ["follow", "Follow it through the reef", "survival"],
        ),
    },
];

const dinosaurMetadata: readonly CatalogMetadata[] = [
    {
        slug: "ancient-upheaval",
        title: "Ancient Upheaval",
        approaches: approaches(
            ["hunt", "Hunt through the chaos", "might"],
            ["survive", "Survive the upheaval", "endurance"],
            ["escape", "Escape the predators", "agility"],
        ),
    },
    {
        slug: "heart-of-the-wilds",
        title: "Heart of the Wilds",
        approaches: approaches(
            ["track", "Track a safe path", "survival"],
            ["befriend", "Befriend a creature", "presence"],
            ["outwit", "Outwit the predators", "deception"],
        ),
    },
    {
        slug: "prehistoric-signal",
        title: "The Prehistoric Signal",
        approaches: approaches(
            ["decode", "Decode the signal", "technology"],
            ["observe", "Observe the gathering creatures", "perception"],
            ["sneak", "Sneak through the herd", "stealth"],
        ),
    },
    {
        slug: "nightfall",
        title: "Nightfall in the Ancient World",
        approaches: approaches(
            ["camp", "Build a safe camp", "survival"],
            ["listen", "Listen for approaching danger", "perception"],
            ["stand", "Stand firm through the night", "spirit"],
        ),
    },
];

const raidMetadata: readonly CatalogMetadata[] = [
    {
        slug: "bear-trap-forest",
        title: "Bear Traps in the Elven Forest",
        approaches: approaches(
            ["spot", "Spot the hidden traps", "perception"],
            ["leap", "Leap between the traps", "agility"],
            ["trail", "Find a safer trail", "survival"],
        ),
    },
    {
        slug: "manbearpig",
        title: "ManBearPig",
        approaches: approaches(
            ["resist", "Resist the terror", "spirit"],
            ["hide", "Hide in the tunnels", "stealth"],
            ["fight", "Stand and fight", "might"],
        ),
    },
    {
        slug: "bank-of-karabraxos",
        title: "The Bank of Karabraxos",
        approaches: approaches(
            ["plan", "Plan the impossible robbery", "knowledge"],
            ["infiltrate", "Infiltrate the vault", "stealth"],
            ["blank", "Keep your cover story straight", "deception"],
        ),
    },
    {
        slug: "golden-slice",
        title: "The Golden Slice",
        approaches: approaches(
            ["dash", "Dash past the animatronics", "agility"],
            ["disable", "Disable the security band", "technology"],
            ["perform", "Win over the pizzeria", "presence"],
        ),
    },
    {
        slug: "galactic-gameshow",
        title: "The Galactic Gameshow",
        approaches: approaches(
            ["run", "Run the obstacle course", "agility"],
            ["endure", "Endure the course of doom", "endurance"],
            ["anticipate", "Anticipate the next trap", "perception"],
        ),
    },
    {
        slug: "grand-library",
        title: "The Grand Library of Eldoria",
        approaches: approaches(
            ["cast", "Counter the library's magic", "arcana"],
            ["research", "Research its hidden rules", "knowledge"],
            ["evade", "Evade the arcane constructs", "stealth"],
        ),
    },
    {
        slug: "carnival-of-lost-souls",
        title: "Carnival of Lost Souls",
        approaches: approaches(
            ["resist", "Resist the nightmares", "spirit"],
            ["observe", "Find the true exit", "perception"],
            ["trick", "Trick the ringmaster", "deception"],
        ),
    },
    {
        slug: "ancient-portal",
        title: "The Ancient Portal",
        approaches: approaches(
            ["seal", "Seal the portal", "arcana"],
            ["withstand", "Withstand its influence", "spirit"],
            ["understand", "Understand its design", "knowledge"],
        ),
    },
    {
        slug: "derelict-spaceship",
        title: "The Derelict Spaceship",
        approaches: approaches(
            ["repair", "Repair the ship", "technology"],
            ["survive", "Survive the failing systems", "endurance"],
            ["scan", "Scan for active defenses", "perception"],
        ),
    },
    {
        slug: "goblin-market",
        title: "The Goblin Market",
        approaches: approaches(
            ["haggle", "Haggle for the artifact", "presence"],
            ["bluff", "Bluff the goblin merchants", "deception"],
            ["appraise", "Appraise the strange wares", "knowledge"],
        ),
    },
];

export const fantasyAdventureCatalog = adaptTheme("fantasy", fantasyAdventures, fantasyMetadata, "regular", "individual");
export const sciFiAdventureCatalog = adaptTheme("sci-fi", sciFiAdventures, sciFiMetadata, "regular", "individual");
export const cyberpunkAdventureCatalog = adaptTheme("cyberpunk", cyberpunkAdventures, cyberpunkMetadata, "regular", "individual");
export const mythologicalAdventureCatalog = adaptTheme("mythological", mythologicalAdventures, mythologicalMetadata, "regular", "individual");
export const postApocalypticAdventureCatalog = adaptTheme("post-apocalyptic", postApocAdventures, postApocalypticMetadata, "regular", "individual");
export const pirateAdventureCatalog = adaptTheme("pirate", pirateAdventures, pirateMetadata, "regular", "individual");
export const steampunkAdventureCatalog = adaptTheme("steampunk", steampunkAdventures, steampunkMetadata, "regular", "individual");
export const superheroAdventureCatalog = adaptTheme("superhero", heroAdventures, superheroMetadata, "regular", "individual");
export const horrorAdventureCatalog = adaptTheme("horror", horrorAdventures, horrorMetadata, "regular", "individual");
export const westernAdventureCatalog = adaptTheme("western", westAdventures, westernMetadata, "regular", "individual");
export const spyAdventureCatalog = adaptTheme("spy", spyAdventures, spyMetadata, "regular", "individual");
export const egyptianAdventureCatalog = adaptTheme("egyptian", egyptAdventures, egyptianMetadata, "regular", "individual");
export const atlantisAdventureCatalog = adaptTheme("atlantis", atlantisAdventures, atlantisMetadata, "regular", "individual");
export const dinosaurAdventureCatalog = adaptTheme("dinosaur", dinoAdventures, dinosaurMetadata, "regular", "individual");
export const raidAdventureCatalog = adaptTheme("special", customAdventures, raidMetadata, "raid", "grouped");

export const regularAdventureCatalogByTheme: Readonly<Record<RegularAdventureThemeId, readonly AdventureCatalogEntry[]>> = Object.freeze({
    fantasy: fantasyAdventureCatalog,
    "sci-fi": sciFiAdventureCatalog,
    cyberpunk: cyberpunkAdventureCatalog,
    mythological: mythologicalAdventureCatalog,
    "post-apocalyptic": postApocalypticAdventureCatalog,
    pirate: pirateAdventureCatalog,
    steampunk: steampunkAdventureCatalog,
    superhero: superheroAdventureCatalog,
    horror: horrorAdventureCatalog,
    western: westernAdventureCatalog,
    spy: spyAdventureCatalog,
    egyptian: egyptianAdventureCatalog,
    atlantis: atlantisAdventureCatalog,
    dinosaur: dinosaurAdventureCatalog,
});

export const regularAdventureCatalog: readonly AdventureCatalogEntry[] = Object.freeze(Object.values(regularAdventureCatalogByTheme).flat());

export const adventureCatalog: readonly AdventureCatalogEntry[] = Object.freeze([...regularAdventureCatalog, ...raidAdventureCatalog]);
