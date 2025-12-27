import { runGroupAdventure } from "@/adventures";
import { getBotConfig } from "@/bot";
import { updateUserAdventureStats, increaseBalanceWithChannelID, addBonusToUserStats, findOrCreateBalance, setBalance } from "@/db";
import { ADVENTURE_COOLDOWN_EMOTES, ADVENTURE_GAMBA_EMOTE } from "@/emotes";
import { prisma } from "@/prisma";
import {
    calculateWinStreakBonus,
    calculateLoseStreakBonus,
    formatSilver,
    limitAdvMessage,
    limitMessageLength,
    calculateAmount,
    pickRandom,
    roundToDecimalPlaces,
} from "@/utils/misc";
import { formatTimeToWithSeconds } from "@/utils/time";
import { Mutex } from "async-mutex";
import dayjs from "dayjs";
import { scheduleAdventureWarnings } from "./helpers/schedule";
import env from "@/env";
import z from "zod";

// Replace single mutex with a map of mutexes per channel
const advEndMutexMap: Map<string, Mutex> = new Map();
export function getAdvEndMutex(channelProviderId: string): Mutex {
    if (!advEndMutexMap.has(channelProviderId)) {
        advEndMutexMap.set(channelProviderId, new Mutex());
    }
    return advEndMutexMap.get(channelProviderId)!;
}

const advJoinMutexMap: Map<string, Mutex> = new Map();
export function getAdvJoinMutex(channelProviderId: string): Mutex {
    if (!advJoinMutexMap.has(channelProviderId)) {
        advJoinMutexMap.set(channelProviderId, new Mutex());
    }
    return advJoinMutexMap.get(channelProviderId)!;
}

const coolDownMinutes = (env: any) => 60 * env.COOLDOWN_ADVENTURE_IN_HOURS;

export function generatePayoutRate(): number {
    const rand = Math.random();
    if (rand > 0.975) {
        return 2.0;
    } else if (rand > 0.925) {
        return 1.7 + Math.random() * 0.2;
    } else if (rand > 0.65) {
        return 1.5 + Math.random() * 0.1;
    } else {
        return 1.3 + Math.random() * 0.1;
    }
}

interface ResultArrItem {
    displayName: string;
    profit: number;
    streakBonus: number;
    streak: number;
}

