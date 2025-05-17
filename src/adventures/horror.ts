import { Adventure } from "./index";
import { pickRandom } from "../utils/misc";

const horrorItems = [
    "silver crucifix",
    "ancient grimoire",
    "holy water vial",
    "cursed locket",
    "ghost lantern",
    "ritual dagger",
    "protective charm",
    "mysterious key",
    "sacred candle",
    "mirror shard",
];
const horrorEnemies = [
    "vampire lord",
    "restless ghost",
    "werewolf",
    "witch",
    "zombie horde",
    "demon",
    "haunted doll",
    "ghoul",
    "banshee",
    "shadow fiend",
];
const horrorLocations = [
    "abandoned manor",
    "foggy graveyard",
    "haunted woods",
    "ancient crypt",
    "cursed chapel",
    "forgotten asylum",
    "moonlit moor",
    "creaking attic",
    "underground catacomb",
    "bloodstained cellar",
];
const horrorEvents = [
    "blood moon",
    "midnight ritual",
    "ghostly wail",
    "power outage",
    "mirror shatter",
    "strange knocking",
    "cold spot",
    "phantom footsteps",
    "sudden scream",
    "unholy storm",
];
export const horrorAdventures: Adventure[] = [
    {
        description: () => `A ${pickRandom(horrorEvents)} chills the air at the ${pickRandom(horrorLocations)}, investigators must face their fears.`,
        winMessages: [
            name => `${name} banishes the ${pickRandom(horrorEnemies)} and finds a ${pickRandom(horrorItems)}.`,
            name => `${name} solves the mystery and is rewarded with a ${pickRandom(horrorItems)}.`,
            name => `${name} escapes the ${pickRandom(horrorLocations)} with a rare artifact.`,
        ],
        loseMessages: [
            name => `${name} is haunted by the ${pickRandom(horrorEnemies)} and flees in terror.`,
            name => `${name} is cursed during the ${pickRandom(horrorEvents)}.`,
            name => `${name} is lost in the ${pickRandom(horrorLocations)} and never seen again.`,
        ],
    },
];
