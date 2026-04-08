import { submitMove } from "@/bot/rps";
import { createWhisperCommand } from "@/bot/whispers";
import { CONGRATULATIONS_EMOTES } from "@/emotes";
import { prisma } from "@/prisma";
import { getUserById } from "@/twitch/api";
import { pickRandom, sendMessageToChannel, sendMessageToChannelId } from "@/utils/misc";
import { type RpsMove } from "@prisma/client";
import { z } from "zod";

const rpsParamsSchema = z.string();

function parseRpsMove(move: string): RpsMove | null {
    const normalized = move.toLowerCase().trim();

    // Full names
    if (normalized === "rock") return "ROCK";
    if (normalized === "paper") return "PAPER";
    if (normalized === "scissors") return "SCISSORS";

    // Single letters
    if (normalized === "r") return "ROCK";
    if (normalized === "p") return "PAPER";
    if (normalized === "s") return "SCISSORS";

    // Emojis
    if (move === "🪨") return "ROCK";
    if (move === "📄" || move === "📃") return "PAPER";
    if (move === "✂️" || move === "✂") return "SCISSORS";

    return null;
}

const LOOKUP: Record<RpsMove, string> = { ROCK: "🪨", PAPER: "📄", SCISSORS: "✂️" };

export const rpsWhisper = createWhisperCommand(
    "rps",
    async (params, { context, reply }) => {
        const { senderUserId } = context;
        const validMoves = params.filter(p => parseRpsMove(p));
        const firstMove = parseRpsMove(pickRandom(validMoves));
        if (!firstMove) {
            reply("Please provide your move: rock, paper, or scissors (or r/p/s)s");
            return;
        }
        const result = await submitMove(senderUserId, firstMove);
        switch (result.status) {
            case "error":
                reply(`Error submitting move: ${result.error}`);
                break;
            case "canceled":
                sendMessageToChannel(result.channel, result.msg);
                break;
            case "pending":
                reply("Move submitted, waiting for opponent...");
                break;
            case "resolved":
                const streakPart = result.matchEnd && result.winStreak > 1 ? ` (${result.winStreak} wins in a row)` : "";
                const winnerPart = result.matchEnd ? `@${result.winner} (+${result.wager} silver)${streakPart}` : null;
                const msg = `@${result.playerA} (${result.scoreA}) ${LOOKUP[result.moveA]} x ${LOOKUP[result.moveB]} (${result.scoreB}) @${result.playerB} 
                | R${result.round} | ${winnerPart ? `${winnerPart} ${CONGRATULATIONS_EMOTES(result.channel)}` : "Next round starting..."}`;
                sendMessageToChannel(result.channel, msg);
                break;
        }
    },
    { keywords: ["rock", "paper", "scissors", "r", "p", "s"], ignoreCase: true },
);