export async function handleAdventureEnd(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName } = params;
    const adv = await prisma.adventure.findFirst({
        where: { channelProviderId: channelProviderId, name: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
    });
    if (!adv) {
        return "No adventure found, try starting one first.";
    }
    const timeLimit = 1000 * 60 * 10;
    const now = new Date();
    const nextAvailable = new Date(adv.createdAt.getTime() + timeLimit);
    const secondsLeft = Math.floor((nextAvailable.getTime() - now.getTime()) / 1000);

    if (secondsLeft >= 1 && userProviderId !== getBotConfig().userId) {
        let cooldownMessage = `@${userDisplayName}, hold tight! The adventure is locked for ${formatTimeToWithSeconds(nextAvailable)} to allow others to join.`;
        return cooldownMessage;
    }
    // Use per-channel mutex
    const channelMutex = getAdvEndMutex(channelProviderId);
    const locked = channelMutex.isLocked();
    if (locked) {
        return "";
    }
    const release = await channelMutex.acquire();
    try {
        const players = await prisma.player.findMany({
            where: { adventureId: adv.id },
            include: { user: { select: { displayName: true, providerId: true, balances: true } } },
        });
        const advResults = runGroupAdventure(players.map(p => p.user.displayName));

        // Get the payout rate from the adventure or default to 1.3 if not set
        const payoutRate = adv.payoutRate || 1.3;
        const formattedPayoutRate = payoutRate.toFixed(2);

        // Combine player data with adventure results
        const combinedResults = players.map(player => ({ ...player, result: advResults.results.find(r => r.player === player.user.displayName) }));

        // Filter winners and losers using the combined data
        const winners = combinedResults.filter(p => p.result?.outcome === "win");
        const losers = combinedResults.filter(p => p.result?.outcome === "lose");

        if (winners.length > 0) {
            let promises = [];
            const resultArr: ResultArrItem[] = [];

            // Convert winner operations to promises
            for (const p of winners) {
                const winAmount = Math.ceil(p.buyin * payoutRate);
                const profit = winAmount - p.buyin;

                promises.push(
                    (async () => {
                        const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                            wagerAmount: p.buyin,
                            winAmount: winAmount,
                            didWin: true,
                        });

                        const streakBonus = calculateWinStreakBonus(stats.newStreak, stats.streakWager);

                        await increaseBalanceWithChannelID(prisma, channelProviderId, p.user.providerId, winAmount);
                        if (streakBonus > 0) {
                            await addBonusToUserStats(prisma, channelLogin, channelProviderId, p.user.providerId, streakBonus);
                        }

                        resultArr.push({ displayName: p.user.displayName, profit: profit + streakBonus, streakBonus, streak: stats.newStreak });
                    })(),
                );
            }

            const loserMessages: string[] = [];
            promises.push(
                ...losers.map(async p => {
                    const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                        wagerAmount: p.buyin,
                        winAmount: 0,
                        didWin: false,
                    });

                    const loseBonus = calculateLoseStreakBonus(stats.newStreak, stats.streakWager);
                    if (loseBonus > 0) {
                        await addBonusToUserStats(prisma, channelLogin, channelProviderId, p.user.providerId, loseBonus);
                        loserMessages.push(`@${p.user.displayName} (+${formatSilver(loseBonus)} silver bonus, ${stats.newStreak}-lose streak)`);
                    }
                }),
            );

            await Promise.all(promises);

            promises = [];
            resultArr.sort((a, b) => b.profit - a.profit);
            const winnerMessages = resultArr.map(r => {
                const streakMsg = r.streakBonus > 0 ? `, +${formatSilver(r.streakBonus)} bonus, ${r.streak}-win streak` : "";
                return `@${r.displayName} (+${formatSilver(r.profit - r.streakBonus)} silver${streakMsg})`;
            });
            const loseStreakMsg = loserMessages.length > 0 ? `, ${loserMessages.join(", ")}` : "";
            const joinedResults = `${winnerMessages.join(", ")}${loseStreakMsg}`;

            // Process losers with lose streak bonuses
            // await Promise.all(promises);
            // Add adventure cleanup operations
            promises.push(
                prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
                prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
            );

            await Promise.all(promises);
            // Compose the message and limit advResults.message
            const base = ` The adventure ended with a ${formattedPayoutRate}x payout rate! Survivors are: ${joinedResults}.`;
            const advMsg = limitAdvMessage(base, advResults.message);
            let message = `${advMsg}${base}`;
            // Final fallback in case of edge case overflow
            message = limitMessageLength(message);

            return message;
        }

        // All players lost case
        const promises = [];
        const loserMessages: string[] = [];

        promises.push(
            ...players.map(async p => {
                const stats = await updateUserAdventureStats(prisma, channelLogin, channelProviderId, p.user.providerId, {
                    wagerAmount: p.buyin,
                    winAmount: 0,
                    didWin: false,
                });

                const loseBonus = calculateLoseStreakBonus(stats.newStreak, stats.streakWager);
                if (loseBonus > 0) {
                    await addBonusToUserStats(prisma, channelLogin, channelProviderId, p.user.providerId, loseBonus);
                    loserMessages.push(`@${p.user.displayName} (+${formatSilver(loseBonus)} silver bonus, ${stats.newStreak}-lose streak)`);
                }
            }),
        );

        promises.push(
            prisma.adventure.deleteMany({ where: { channelProviderId: channelProviderId, id: { not: adv.id }, name: "DONE" } }),
            prisma.adventure.update({ where: { id: adv.id }, data: { name: "DONE" } }),
        );

        await Promise.all(promises);

        // Compose the message and limit advResults.message
        const loseStreakMsg = loserMessages.length > 0 ? ` ${loserMessages.join(", ")}.` : "";
        const base = ` The adventure ended! No survivors. All players lost their silver. ${loseStreakMsg}`;
        const advMsg = limitAdvMessage(base, advResults.message);
        let message = `${advMsg}${base}`;
        // Final fallback in case of edge case overflow
        message = limitMessageLength(message);
        return message;
    } finally {
        release();
    }
}

