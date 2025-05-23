import { pickRandom } from "@/utils/misc";
import { postApocAdventures } from "./postApoc";
import { pirateAdventures } from "./pirate";
import { steampunkAdventures } from "./steampunk";
import { heroAdventures } from "./hero";
import { horrorAdventures } from "./horror";
import { westAdventures } from "./west";
import { spyAdventures } from "./spy";
import { egyptAdventures } from "./egypt";
import { atlantisAdventures } from "./atlantis";
import { dinoAdventures } from "./dino";
import { fantasyAdventures } from "./fantasy";
import { sciFiAdventures } from "./sciFi";
import { cyberpunkAdventures } from "./cyberpunk";
import { mythologicalAdventures } from "./mythological";
import { customAdventures } from "./custom";

type AdventureOutcome = "win" | "lose";

export interface Adventure {
    description: () => string;
    endWin?: (names?: string) => string;
    endLose?: (names?: string) => string;
    winMessages: ((name: string) => string)[];
    loseMessages: ((name: string) => string)[];
}

interface PlayerAdventureResult {
    player: string;
    outcome: AdventureOutcome;
    message: string;
}

const adventures: Adventure[] = [
    ...fantasyAdventures,
    ...sciFiAdventures,
    ...cyberpunkAdventures,
    ...mythologicalAdventures,
    ...postApocAdventures,
    ...pirateAdventures,
    ...steampunkAdventures,
    ...heroAdventures,
    ...horrorAdventures,
    ...westAdventures,
    ...spyAdventures,
    ...egyptAdventures,
    ...atlantisAdventures,
    ...dinoAdventures,
    ...customAdventures,
];

function randomAdventure(): Adventure {
    return pickRandom(adventures);
}
export function runGroupAdventure(players: string[]) {
    const adventure = randomAdventure();
    const results: PlayerAdventureResult[] = players.map(player => {
        const outcome = Math.random() > 0.5 ? "win" : "lose";
        const message = outcome === "win" ? pickRandom(adventure.winMessages)(player) : pickRandom(adventure.loseMessages)(player);
        return { player, outcome, message };
    });

    const resultLines = results.map(res => `${res.message}`).join(" ");
    const winnerplayers = results
        .filter(res => res.outcome === "win")
        .map(res => res.player)
        .join(", ");
    const loserplayers = results
        .filter(res => res.outcome === "lose")
        .map(res => res.player)
        .join(", ");

    return {
        results,
        message: `${adventure.description()}\n${resultLines}\n
        ${adventure.endLose ? adventure.endLose(loserplayers) : ""} ${adventure.endWin ? adventure.endWin(winnerplayers) : ""}`,
    };
}
