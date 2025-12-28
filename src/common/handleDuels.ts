import { findOrCreateBalance, increaseBalanceWithChannelID, updateUseDuelsStats } from "@/db";
import { ADVENTURE_COOLDOWN_EMOTES, DUEL_CREATE_EMOTES, DUEL_DENY_EMOTES, DUEL_WIN_EMOTES } from "@/emotes";
import env from "@/env";
import { prisma } from "@/prisma";
import { getUserById } from "@/twitch/api";
import { calculateAmount, delay, pickRandom } from "@/utils/misc";
import { formatTimeToWithSeconds } from "@/utils/time";
import { Mutex } from "async-mutex";
import dayjs from "dayjs";
import { amountParamSchema } from "./handleAdventure";

const duelCooldownMs = () => 1000 * 60 * 60 * env.COOLDOWN_DUEL_IN_HOURS;
const duelMutexMap: Map<string, Mutex> = new Map();

function getDuelMutex(duelKey: string): Mutex {
    if (!duelMutexMap.has(duelKey)) {
        duelMutexMap.set(duelKey, new Mutex());
    }
    return duelMutexMap.get(duelKey)!;
}

export async function handleDuelCreate(params: {
    channelLogin: string;
    channelProviderId: string;
    challengerId: string;
    challengedId: string;
    userlogin: string;
    userDisplayName: string;
    wagerAmountStr: string;
    prefix?: string;
}) {
    const { channelLogin, channelProviderId, challengerId, challengedId, userlogin, userDisplayName, wagerAmountStr, prefix } = params;

    if (!challengedId) {
        return `Missing username. Try ${prefix ?? "!"}duel username silver`;
    }

    const parseResult = amountParamSchema.safeParse(wagerAmountStr);
    if (!parseResult.success) {
        return `Usage: ${prefix ?? "!"}duel username [silver(K/M/B)|%|all]`;
    }

    const challenged = await getUserById(prisma, challengedId);
    if (!challenged) {
        return "user not found";
    }
    if (challengerId == challengedId) {
        return `@${userDisplayName}, you can't duel yourself.`;
    }

    const existingDuel = await prisma.duel.findFirst({
        where: { channelProviderId, challengerId, challengedId, status: "Pending" },
        include: { challenger: true, challenged: true },
    });
    if (existingDuel) {
        return `@${userDisplayName}, this duel already exists with a ${existingDuel.wagerAmount} silver bet. 
                Use "${prefix ?? "!"}cancelduel" to cancel this duel.
                $(newline)@${existingDuel.challenged.displayName} you can use "${prefix ?? "!"}accept|deny".`;
    }

    const reverseDuel = await prisma.duel.findFirst({
        where: { channelProviderId, challengerId: challengedId, challengedId: challengerId, status: "Pending" },
        include: { challenger: true, challenged: true },
    });

    if (reverseDuel) {
        return `@${userDisplayName}, ${challenged.displayName} has already challenged you for a duel with a ${reverseDuel.wagerAmount} silver bet! 
                You can use "${prefix ?? "!"}accept|deny" to respond.`;
    }

    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, challengerId, userlogin, userDisplayName);
    const actualWagerAmount = calculateAmount(wagerAmountStr, balance.value);

    if (actualWagerAmount < 1) {
        return `@${userDisplayName}, the minimum wager amount is 1 silver.`;
    }
    if (actualWagerAmount > balance.value) {
        return `@${userDisplayName}, you don't have enough silver (${balance.value}) to wager ${actualWagerAmount}.`;
    }

    // Duel cooldown check
    const lastCompletedDuel = await prisma.duel.findFirst({
        where: { channelProviderId, status: "Completed", challengerId },
        orderBy: { updatedAt: "desc" },
    });

    if (lastCompletedDuel) {
        const lastEndedAt = lastCompletedDuel.updatedAt;
        const nextAvailable = new Date(lastEndedAt.getTime() + duelCooldownMs());
        const now = new Date();
        const secondsLeft = Math.floor((nextAvailable.getTime() - now.getTime()) / 1000);
        if (secondsLeft >= 1) {
            const timeUntilNext = dayjs(nextAvailable);
            return `@${userDisplayName}, you are on cooldown for ${formatTimeToWithSeconds(timeUntilNext.toDate())}. ${pickRandom(ADVENTURE_COOLDOWN_EMOTES)}`;
        }
    }

    await Promise.all([
        increaseBalanceWithChannelID(prisma, channelProviderId, challengerId, -actualWagerAmount),
        prisma.duel.create({
            data: { channelProviderId, channel: channelLogin, challengerId, challengedId, wagerAmount: actualWagerAmount, status: "Pending" },
        }),
    ]);

    return `@${userDisplayName} challenged ${challenged.displayName} for a duel with a ${actualWagerAmount} silver bet! ${pickRandom(DUEL_CREATE_EMOTES)}
             $(newline)@${challenged.displayName} you can use "${prefix ?? "!"}accept|deny".`;
}

