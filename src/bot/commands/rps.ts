import { createBotCommand } from "../BotCommandWithKeywords";
import { getBotConfig } from "@/bot";
import { getUserByUsername } from "@/twitch/api";
import { prisma } from "@/prisma";
import { cancelRPSMatch, createMatch } from "@/bot/rps";
import { calculateAmount } from "@/utils/misc";
import { decreaseBalance, findOrCreateBalance } from "@/db";
import logger from "@/logger";
import boss from "@/db/boss";
import env from "@/env";
import dayjs from "dayjs";
import { formatTimeToWithSeconds } from "@/utils/time";

const TIMEOUT_DURATION = 10 * 60 * 1000;
const rpsCooldownMs = () => 1000 * 60 * 60 * env.COOLDOWN_DUEL_IN_HOURS;

export const rpsCommand = createBotCommand(
    "rps",
    async (params, ctx) => {
        const { broadcasterId, broadcasterName, userDisplayName, userId, userName, say } = ctx;
        const useMsg = `Usage: ${getBotConfig().prefix}rps username [silver(K/M/B)|%|all]`;
        let usernameArg = params.shift();
        const wagerAmountStr = params.shift();
        if (!usernameArg || !wagerAmountStr) {
            say(useMsg);
            return;
        }

        const lastMatch = await prisma.match.findFirst({
            where: { channel: broadcasterId, OR: [{ playerA: userId }, { playerB: userId }], status: "COMPLETE" },
            orderBy: { completedAt: "desc" },
        });

        if (lastMatch && lastMatch.completedAt) {
            const nextAvailableA = new Date(lastMatch.completedAt.getTime() + rpsCooldownMs());
            const now = new Date();
            const secondsLeft = Math.floor((nextAvailableA.getTime() - now.getTime()) / 1000);
            if (secondsLeft >= 1) {
                const timeUntilNext = dayjs(nextAvailableA);
                return say(`@${userDisplayName}, you are on cooldown for ${formatTimeToWithSeconds(timeUntilNext.toDate())}.`);
            }
        }

        const match = await prisma.match.findFirst({ where: { status: "ACTIVE", channel: broadcasterId } });
        if (match) {
            say(`@${userDisplayName}, only one match can be active at a time.`);
            return;
        }
        const user = await getUserByUsername(prisma, usernameArg.replaceAll("@", ""));
        if (!user) {
            say(useMsg);
            return;
        }
        const balance = await findOrCreateBalance(prisma, broadcasterName, broadcasterId, userId, userName, userDisplayName);
        const wager = calculateAmount(wagerAmountStr, balance.value, balance.value);
        if (user.id === userId) {
            return say(`@${userDisplayName}, you cannot challenge yourself.`);
        }
        if (wager < 1) {
            return say(`@${userDisplayName}, the minimum wager amount is 1 silver.`);
        }
        if (wager > balance.value) {
            return say(`@${userDisplayName}, you don't have enough silver (${balance.value}) to wager ${wager}.`);
        }
        try {
            const result = await createMatch(broadcasterId, userId, user.id, wager);
            if (result) {
                await decreaseBalance(prisma, balance.id, wager);
                boss.sendAfter("rps-cancel", { matchId: result.id.toString() }, null, TIMEOUT_DURATION / 1000);
                say(`@${userDisplayName} challenges ${user.displayName} to a Bo3 game of RPS for ${wager} silver! Whisper "[r|p|s]" to the bot.`);
            } else {
                say(`Error creating match. Please try again later.`);
            }
        } catch (error) {
            logger.error(error, "Error creating match");
            say(`Error creating match. Please try again later.`);
        }
    },
    { aliases: [], ignoreCase: true },
);

export const cancelRPSCommand = createBotCommand(
    "cancelrps",
    async (params, ctx) => {
        const { broadcasterId, userDisplayName, say } = ctx;
        const match = await prisma.match.findFirst({
            where: { channel: broadcasterId, status: "ACTIVE", OR: [{ playerA: ctx.userId }, { playerB: ctx.userId }] },
            orderBy: { createdAt: "desc" },
        });
        if (!match) {
            say(`@${userDisplayName}, you don't have an active match to cancel.`);
            return;
        }
        const res = await cancelRPSMatch(match.id);
        if (res.status === "error") {
            logger.error({ matchId: match.id, error: res.error }, "Error canceling match");
            say(`@${userDisplayName}, error canceling match: ${res.error}`);
            return;
        }
        if (res.status === "success") {
            say(`@${userDisplayName}, your match has been canceled.`);
        }
    },
    { aliases: ["crps"], ignoreCase: true },
);
