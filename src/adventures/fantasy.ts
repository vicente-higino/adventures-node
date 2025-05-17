import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";
const fantasyItems = [
    "glowing gemstone",
    "enchanted dagger",
    "silver chalice",
    "dragon scale",
    "ancient rune",
    "phoenix feather",
    "wizard's staff",
    "elven bow",
    "mystic orb",
    "golden crown",
];
const fantasyEnemies = [
    "goblins",
    "troll",
    "dark knight",
    "forest spirit",
    "chimera",
    "necromancer",
    "shadow beast",
    "fire elemental",
    "ice wraith",
    "giant spider",
];
const fantasyLocations = [
    "cursed forest",
    "ancient ruins",
    "whispering glade",
    "mystic cave",
    "twilight grove",
    "crystal lake",
    "haunted castle",
    "forgotten temple",
    "sunken city",
    "volcanic peak",
];
const fantasyEffects = [
    "a raging storm",
    "a magical surge",
    "an eerie silence",
    "falling stars",
    "whispers from the shadows",
    "a blood moon",
    "a sudden eclipse",
    "a shimmering aurora",
    "a ghostly fog",
    "a celestial choir",
];

export const fantasyAdventures: Adventure[] = [
    {
        description: () =>
            `As ${pickRandom(fantasyEffects)} envelops the ${pickRandom(
                fantasyLocations,
            )}, adventurers are called to uncover ancient mysteries buried in forgotten lore.`,
        winMessages: [
            name =>
                `${name} defeats a ${pickRandom(fantasyEnemies)} and uncovers a ${pickRandom(fantasyItems)} in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} unravels a magical riddle and earns a ${pickRandom(fantasyItems)} guarded by a ${pickRandom(fantasyEnemies)}.`,
            name => `${name} sneaks past a ${pickRandom(fantasyEnemies)} and steals a ${pickRandom(fantasyItems)} from a forgotten shrine.`,
            name => `${name} discovers a secret chamber beneath the ${pickRandom(fantasyLocations)} holding a ${pickRandom(fantasyItems)}.`,
            name => `${name} is blessed by a forest spirit who gifts a ${pickRandom(fantasyItems)}.`,
            name => `${name} solves an arcane puzzle and is rewarded with a ${pickRandom(fantasyItems)}.`,
            name => `${name} climbs the peak of the ${pickRandom(fantasyLocations)} and finds a ${pickRandom(fantasyItems)}.`,
            name => `${name} wins a duel with a ${pickRandom(fantasyEnemies)} and claims their ${pickRandom(fantasyItems)}.`,
            name => `${name} finds a glowing chest buried near the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is granted a ${pickRandom(fantasyItems)} after freeing a captured spirit.`,
        ],
        loseMessages: [
            name => `${name} is injured by a ${pickRandom(fantasyEnemies)} while exploring the ${pickRandom(fantasyLocations)}.`,
            name => `${name} gets lost in the ${pickRandom(fantasyLocations)} and finds nothing.`,
            name => `${name}'s spell backfires near the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is turned around by illusions cast by a ${pickRandom(fantasyEnemies)}.`,
            name => `${name} nearly drowns in the underground river of the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is chased away by an angry ${pickRandom(fantasyEnemies)}.`,
            name => `${name} falls into a trap set in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} accidentally destroys the artifact in a skirmish with a ${pickRandom(fantasyEnemies)}.`,
            name => `${name} collapses from exhaustion before reaching the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is cursed by an ancient relic and must retreat to recover.`,
        ],
    },
    {
        description: () => `Deep in the heart of ${pickRandom(fantasyLocations)}, an ancient power stirs beneath the earth.`,
        winMessages: [
            name => `${name} discovers a ${pickRandom(fantasyItems)} hidden in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} defeats a ${pickRandom(fantasyEnemies)} and earns the respect of the ${pickRandom(fantasyLocations)}'s guardians.`,
            name => `${name} solves a puzzle left by ancient mages and uncovers a ${pickRandom(fantasyItems)}.`,
            name => `${name} befriends a ${pickRandom(fantasyEnemies)} who shares the secrets of the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is guided by ${pickRandom(fantasyEffects)} to a hidden ${pickRandom(fantasyItems)}.`,
            name => `${name} braves the ${pickRandom(fantasyLocations)} and retrieves a ${pickRandom(fantasyItems)}.`,
            name => `${name} earns the blessing of a ${pickRandom(fantasyEnemies)} and gains a ${pickRandom(fantasyItems)}.`,
            name => `${name} uncovers a ${pickRandom(fantasyItems)} while exploring the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is rewarded by the spirits of the ${pickRandom(fantasyLocations)} with a ${pickRandom(fantasyItems)}.`,
            name => `${name} outsmarts a ${pickRandom(fantasyEnemies)} and claims a ${pickRandom(fantasyItems)}.`,
        ],
        loseMessages: [
            name => `${name} is ambushed by a ${pickRandom(fantasyEnemies)} in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is caught in ${pickRandom(fantasyEffects)} and loses their way.`,
            name => `${name} is cursed by a ${pickRandom(fantasyEnemies)} and must retreat.`,
            name => `${name} falls into a trap set in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is overwhelmed by the magic of the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is chased out of the ${pickRandom(fantasyLocations)} by a ${pickRandom(fantasyEnemies)}.`,
            name => `${name} accidentally destroys a ${pickRandom(fantasyItems)} in a skirmish.`,
            name => `${name} is turned around by illusions in the ${pickRandom(fantasyLocations)}.`,
            name => `${name} is injured by a ${pickRandom(fantasyEnemies)} and forced to retreat.`,
            name => `${name} collapses from exhaustion while exploring the ${pickRandom(fantasyLocations)}.`,
        ],
    },
];