export const AdventureJoinParamsSchema = z.object({
    amount: z
        .string({
            description: "Silver amount (number, K/M/B, percentage, 'all', 'to:X', 'k:X', or +/-delta)",
            invalid_type_error:
                "Silver amount must be a number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', 'to:X', 'k:X', or a delta (e.g., +1k, -50%)",
            required_error: "Silver amount is required",
        })
        // Updated regex to allow optional +/- prefix, K/M/B suffixes, to:X, and k:X (case-insensitive)
        .regex(/^([+-]?(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)|to:\d+(\.\d+)?[kmb]?|k(eep)?:\d+(\.\d+)?[kmb]?)$/i, {
            message:
                "Amount must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), 'all', 'to:X', 'k:X', or a delta (e.g., +1k, -50%)",
        }),
});

export const amountParamSchema = AdventureJoinParamsSchema.shape.amount;

export const adventureCommandSyntax = (prefix: string = "!") =>
    `Usage: ${prefix}adventure | ${prefix}adv [silver(K/M/B)|%|all|+/-delta|to:silver(K/M/B)|k(eep):silver(K/M/B)]`;

export async function handleAdventureJoin(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    amountParam: string;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, amountParam, prefix } = params;
    // Validate amountParam
    const parseResult = amountParamSchema.safeParse(amountParam);
    if (!parseResult.success) {
        return adventureCommandSyntax(prefix);
    }
    // Prevent join if adventureEnd mutex is locked for this channel
    const advEndMutex = getAdvEndMutex(channelProviderId);
    if (advEndMutex.isLocked()) return `@${userDisplayName}, the adventure has ended.`;

    // Use per-channel join mutex for adventure creation/join logic
    const joinMutex = getAdvJoinMutex(channelProviderId);

    const advDone = await prisma.adventure.findFirst({
        where: { channelProviderId: channelProviderId, name: "DONE" },
        orderBy: { createdAt: "desc" },
    });

    if (advDone) {
        const lastEndedAt = advDone.createdAt;
        const nextAvailable = new Date(lastEndedAt.getTime() + 1000 * 60 * coolDownMinutes(env));
        const now = new Date();
        const secondsLeft = Math.floor((nextAvailable.getTime() - now.getTime()) / 1000);

        if (secondsLeft >= 1) {
            const timeUntilNext = dayjs(nextAvailable);
            return `@${userDisplayName}, adventure is in cooldown, please wait ${formatTimeToWithSeconds(timeUntilNext.toDate())} before starting a new one. 
                    ${pickRandom(ADVENTURE_COOLDOWN_EMOTES)}`;
        }
    }
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    const adv = await prisma.adventure.findFirst({
        where: { channelProviderId: channelProviderId, name: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
        include: { players: { include: { user: true } } },
    });

    if (!adv) {
        const payoutRate = roundToDecimalPlaces(generatePayoutRate(), 2);
        const formattedPayoutRate = payoutRate.toFixed(2);
        const buyin = calculateAmount(amountParam, balance.value, undefined, true, payoutRate);
        const newBuyin = Math.min(buyin, balance.value);
        const newBalanceValue = Math.max(balance.value - newBuyin, 0);
        if (balance.value <= 0) {
            return `@${userDisplayName} you have no silver to join the adventure.`;
        }
        if (newBuyin <= 0) {
            return `@${userDisplayName} you need at least 1 silver to start an adventure.`;
        }
        const locked = joinMutex.isLocked();
        if (locked) {
            return `@${userDisplayName}, there is already a adventure running. Try joining again.`;
        }
        const release = await joinMutex.acquire();

        const [_, adventure] = await Promise.all([
            setBalance(prisma, balance.id, newBalanceValue),
            prisma.adventure.create({
                data: {
                    name: `${userProviderId}`,
                    channel: channelLogin,
                    channelProviderId: channelProviderId,
                    payoutRate: payoutRate,
                    players: { create: { buyin: newBuyin, userId: userProviderId } },
                },
            }),
        ]);
        release();

        scheduleAdventureWarnings(prisma, adventure.id);

        return `@${userDisplayName} is trying to get a team together for some serious adventure business! Use "${prefix ?? "!"}adventure | ${prefix ?? "!"}adv [silver(K/M/B)|%|all|to:silver|k:silver]" to join in!
                This adventure offers a ${formattedPayoutRate}x payout rate! ${ADVENTURE_GAMBA_EMOTE}
                $(newline)@${userDisplayName} joined the adventure with ${newBuyin} silver.`;
    }
    if (adv.players.length >= 99) {
        return `@${userDisplayName} the adventure is full, please wait for the next one.`;
    }

    const player = adv.players.find(player => player.userId === userProviderId);
    if (!player) {
        const buyin = calculateAmount(amountParam, balance.value, undefined, true, adv.payoutRate);
        const newBuyin = Math.min(buyin, balance.value);
        const newBalanceValue = Math.max(balance.value - newBuyin, 0);
        if (balance.value <= 0) {
            return `@${userDisplayName} you have no silver to join the adventure.`;
        }
        if (newBuyin <= 0) {
            return `@${userDisplayName} you need at least 1 silver to join the adventure.`;
        }

        await Promise.all([
            setBalance(prisma, balance.id, newBalanceValue),
            prisma.player.create({ data: { buyin: newBuyin, userId: userProviderId, adventureId: adv.id } }),
        ]);

        const formattedPayoutRate = adv.payoutRate.toFixed(2);
        return `@${userDisplayName} joined the adventure with ${newBuyin} silver. Current payout rate: ${formattedPayoutRate}x`;
    }

    const totalAvailable = balance.value + player.buyin;
    const requestedBuyin = calculateAmount(amountParam, totalAvailable, player.buyin, true, adv.payoutRate);

    if (requestedBuyin < 1) {
        return `@${userDisplayName} you must keep at least 1 silver in the adventure.`;
    }

    const updatedBuyin = Math.min(requestedBuyin, totalAvailable);
    const newUpdatedBalance = Math.max(totalAvailable - updatedBuyin, 0);

    if (updatedBuyin !== player.buyin) {
        await Promise.all([
            setBalance(prisma, balance.id, newUpdatedBalance),
            prisma.player.update({ where: { id: player.id }, data: { buyin: updatedBuyin } }),
        ]);

        return `@${userDisplayName}, you updated your adventure silver from ${player.buyin} to ${updatedBuyin}. You have ${newUpdatedBalance} silver left.`;
    }
    return `@${userDisplayName} already joined the adventure with ${player.buyin} silver.`;
}

export async function handleUpdateSilver(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    newBalance: string | number;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, newBalance, prefix } = params;
    const parseResult = z.coerce.number().min(0).safeParse(newBalance);
    if (!parseResult.success) {
        return `Usage: ${prefix ?? getBotConfig().prefix}updatesilver <username> <new_balance>`;
    }
    const value = parseResult.data;

    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, value);
    const newBal = await prisma.balance.update({ where: { userId: userProviderId, channel: channelLogin, id: balance.id }, data: { value } });
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}

export async function handleAddSilver(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    add: number | string;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, add, prefix } = params;
    const parseResult = z.coerce.number().min(0).safeParse(add);
    if (!parseResult.success) {
        return `Usage: ${prefix ?? getBotConfig().prefix}addsilver <username> <new_balance>`;
    }
    const value = parseResult.data;
    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    const isBalanceNegative = balance.value + value < 0;
    const newBal = await prisma.balance.update({
        where: { userId: userProviderId, channel: channelLogin, id: balance.id },
        data: { value: { increment: isBalanceNegative ? -balance.value : value } },
    });
    return `Updated @${userDisplayName} silver to ${newBal.value}.`;
}
