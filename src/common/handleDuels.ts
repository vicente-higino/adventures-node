import { PrismaClient } from "@prisma/client";
import { getUserById } from "@/twitch/api";
import { findOrCreateBalance, increaseBalanceWithChannelID, updateUseDuelsStats } from "@/db";
import { pickRandom, calculateAmount } from "@/utils/misc";
import { DUEL_CREATE_EMOTES, DUEL_WIN_EMOTES, DUEL_DENY_EMOTES } from "@/emotes";
import { prisma } from "@/prisma";
import { amountParamSchema } from "./handleAdventure";

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

    const existingDuel = await prisma.duel.findUnique({
        where: { channelProviderId_challengerId_challengedId: { channelProviderId, challengerId, challengedId } },
        include: { challenger: true, challenged: true },
    });
    if (existingDuel) {
        return `@${userDisplayName}, this duel already exists with a ${existingDuel.wagerAmount} silver bet. 
                Use "${prefix ?? "!"}cancelduel" to cancel this duel.
                $(newline)@${existingDuel.challenged.displayName} you can use "${prefix ?? "!"}accept|deny".`;
    }

    const reverseDuel = await prisma.duel.findUnique({
        where: {
            channelProviderId_challengerId_challengedId: {
                channelProviderId,
                challengerId: challengedId,
                challengedId: challengerId,
            },
        },
        include: {
            challenger: true,
            challenged: true,
        },
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

    await Promise.all([
        increaseBalanceWithChannelID(prisma, channelProviderId, challengerId, -actualWagerAmount),
        prisma.duel.create({
            data: { channelProviderId, channel: channelLogin, challengerId, challengedId, wagerAmount: actualWagerAmount, status: "Pending" },
        }),
    ]);

    return `@${userDisplayName} challenged ${challenged.displayName} for a duel with a ${actualWagerAmount} silver bet! ${pickRandom(DUEL_CREATE_EMOTES)}
             $(newline)@${challenged.displayName} you can use "!accept|deny".`;
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
        duel = await prisma.duel.findUnique({
            where: { channelProviderId_challengerId_challengedId: { channelProviderId, challengerId, challengedId } },
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

    if (duel.status !== "Pending") {
        return `@${userDisplayName}, this duel is no longer pending.`;
    }

    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, challengedId, userlogin, userDisplayName);
    if (duel.wagerAmount > balance.value) {
        return `@${userDisplayName}, you don't have enough silver (${balance.value}) to accept the ${duel.wagerAmount} silver duel from ${duel.challenger.displayName}.`;
    }
    const isChallengerWinner = Math.random() < 0.5;
    const winnerId = isChallengerWinner ? duel.challengerId : duel.challengedId;
    const loserId = isChallengerWinner ? duel.challengedId : duel.challengerId;
    let winnerDisplayName = isChallengerWinner ? duel.challenger.displayName : userDisplayName;
    let loserDisplayName = isChallengerWinner ? userDisplayName : duel.challenger.displayName;

    if (isChallengerWinner) {
        await Promise.all([
            increaseBalanceWithChannelID(prisma, channelProviderId, loserId, -duel.wagerAmount),
            increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, duel.wagerAmount * 2),
        ]);
    } else {
        await increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, duel.wagerAmount);
    }

    const [winnerStats, loserStats] = await Promise.all([
        updateUseDuelsStats(prisma, channelLogin, channelProviderId, winnerId, {
            didWin: true,
            wagerAmount: duel.wagerAmount,
            winAmount: duel.wagerAmount * 2,
        }),
        updateUseDuelsStats(prisma, channelLogin, channelProviderId, loserId, {
            didWin: false,
            wagerAmount: duel.wagerAmount,
            winAmount: 0,
        }),
    ]);

    await prisma.duel.delete({
        where: {
            channelProviderId_challengerId_challengedId: {
                channelProviderId,
                challengerId: duel.challengerId,
                challengedId: duel.challengedId,
            },
        },
    });

    if (winnerStats.duelWinStreak > 1) {
        winnerDisplayName += ` (${winnerStats.duelWinStreak} wins in a row)`;
    }
    if (loserStats.duelLoseStreak > 1) {
        loserDisplayName += ` (${loserStats.duelLoseStreak} losses in a row)`;
    }

    return `@${winnerDisplayName} won the duel against ${loserDisplayName} and claimed ${duel.wagerAmount} silver! ${pickRandom(DUEL_WIN_EMOTES)}`;
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

    if (duel.status !== "Pending") {
        return `@${userDisplayName}, this duel is no longer pending.`;
    }

    await Promise.all([
        increaseBalanceWithChannelID(prisma, channelProviderId, duel.challengerId, duel.wagerAmount),
        prisma.duel.delete({
            where: {
                channelProviderId_challengerId_challengedId: {
                    channelProviderId: duel.channelProviderId,
                    challengerId: duel.challengerId,
                    challengedId: duel.challengedId,
                },
            },
        }),
    ]);

    const otherUser = currentUserId === duel.challengerId ? duel.challenged : duel.challenger;
    otherUserName = otherUser.displayName;

    if (currentUserId === duel.challengerId) {
        return `@${userDisplayName} cancelled their duel challenge to ${otherUserName}!`;
    } else {
        return `@${userDisplayName} declined the duel challenge from ${otherUserName}! ${pickRandom(DUEL_DENY_EMOTES)}`;
    }
}
