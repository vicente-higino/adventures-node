import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";

const cyberpunkItems = [
    "neural implant",
    "prototype AI chip",
    "quantum decoder",
    "holo-weapon",
    "stealth module",
    "cybernetic arm",
    "augmented reality visor",
    "encrypted data shard",
    "energy katana",
    "bio-enhancement serum",
];
const cyberpunkEnemies = [
    "corporate enforcers",
    "rogue AI",
    "street gangs",
    "cyber-assassins",
    "corrupt netrunners",
    "black market dealers",
    "hacked drones",
    "mercenary squads",
    "underground hackers",
    "cyber-augmented beasts",
];
const cyberpunkLocations = [
    "neon district",
    "underground server farm",
    "corporate arcology",
    "black market hub",
    "data haven",
    "abandoned subway",
    "high-rise slums",
    "cybernetic clinic",
    "virtual reality lounge",
    "hacker's den",
];
const cyberpunkEvents = [
    "system blackout",
    "corporate uprising",
    "net crash",
    "drone swarm",
    "data storm",
    "power grid failure",
    "massive DDoS attack",
    "cyber-heist",
    "AI takeover",
    "neural network overload",
];

export const cyberpunkAdventures: Adventure[] = [
    {
        description: () =>
            `During a ${pickRandom(cyberpunkEvents)} in the ${pickRandom(cyberpunkLocations)}, runners seek valuable data in the urban sprawl.`,
        winMessages: [
            name => `${name} hacks through corporate ICE and extracts a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} outsmarts ${pickRandom(cyberpunkEnemies)} and acquires a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} infiltrates a secure facility and steals a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} makes a deal in the ${pickRandom(cyberpunkLocations)} for a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} recovers a ${pickRandom(cyberpunkItems)} from a crashed security drone.`,
        ],
        loseMessages: [
            name => `${name} triggers an alarm in the ${pickRandom(cyberpunkLocations)}.`,
            name => `${name} is tracked down by ${pickRandom(cyberpunkEnemies)}.`,
            name => `${name}'s cybernetics glitch during the hack.`,
            name => `${name} gets locked out by adaptive security systems.`,
            name => `${name} is betrayed by a fixer and loses the payload.`,
        ],
    },
    {
        description: () => `A daring raid on a ${pickRandom(cyberpunkLocations)} promises high rewards.`,
        winMessages: [
            name => `${name} hacks into the ${pickRandom(cyberpunkLocations)} and retrieves a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} outsmarts ${pickRandom(cyberpunkEnemies)} and secures a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} infiltrates a ${pickRandom(cyberpunkLocations)} and steals a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} negotiates with a rogue AI and gains a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} survives a ${pickRandom(cyberpunkEvents)} and retrieves a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} uncovers a hidden cache containing a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} disables a ${pickRandom(cyberpunkEnemies)} and claims their ${pickRandom(cyberpunkItems)}.`,
            name => `${name} makes a deal in the ${pickRandom(cyberpunkLocations)} and secures a ${pickRandom(cyberpunkItems)}.`,
            name => `${name} recovers a ${pickRandom(cyberpunkItems)} from a crashed drone.`,
            name => `${name} creates a diversion and escapes with a ${pickRandom(cyberpunkItems)}.`,
        ],
        loseMessages: [
            name => `${name} is caught in a ${pickRandom(cyberpunkEvents)} and forced to retreat.`,
            name => `${name} is ambushed by ${pickRandom(cyberpunkEnemies)} and loses valuable data.`,
            name => `${name} is betrayed by a fixer and loses access to the ${pickRandom(cyberpunkLocations)}.`,
            name => `${name} is overwhelmed by the security systems of the ${pickRandom(cyberpunkLocations)}.`,
            name => `${name} is injured during a confrontation with ${pickRandom(cyberpunkEnemies)}.`,
            name => `${name} is locked out of the system by adaptive security protocols.`,
            name => `${name} is forced to abandon the mission due to a ${pickRandom(cyberpunkEvents)}.`,
            name => `${name} is tracked down by ${pickRandom(cyberpunkEnemies)} and must flee.`,
            name => `${name} is caught in a net crash and loses their connection.`,
            name => `${name} is outsmarted by a rogue AI and loses the payload.`,
        ],
    },
];