export async function handleDuelAccept(params: {
    channelLogin: string;
    channelProviderId: string;
    challengedId: string;
    userlogin: string;
    userDisplayName: string;
    challengerId?: string | null;
}) {
    const { channelLogin, channelProviderId, challengedId, userlogin, userDisplayName, challengerId } = params;

    let duel;
    if (challengerId) {
        if (challengerId == challengedId) {
            return `@${userDisplayName}, you can't duel yourself.`;
        }
        duel = await prisma.duel.findFirst({
            where: { channelProviderId, challengerId, challengedId, status: "Pending" },
            include: { challenger: true },
        });

        if (!duel) {
            const challengerInfo = await getUserById(prisma, challengerId);
            const challengerName = challengerInfo?.displayName ?? challengerId;
            return `@${userDisplayName}, you have no pending duels from ${challengerName}.`;
        }
    } else {
        duel = await prisma.duel.findFirst({
            where: { channelProviderId, challengedId, status: "Pending" },
            orderBy: { createdAt: "asc" },
            include: { challenger: true },
        });

        if (!duel) {
            return `@${userDisplayName}, you have no pending duels to accept.`;
        }
    }

    // Use mutex per duel id
    const duelKey = String(duel.id);
    const mutex = getDuelMutex(duelKey);
    return await mutex.runExclusive(async () => {
        // Re-fetch duel inside lock to ensure up-to-date status
        const lockedDuel = await prisma.duel.findUnique({ where: { id: duel.id }, include: { challenger: true } });
        if (!lockedDuel || lockedDuel.status !== "Pending") {
            return `@${userDisplayName}, this duel is no longer pending.`;
        }

        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, challengedId, userlogin, userDisplayName);
        if (lockedDuel.wagerAmount > balance.value) {
            return `@${userDisplayName}, you don't have enough silver (${balance.value}) to accept the ${lockedDuel.wagerAmount} silver duel from ${lockedDuel.challenger.displayName}.`;
        }
        const isChallengerWinner = Math.random() < 0.5;
        const winnerId = isChallengerWinner ? lockedDuel.challengerId : lockedDuel.challengedId;
        const loserId = isChallengerWinner ? lockedDuel.challengedId : lockedDuel.challengerId;
        let winnerDisplayName = isChallengerWinner ? lockedDuel.challenger.displayName : userDisplayName;
        let loserDisplayName = isChallengerWinner ? userDisplayName : lockedDuel.challenger.displayName;

        if (isChallengerWinner) {
            await Promise.all([
                increaseBalanceWithChannelID(prisma, channelProviderId, loserId, -lockedDuel.wagerAmount),
                increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, lockedDuel.wagerAmount * 2),
            ]);
        } else {
            await increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, lockedDuel.wagerAmount);
        }

        const [winnerStats, loserStats] = await Promise.all([
            updateUseDuelsStats(prisma, channelLogin, channelProviderId, winnerId, {
                didWin: true,
                wagerAmount: lockedDuel.wagerAmount,
                winAmount: lockedDuel.wagerAmount * 2,
            }),
            updateUseDuelsStats(prisma, channelLogin, channelProviderId, loserId, { didWin: false, wagerAmount: lockedDuel.wagerAmount, winAmount: 0 }),
        ]);

        await prisma.duel.update({ where: { id: lockedDuel.id }, data: { status: "Completed" } });

        // Clear mutex after completion
        duelMutexMap.delete(duelKey);

        if (winnerStats.duelWinStreak > 1) {
            winnerDisplayName += ` (${winnerStats.duelWinStreak} wins in a row)`;
        }
        if (loserStats.duelLoseStreak > 1) {
            loserDisplayName += ` (${loserStats.duelLoseStreak} losses in a row)`;
        }

        return `@${winnerDisplayName} won the duel against ${loserDisplayName} and claimed ${lockedDuel.wagerAmount} silver! ${pickRandom(DUEL_WIN_EMOTES)}`;
    });
}

