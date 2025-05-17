import { Context } from "hono";
import { pickRandom } from "utils/misc";
import { Env, ParseAiResponse } from "types";
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

async function generateAiAdventure(c: Context<Env>, adventure: Adventure, players: { name: string; outcome: AdventureOutcome }[]) {
    const adventureDescription = adventure.description();
    const winnerplayers = players.filter(player => player.outcome === "win").map(player => player.name);
    const loserplayers = players.filter(player => player.outcome === "lose").map(player => player.name);
    const winnersAdv = winnerplayers.map(player => pickRandom(adventure.winMessages)(player)).join(", ");
    const losersAdv = loserplayers.map(player => pickRandom(adventure.loseMessages)(player)).join(", ");
    const advMessage = "" + adventureDescription + "\n" + winnersAdv + " win the adventure!\n" + losersAdv + " lose the adventure!";
    const aiRes = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
            {
                role: "system",
                content:
                    "You are a role-playing dungeon master, give some details to world building, expand players' story, always include the players names, DO NOT make new players, limit to 1 paragraph and 100 words",
            },
            { role: "user", content: JSON.stringify(advMessage) },
        ],
    });
    const { response } = ParseAiResponse.parse(aiRes);
    return { response };
}
