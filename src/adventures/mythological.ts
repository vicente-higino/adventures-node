import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";

const mythologicalItems = [
    "golden fleece",
    "divine chalice",
    "sacred scroll",
    "blessed amulet",
    "mythical weapon",
    "celestial harp",
    "orb of prophecy",
    "shield of Aegis",
    "crown of Olympus",
    "staff of Hermes",
];
const mythologicalEnemies = ["minotaur", "hydra", "cyclops", "harpies", "chimera", "medusa", "cerberus", "sirens", "titans", "furies"];
const mythologicalLocations = [
    "temple ruins",
    "sacred grove",
    "olympian gates",
    "underworld passage",
    "divine sanctuary",
    "mountain of the gods",
    "river Styx",
    "labyrinth of Crete",
    "island of the blessed",
    "celestial palace",
];
const mythologicalEvents = [
    "divine intervention",
    "oracle's prophecy",
    "titan's awakening",
    "celestial alignment",
    "godly dispute",
    "hero's ascension",
    "sacred festival",
    "epic battle",
    "cosmic eclipse",
    "ancient curse",
];

export const mythologicalAdventures: Adventure[] = [
    {
        description: () =>
            `As ${pickRandom(mythologicalEvents)} occurs near the ${pickRandom(mythologicalLocations)}, heroes embark on a divine quest.`,
        winMessages: [
            name => `${name} proves worthy and receives a ${pickRandom(mythologicalItems)}.`,
            name => `${name} defeats a ${pickRandom(mythologicalEnemies)} guarding a ${pickRandom(mythologicalItems)}.`,
            name => `${name} completes a trial at the ${pickRandom(mythologicalLocations)}.`,
            name => `${name} receives divine favor and is granted a ${pickRandom(mythologicalItems)}.`,
            name => `${name} solves an ancient riddle and claims a ${pickRandom(mythologicalItems)}.`,
        ],
        loseMessages: [
            name => `${name} faces the wrath of a deity at the ${pickRandom(mythologicalLocations)}.`,
            name => `${name} is cursed by a ${pickRandom(mythologicalEnemies)}.`,
            name => `${name} fails a divine challenge.`,
            name => `${name} is led astray by trickster spirits.`,
            name => `${name} angers the gods and must retreat.`,
        ],
    },
    {
        description: () => `The ${pickRandom(mythologicalEvents)} calls heroes to the ${pickRandom(mythologicalLocations)}.`,
        winMessages: [
            name => `${name} earns the favor of the gods and receives a ${pickRandom(mythologicalItems)}.`,
            name => `${name} defeats a ${pickRandom(mythologicalEnemies)} and claims a ${pickRandom(mythologicalItems)}.`,
            name => `${name} completes a trial of strength and is rewarded with a ${pickRandom(mythologicalItems)}.`,
            name => `${name} solves a riddle posed by a ${pickRandom(mythologicalEnemies)} and gains a ${pickRandom(mythologicalItems)}.`,
            name => `${name} is blessed by a divine spirit and receives a ${pickRandom(mythologicalItems)}.`,
            name => `${name} uncovers a hidden treasure containing a ${pickRandom(mythologicalItems)}.`,
            name => `${name} tames a ${pickRandom(mythologicalEnemies)} and gains its loyalty.`,
            name => `${name} restores balance to the ${pickRandom(mythologicalLocations)} and is gifted a ${pickRandom(mythologicalItems)}.`,
            name => `${name} is guided by an oracle to a ${pickRandom(mythologicalItems)}.`,
            name =>
                `${name} earns the trust of the ${pickRandom(mythologicalLocations)}'s guardians and receives a ${pickRandom(mythologicalItems)}.`,
        ],
        loseMessages: [
            name => `${name} is cursed by a ${pickRandom(mythologicalEnemies)} and must retreat.`,
            name => `${name} is overwhelmed by the trials of the ${pickRandom(mythologicalLocations)}.`,
            name => `${name} angers the gods and is forced to abandon the quest.`,
            name => `${name} is led astray by trickster spirits in the ${pickRandom(mythologicalLocations)}.`,
            name => `${name} is injured during a confrontation with a ${pickRandom(mythologicalEnemies)}.`,
            name => `${name} is caught in a divine dispute and must flee.`,
            name => `${name} is trapped in the underworld and barely escapes.`,
            name => `${name} fails to solve the riddle of the ${pickRandom(mythologicalEnemies)}.`,
            name => `${name} is turned to stone by a ${pickRandom(mythologicalEnemies)}.`,
            name => `${name} collapses from exhaustion while exploring the ${pickRandom(mythologicalLocations)}.`,
        ],
    },
];