export async function handleDuelCancel(params: {
    channelProviderId: string;
    currentUserId: string;
    userDisplayName: string;
    challengedId?: string | null;
}) {
    const { channelProviderId, currentUserId, userDisplayName, challengedId } = params;

    let duel;
    let otherUserName: string | null = null;

    if (challengedId) {
        if (challengedId === currentUserId) {
            return `@${userDisplayName}, you can't duel with yourself.`;
        }
        duel = await prisma.duel.findFirst({
            where: {
                channelProviderId,
                status: "Pending",
                OR: [
                    { challengerId: currentUserId, challengedId },
                    { challengerId: challengedId, challengedId: currentUserId },
                ],
            },
            include: { challenged: true, challenger: true },
        });
        if (!duel) {
            const otherUserInfo = await getUserById(prisma, challengedId);
            otherUserName = otherUserInfo?.displayName ?? challengedId;
            return `@${userDisplayName}, there is no pending duel between you and ${otherUserName}.`;
        }
    } else {
        duel = await prisma.duel.findFirst({
            where: { channelProviderId, status: "Pending", OR: [{ challengerId: currentUserId }, { challengedId: currentUserId }] },
            orderBy: { createdAt: "asc" },
            include: { challenged: true, challenger: true },
        });

        if (!duel) {
            return `@${userDisplayName}, you have no pending duels to cancel or deny.`;
        }
    }

    // Use mutex per duel id
    const duelKey = String(duel.id);
    const mutex = getDuelMutex(duelKey);
    return await mutex.runExclusive(async () => {
        // Re-fetch duel inside lock to ensure up-to-date status
        const lockedDuel = await prisma.duel.findUnique({ where: { id: duel.id }, include: { challenged: true, challenger: true } });
        if (!lockedDuel || lockedDuel.status !== "Pending") {
            return `@${userDisplayName}, this duel is no longer pending.`;
        }

        await Promise.all([
            increaseBalanceWithChannelID(prisma, channelProviderId, lockedDuel.challengerId, lockedDuel.wagerAmount),
            prisma.duel.delete({ where: { id: lockedDuel.id } }),
        ]);

        // Clear mutex after cancellation
        duelMutexMap.delete(duelKey);

        const otherUser = currentUserId === lockedDuel.challengerId ? lockedDuel.challenged : lockedDuel.challenger;
        otherUserName = otherUser.displayName;

        if (currentUserId === lockedDuel.challengerId) {
            return `@${userDisplayName} cancelled their duel challenge to ${otherUserName}!`;
        } else {
            return `@${userDisplayName} declined the duel challenge from ${otherUserName}! ${pickRandom(DUEL_DENY_EMOTES)}`;
        }
    });
}
