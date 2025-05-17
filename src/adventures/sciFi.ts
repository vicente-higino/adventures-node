import { pickRandom } from "../utils/misc";
import { Adventure } from "./index";

const sciFiTech = [
    "nanotech artifact",
    "plasma rifle",
    "holographic AI",
    "fusion core",
    "quantum drive",
    "gravity manipulator",
    "neural uplink",
    "antimatter reactor",
    "stealth field generator",
    "tachyon scanner",
];
const sciFiEnemies = [
    "rogue androids",
    "space pirates",
    "alien predators",
    "malfunctioning drones",
    "cosmic anomalies",
    "genetic mutants",
    "hostile AI",
    "void creatures",
    "time bandits",
    "black hole entities",
];
const sciFiLocations = [
    "derelict star cruiser",
    "orbital station",
    "asteroid lab",
    "planetary base",
    "quantum rift",
    "alien megastructure",
    "deep space outpost",
    "terraforming colony",
    "nebula research station",
    "abandoned mining facility",
];
const sciFiEvents = [
    "gravity malfunction",
    "plasma storm",
    "AI rebellion",
    "communications blackout",
    "temporal distortion",
    "wormhole collapse",
    "alien invasion",
    "solar flare",
    "asteroid collision",
    "quantum anomaly",
];

export const sciFiAdventures: Adventure[] = [
    {
        description: () =>
            `Amidst ${pickRandom(sciFiEvents)} near the ${pickRandom([
                "Orion Rift",
                "Sigma Expanse",
                "Oblivion Veil",
            ])} system, a mission is launched to salvage secrets left behind in a forgotten ${pickRandom(sciFiLocations)}.`,
        winMessages: [
            name => `${name} decodes alien glyphs and discovers a ${pickRandom(sciFiTech)} aboard a ${pickRandom(sciFiLocations)}.`,
            name => `${name} disables a ${pickRandom(sciFiEnemies)} and retrieves a ${pickRandom(sciFiTech)}.`,
            name => `${name} rescues a stranded pilot who gifts them a ${pickRandom(sciFiTech)}.`,
            name => `${name} bypasses a security grid to access a hidden ${pickRandom(sciFiTech)}.`,
            name => `${name} survives a space-time rift and collects a rare ${pickRandom(sciFiTech)}.`,
            name => `${name} outwits a ${pickRandom(sciFiEnemies)} and salvages a ${pickRandom(sciFiTech)}.`,
            name => `${name} cracks a locked vault to reveal a ${pickRandom(sciFiTech)}.`,
            name => `${name} makes contact with an alien intelligence and is gifted a ${pickRandom(sciFiTech)}.`,
            name => `${name} follows a pulse signal to a buried ${pickRandom(sciFiTech)}.`,
            name => `${name} secures a ${pickRandom(sciFiTech)} after negotiating with smugglers.`,
        ],
        loseMessages: [
            name => `${name}'s ship is damaged by a ${pickRandom(sciFiEnemies)} while scanning a ${pickRandom(sciFiLocations)}.`,
            name => `${name} is ambushed by ${pickRandom(sciFiEnemies)} and forced to flee.`,
            name => `${name}'s tools malfunction while attempting to hack a ${pickRandom(sciFiLocations)}.`,
            name => `${name} is ejected from a docking bay by hostile forces.`,
            name => `${name}'s scans reveal nothing of value on the ${pickRandom(sciFiLocations)}.`,
            name => `${name} runs out of oxygen while navigating a derelict corridor.`,
            name => `${name} is detained by a space patrol and misses the mission.`,
            name => `${name} misinterprets signals and is led astray.`,
            name => `${name} is caught in a time loop and makes no progress.`,
            name => `${name} loses their equipment in a cargo malfunction.`,
        ],
    },
    {
        description: () => `A mysterious signal from the ${pickRandom(sciFiLocations)} prompts an urgent investigation.`,
        winMessages: [
            name => `${name} deciphers the signal and discovers a ${pickRandom(sciFiTech)}.`,
            name => `${name} outmaneuvers ${pickRandom(sciFiEnemies)} and retrieves a ${pickRandom(sciFiTech)}.`,
            name => `${name} salvages a ${pickRandom(sciFiTech)} from the wreckage of a ${pickRandom(sciFiLocations)}.`,
            name => `${name} negotiates with alien traders and secures a ${pickRandom(sciFiTech)}.`,
            name => `${name} survives a ${pickRandom(sciFiEvents)} and uncovers a ${pickRandom(sciFiTech)}.`,
            name => `${name} hacks into a derelict ${pickRandom(sciFiLocations)} and retrieves a ${pickRandom(sciFiTech)}.`,
            name => `${name} disables a ${pickRandom(sciFiEnemies)} and claims their ${pickRandom(sciFiTech)}.`,
            name => `${name} discovers a hidden vault containing a ${pickRandom(sciFiTech)}.`,
            name => `${name} makes contact with an alien intelligence and is gifted a ${pickRandom(sciFiTech)}.`,
            name => `${name} follows a trail of clues to a ${pickRandom(sciFiLocations)} and finds a ${pickRandom(sciFiTech)}.`,
        ],
        loseMessages: [
            name => `${name}'s ship is damaged by ${pickRandom(sciFiEnemies)} while approaching the ${pickRandom(sciFiLocations)}.`,
            name => `${name} is caught in a ${pickRandom(sciFiEvents)} and forced to retreat.`,
            name => `${name} is ambushed by ${pickRandom(sciFiEnemies)} and loses valuable equipment.`,
            name => `${name} is trapped in a malfunctioning ${pickRandom(sciFiLocations)}.`,
            name => `${name} is outsmarted by a ${pickRandom(sciFiEnemies)} and must flee.`,
            name => `${name} is caught in a temporal distortion and loses track of time.`,
            name => `${name} is overwhelmed by the hostile environment of the ${pickRandom(sciFiLocations)}.`,
            name => `${name} is forced to abandon the mission due to a ${pickRandom(sciFiEvents)}.`,
            name => `${name} is betrayed by an ally and loses access to the ${pickRandom(sciFiLocations)}.`,
            name => `${name} is injured during a confrontation with ${pickRandom(sciFiEnemies)}.`,
        ],
    },
];
