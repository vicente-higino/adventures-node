import { runGroupAdventure } from "@/adventures";
import { payoutAwareChanceCap } from "@/adventures/rpg";
import { getBotConfig } from "@/bot";
import { addBonusToUserStats, findOrCreateBalance, increaseBalanceWithChannelID, updateUserAdventureStats } from "@/db";
import { ADVENTURE_COOLDOWN_EMOTES, ADVENTURE_GAMBA_EMOTE } from "@/emotes";
import env from "@/env";
import logger from "@/logger";
import { prisma } from "@/prisma";
import {
    calculateAmount,
    calculateLoseStreakBonus,
    calculateWinStreakBonus,
    formatSilver,
    limitAdvMessage,
    limitMessageLength,
    roundToDecimalPlaces,
} from "@/utils/misc";
import { formatTimeToWithSeconds } from "@/utils/time";
import { Mutex } from "async-mutex";
import Decimal from "decimal.js";
import z from "zod";
import { cancelScheduleAdventureWarnings, scheduleAdventureWarnings } from "./helpers/schedule";
import { handleRpgAdventureEnd } from "./handleRpgAdventureEnd";
import { formatAdventureApproaches, parseStoredAdventureScenario, resolveAdventureApproach, selectNewAdventureScenario } from "./adventureScenario";
import { getAdventureProfileSnapshot } from "./adventureProfiles";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { withTransactionRetry } from "./helpers/transactionRetry";

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
const MAX_SAFE_ADVENTURE_BUYIN = Math.floor((Number.MAX_SAFE_INTEGER - 1_000) / 2);

function boundedAdventureBuyin(requested: number, available: number): number {
    return Math.max(0, Math.min(requested, available, MAX_SAFE_ADVENTURE_BUYIN));
}

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

function savedAdventureMessages(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.length > 0 && value.every(message => typeof message === "string") ? value : undefined;
}

async function handleLegacyAdventureEndAtomic(params: { channelLogin: string; channelProviderId: string; adventureId: number }): Promise<string> {
    const { channelLogin, channelProviderId, adventureId } = params;
    const result = await withTransactionRetry(
        () =>
            prisma.$transaction(
                async tx => {
                    const claimed = await tx.adventure.updateMany({
                        where: { id: adventureId, channelProviderId, status: "OPEN" },
                        data: { status: "RESOLVING", resolvingAt: new Date() },
                    });
                    if (claimed.count === 0) {
                        const existing = await tx.adventure.findUnique({
                            where: { id: adventureId },
                            select: { finalChatResult: true, status: true },
                        });
                        const saved = savedAdventureMessages(existing?.finalChatResult);
                        return saved
                            ? { message: saved.join("$(newline)"), resolved: true }
                            : {
                                  message:
                                      existing?.status === "RESOLVING"
                                          ? "The adventure is already being resolved."
                                          : "The adventure has already ended.",
                                  resolved: false,
                              };
                    }

                    const adventure = await tx.adventure.findUniqueOrThrow({
                        where: { id: adventureId },
                        include: { players: { include: { user: true } } },
                    });
                    const adventureResult = runGroupAdventure(adventure.players.map(player => player.user.displayName));
                    const resultsByName = new Map(adventureResult.results.map(playerResult => [playerResult.player, playerResult]));
                    const winnerMessages: string[] = [];
                    const recoveryMessages: string[] = [];

                    for (const player of adventure.players) {
                        const didWin = resultsByName.get(player.user.displayName)?.outcome === "win";
                        const buyin = Number(player.buyin);
                        const grossPayout = didWin ? new Decimal(player.buyin.toString()).mul(adventure.payoutRate).ceil().toNumber() : 0;
                        const stats = await updateUserAdventureStats(tx, channelLogin, channelProviderId, player.userId, {
                            wagerAmount: buyin,
                            winAmount: grossPayout,
                            didWin,
                        });
                        const streakBonus = didWin
                            ? calculateWinStreakBonus(stats.newStreak, stats.streakWager)
                            : calculateLoseStreakBonus(stats.newStreak, stats.streakWager);

                        if (grossPayout > 0) await increaseBalanceWithChannelID(tx, channelProviderId, player.userId, grossPayout);
                        if (streakBonus > 0) await addBonusToUserStats(tx, channelLogin, channelProviderId, player.userId, streakBonus);

                        if (didWin) {
                            const bonus = streakBonus > 0 ? `, +${formatSilver(streakBonus)} bonus, ${stats.newStreak}-win streak` : "";
                            winnerMessages.push(`@${player.user.displayName} (+${formatSilver(grossPayout - buyin)} silver${bonus})`);
                        } else if (streakBonus > 0) {
                            recoveryMessages.push(
                                `@${player.user.displayName} (+${formatSilver(streakBonus)} silver bonus, ${stats.newStreak}-lose streak)`,
                            );
                        }
                    }

                    const formattedPayoutRate = adventure.payoutRate.toFixed(2);
                    const recovery = recoveryMessages.length > 0 ? ` Recovery bonuses: ${recoveryMessages.join(", ")}.` : "";
                    const base = winnerMessages.length
                        ? ` The adventure ended with a ${formattedPayoutRate}x payout rate! Survivors are: ${winnerMessages.join(", ")}.${recovery}`
                        : ` The adventure ended! No survivors. All players lost their silver.${recovery}`;
                    const message = limitMessageLength(`${limitAdvMessage(base, adventureResult.message)}${base}`);

                    await tx.adventure.update({
                        where: { id: adventure.id },
                        data: { name: "DONE", status: "RESOLVED", resolvedAt: new Date(), finalChatResult: [message] },
                    });
                    return { message, resolved: true };
                },
                { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 },
            ),
        { retryUniqueConflicts: true },
    );

    if (result.resolved) {
        await cancelScheduleAdventureWarnings(adventureId).catch(error =>
            logger.error({ error, adventureId }, "Failed to cancel warnings for resolved legacy adventure"),
        );
    }
    return result.message;
}

export async function handleAdventureEnd(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    throwOnError?: boolean;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, throwOnError = false } = params;
    const adv = await prisma.adventure.findFirst({
        where: { channelProviderId: channelProviderId, name: { not: "DONE" }, status: { in: ["OPEN", "RESOLVING"] } },
        orderBy: { createdAt: "desc" },
    });
    if (!adv) {
        const recentResult = await prisma.adventure.findFirst({
            where: {
                channelProviderId,
                status: "RESOLVED",
                resolvedAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
                finalChatResult: { not: Prisma.JsonNull },
            },
            orderBy: { resolvedAt: "desc" },
            select: { finalChatResult: true },
        });
        const saved = savedAdventureMessages(recentResult?.finalChatResult);
        if (saved) return saved.join("$(newline)");
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
    return await channelMutex.runExclusive(async () => {
        try {
            const checkAdv = await prisma.adventure.findFirst({
                where: { channelProviderId: channelProviderId, name: { not: "DONE" }, status: { in: ["OPEN", "RESOLVING"] } },
                orderBy: { createdAt: "desc" },
            });
            if (!checkAdv) {
                return "No adventure found, try starting one first.";
            }
            if (checkAdv.rulesVersion >= 2) {
                return await handleRpgAdventureEnd({ channelLogin, channelProviderId, adventureId: checkAdv.id });
            }
            return await handleLegacyAdventureEndAtomic({ channelLogin, channelProviderId, adventureId: checkAdv.id });
        } catch (error) {
            logger.error(error, "Error handling adventure end");
            if (throwOnError) throw error;
            return "An error occurred while ending the adventure. Please try again later.";
        }
    });
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
const adventureAmountOptions = "[+/-silver(K/M/B)|%|all|to:silver|k:silver]";
const adventureOptions = `${adventureAmountOptions} [approach|raid]`;
export const adventureCommandSyntax = (prefix: string = "!") => `Usage: ${prefix}adventure | ${prefix}adv ${adventureOptions}`;

function adventureCooldownResponse(
    adventure: { resolvedAt: Date | null; cancelledAt: Date | null; updatedAt: Date; createdAt: Date },
    channelLogin: string,
    userDisplayName: string,
): string | undefined {
    const lastEndedAt = adventure.resolvedAt ?? adventure.cancelledAt ?? adventure.updatedAt ?? adventure.createdAt;
    const nextAvailable = new Date(lastEndedAt.getTime() + 1000 * 60 * coolDownMinutes(env));
    if (nextAvailable.getTime() <= Date.now()) return undefined;
    return `@${userDisplayName}, adventure is in cooldown, please wait ${formatTimeToWithSeconds(nextAvailable)} before starting a new one. ${ADVENTURE_COOLDOWN_EMOTES(
        channelLogin,
    )}`;
}

function transactionConflict(message: string): Error & { code: "P2034" } {
    return Object.assign(new Error(message), { code: "P2034" as const });
}

export async function handleAdventureJoin(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    amountParam: string;
    approachParam?: string;
    requestId?: string;
    prefix?: string;
}): Promise<string> {
    const { channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName, amountParam, approachParam, requestId, prefix } = params;
    if (!amountParamSchema.safeParse(amountParam).success) return adventureCommandSyntax(prefix);

    const endMutex = getAdvEndMutex(channelProviderId);
    if (endMutex.isLocked()) return `@${userDisplayName}, the adventure has ended.`;

    return getAdvJoinMutex(channelProviderId).runExclusive(async () => {
        const activeBeforeSnapshot = await prisma.adventure.findFirst({
            where: { channelProviderId, status: { in: ["OPEN", "RESOLVING"] } },
            select: { id: true, status: true },
        });
        if (activeBeforeSnapshot?.status === "RESOLVING") return `@${userDisplayName}, the adventure is being resolved.`;
        if (!activeBeforeSnapshot) {
            const lastAdventure = await prisma.adventure.findFirst({
                where: { channelProviderId, status: { in: ["RESOLVED", "CANCELLED"] } },
                orderBy: { updatedAt: "desc" },
            });
            const cooldown = lastAdventure && adventureCooldownResponse(lastAdventure, channelLogin, userDisplayName);
            if (cooldown) return cooldown;
        }

        await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
        const loadoutSnapshot = await getAdventureProfileSnapshot({ channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName });
        const rpgEnabled = env.ADVENTURE_RPG_ENABLED;
        const raidRequested = approachParam?.trim().toLowerCase() === "raid";
        const newScenario = selectNewAdventureScenario(raidRequested);

        const outcome = await withTransactionRetry(
            () =>
                prisma.$transaction(
                    async tx => {
                        const idempotencyKey = requestId ? `${channelProviderId}:${requestId}` : undefined;
                        let joinRequestCreated = false;
                        if (idempotencyKey) {
                            const previousRequest = await tx.adventureJoinRequest.findUnique({ where: { id: idempotencyKey } });
                            if (previousRequest) {
                                if (previousRequest.userId !== userProviderId)
                                    throw new Error("Adventure request ID was reused by a different user.");
                                return {
                                    message: previousRequest.response ?? `@${userDisplayName}, that adventure request was already processed.`,
                                    adventureIdToSchedule: previousRequest.adventureId ?? undefined,
                                };
                            }
                            await tx.adventureJoinRequest.create({ data: { id: idempotencyKey, channelProviderId, userId: userProviderId } });
                            joinRequestCreated = true;
                        }
                        const respond = async <T extends { message: string; adventureIdToSchedule?: number }>(response: T): Promise<T> => {
                            if (joinRequestCreated && idempotencyKey) {
                                await tx.adventureJoinRequest.update({
                                    where: { id: idempotencyKey },
                                    data: { response: response.message, adventureId: response.adventureIdToSchedule },
                                });
                            }
                            return response;
                        };
                        const activeAdventure = await tx.adventure.findFirst({
                            where: { channelProviderId, status: { in: ["OPEN", "RESOLVING"] } },
                            orderBy: { createdAt: "desc" },
                            include: { players: true },
                        });
                        if (activeAdventure?.status === "RESOLVING") {
                            return respond({ message: `@${userDisplayName}, the adventure is being resolved.` });
                        }
                        const adventure = activeAdventure;

                        if (!adventure) {
                            const lastAdventure = await tx.adventure.findFirst({
                                where: { channelProviderId, status: { in: ["RESOLVED", "CANCELLED"] } },
                                orderBy: { updatedAt: "desc" },
                            });
                            const cooldown = lastAdventure && adventureCooldownResponse(lastAdventure, channelLogin, userDisplayName);
                            if (cooldown) return respond({ message: cooldown });
                        }

                        const balance = await tx.balance.findUniqueOrThrow({
                            where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } },
                        });
                        const balanceValue = Math.min(balance.value, MAX_SAFE_ADVENTURE_BUYIN);

                        if (!adventure) {
                            const selectedApproach = rpgEnabled
                                ? resolveAdventureApproach(newScenario.context, raidRequested ? undefined : approachParam, loadoutSnapshot)
                                : undefined;
                            if (rpgEnabled && !selectedApproach) {
                                return respond({ message: `@${userDisplayName}, choose one of: ${formatAdventureApproaches(newScenario.context)}.` });
                            }
                            if (balanceValue <= 0) return respond({ message: `@${userDisplayName} you have no silver to join the adventure.` });

                            const ticket = await tx.userRedeemable.findFirst({
                                where: {
                                    userId: userProviderId,
                                    channelProviderId,
                                    quantity: { gt: 0 },
                                    redeemable: { code: "adventure_2x", active: true },
                                },
                            });
                            const payoutRate = ticket ? 2 : roundToDecimalPlaces(generatePayoutRate(), 2);
                            const buyin = boundedAdventureBuyin(
                                calculateAmount(amountParam, balanceValue, undefined, true, payoutRate),
                                balanceValue,
                            );
                            if (buyin <= 0) return respond({ message: `@${userDisplayName} you need at least 1 silver to start an adventure.` });

                            if (ticket) {
                                const consumed = await tx.userRedeemable.updateMany({
                                    where: { id: ticket.id, quantity: { gt: 0 } },
                                    data: { quantity: { decrement: 1 } },
                                });
                                if (consumed.count !== 1) throw transactionConflict("The adventure ticket changed during creation.");
                            }
                            const debited = await tx.balance.updateMany({
                                where: { id: balance.id, value: { gte: BigInt(buyin) } },
                                data: { value: { decrement: BigInt(buyin) } },
                            });
                            if (debited.count !== 1) throw transactionConflict("The balance changed during adventure creation.");

                            const created = await tx.adventure.create({
                                data: {
                                    name: userProviderId,
                                    createdByUserId: userProviderId,
                                    channel: channelLogin,
                                    channelProviderId,
                                    payoutRate,
                                    status: "OPEN",
                                    rulesVersion: rpgEnabled ? 2 : 1,
                                    ...(rpgEnabled
                                        ? {
                                              scenarioId: newScenario.entry.id,
                                              theme: newScenario.entry.themeId,
                                              scenarioContext: JSON.parse(JSON.stringify(newScenario.context)),
                                              resolutionSeed: randomUUID(),
                                              contentVersion: newScenario.entry.contentVersion,
                                          }
                                        : {}),
                                    eligibleAt: new Date(Date.now() + 10 * 60 * 1000),
                                    endsAt: new Date(Date.now() + 45 * 60 * 1000),
                                    players: {
                                        create: {
                                            buyin,
                                            userId: userProviderId,
                                            ...(rpgEnabled && selectedApproach
                                                ? {
                                                      approachCode: selectedApproach.id,
                                                      checkCode: selectedApproach.check,
                                                      loadoutSnapshot: JSON.parse(JSON.stringify(loadoutSnapshot)),
                                                  }
                                                : {}),
                                        },
                                    },
                                },
                            });
                            if (!rpgEnabled) {
                                return respond({
                                    adventureIdToSchedule: created.id,
                                    message: `@${userDisplayName} is gathering a party! Use "${prefix ?? "!"}adv ${
                                        adventureAmountOptions
                                    }" to join. This adventure offers a ${payoutRate.toFixed(2)}x payout rate! ${ADVENTURE_GAMBA_EMOTE(
                                        channelLogin,
                                    )} $(newline)@${userDisplayName} joined with ${buyin} silver.`,
                                });
                            }
                            return respond({
                                adventureIdToSchedule: created.id,
                                message: `@${userDisplayName} is gathering a party for ${
                                    newScenario.context.title
                                }! Use "${prefix ?? "!"}adv ${adventureAmountOptions}" to join. This adventure offers a ${payoutRate.toFixed(
                                    2,
                                )}x payout rate! ${ADVENTURE_GAMBA_EMOTE(
                                    channelLogin,
                                )} $(newline)@${userDisplayName} joined with ${buyin} silver.`,
                            });
                        }

                        const scenario = parseStoredAdventureScenario(adventure.scenarioContext);
                        const selectedApproach = scenario ? resolveAdventureApproach(scenario, approachParam, loadoutSnapshot) : undefined;
                        if (scenario && approachParam && !selectedApproach) {
                            return respond({ message: `@${userDisplayName}, choose one of: ${formatAdventureApproaches(scenario)}.` });
                        }

                        const player = adventure.players.find(candidate => candidate.userId === userProviderId);
                        if (!player) {
                            if (adventure.players.length >= 99) {
                                return respond({ message: `@${userDisplayName} the adventure is full, please wait for the next one.` });
                            }
                            if (balanceValue <= 0) return respond({ message: `@${userDisplayName} you have no silver to join the adventure.` });
                            const buyin = boundedAdventureBuyin(
                                calculateAmount(amountParam, balanceValue, undefined, true, adventure.payoutRate),
                                balanceValue,
                            );
                            if (buyin <= 0) return respond({ message: `@${userDisplayName} you need at least 1 silver to join the adventure.` });

                            const debited = await tx.balance.updateMany({
                                where: { id: balance.id, value: { gte: BigInt(buyin) } },
                                data: { value: { decrement: BigInt(buyin) } },
                            });
                            if (debited.count !== 1) throw transactionConflict("The balance changed while joining the adventure.");
                            await tx.player.create({
                                data: {
                                    buyin,
                                    userId: userProviderId,
                                    adventureId: adventure.id,
                                    approachCode: selectedApproach?.id,
                                    checkCode: selectedApproach?.check,
                                    loadoutSnapshot: scenario ? JSON.parse(JSON.stringify(loadoutSnapshot)) : undefined,
                                },
                            });
                            return respond({
                                message: `@${userDisplayName} joined with ${buyin} silver${
                                    selectedApproach ? ` using ${selectedApproach.label} [${selectedApproach.check}]` : ""
                                }. Current payout: ${adventure.payoutRate.toFixed(2)}x (max odds ${payoutAwareChanceCap(adventure.payoutRate)}%)`,
                            });
                        }

                        const currentBuyin = Number(player.buyin);
                        const totalAvailable = Math.min(balanceValue + currentBuyin, MAX_SAFE_ADVENTURE_BUYIN);
                        const requestedBuyin = calculateAmount(amountParam, totalAvailable, currentBuyin, true, adventure.payoutRate);
                        if (requestedBuyin < 1) {
                            return respond({ message: `@${userDisplayName} you must keep at least 1 silver in the adventure.` });
                        }
                        const updatedBuyin = boundedAdventureBuyin(requestedBuyin, totalAvailable);
                        const wagerDelta = updatedBuyin - currentBuyin;
                        const updatedBalance = Math.max(balanceValue - wagerDelta, 0);
                        const rpgSnapshot = scenario
                            ? {
                                  approachCode: selectedApproach?.id ?? player.approachCode,
                                  checkCode: selectedApproach?.check ?? player.checkCode,
                                  loadoutSnapshot: JSON.parse(JSON.stringify(loadoutSnapshot)),
                              }
                            : {};

                        if (updatedBuyin !== currentBuyin) {
                            if (wagerDelta > 0) {
                                const debited = await tx.balance.updateMany({
                                    where: { id: balance.id, value: { gte: BigInt(wagerDelta) } },
                                    data: { value: { decrement: BigInt(wagerDelta) } },
                                });
                                if (debited.count !== 1) throw transactionConflict("The balance changed while updating the adventure wager.");
                            } else {
                                await tx.balance.update({ where: { id: balance.id }, data: { value: { increment: BigInt(-wagerDelta) } } });
                            }
                            await tx.player.update({ where: { id: player.id }, data: { buyin: updatedBuyin, ...rpgSnapshot } });
                            return respond({
                                message: `@${userDisplayName}, you updated your adventure silver from ${currentBuyin} to ${updatedBuyin}${
                                    selectedApproach ? ` and selected ${selectedApproach.label} [${selectedApproach.check}]` : ""
                                }. You have ${updatedBalance} silver left.`,
                            });
                        }

                        if (scenario && selectedApproach) {
                            const changedApproach = player.approachCode !== selectedApproach.id || player.checkCode !== selectedApproach.check;
                            await tx.player.update({ where: { id: player.id }, data: rpgSnapshot });
                            return respond({
                                message: changedApproach
                                    ? `@${userDisplayName}, approach changed to ${selectedApproach.label} [${selectedApproach.check}]. Your wager remains ${currentBuyin} silver.`
                                    : `@${userDisplayName} already joined with ${currentBuyin} silver using ${selectedApproach.label} [${selectedApproach.check}]. Your class and gear snapshot was refreshed.`,
                            });
                        }
                        return respond({ message: `@${userDisplayName} already joined the adventure with ${currentBuyin} silver.` });
                    },
                    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
                ),
            { retryUniqueConflicts: true },
        );

        const adventureIdToSchedule = "adventureIdToSchedule" in outcome ? outcome.adventureIdToSchedule : undefined;
        if (adventureIdToSchedule) {
            await scheduleAdventureWarnings(adventureIdToSchedule).catch(error =>
                logger.error({ error, adventureId: adventureIdToSchedule }, "Failed to schedule adventure warnings"),
            );
        }
        return outcome.message;
    });
}

export async function upgradeAdventure(params: {
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}): Promise<string> {
    const { channelProviderId, userProviderId, userDisplayName } = params;
    return getAdvJoinMutex(channelProviderId).runExclusive(async () => {
        const outcome = await withTransactionRetry(() =>
            prisma.$transaction(
                async tx => {
                    const adventure = await tx.adventure.findFirst({ where: { channelProviderId, status: "OPEN" }, orderBy: { createdAt: "desc" } });
                    if (!adventure) return "missing" as const;
                    if (adventure.payoutRate === 2) return "already" as const;

                    const ticket = await tx.userRedeemable.findFirst({
                        where: { userId: userProviderId, channelProviderId, quantity: { gt: 0 }, redeemable: { code: "adventure_2x", active: true } },
                    });
                    if (!ticket) return "no-ticket" as const;

                    const upgraded = await tx.adventure.updateMany({
                        where: { id: adventure.id, status: "OPEN", payoutRate: { not: 2 } },
                        data: { payoutRate: 2 },
                    });
                    if (upgraded.count !== 1) throw transactionConflict("The adventure changed during its upgrade.");
                    const consumed = await tx.userRedeemable.updateMany({
                        where: { id: ticket.id, quantity: { gt: 0 } },
                        data: { quantity: { decrement: 1 } },
                    });
                    if (consumed.count !== 1) throw transactionConflict("The adventure ticket changed during its upgrade.");
                    return "upgraded" as const;
                },
                { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
            ),
        );

        if (outcome === "missing") return `@${userDisplayName} there's no adventure to upgrade. Start one first!`;
        if (outcome === "already") return `@${userDisplayName}, the adventure already is 2x.`;
        if (outcome === "no-ticket") return `@${userDisplayName}, you don't own a 2x adventure ticket to upgrade this adventure!`;
        return `/me @${userDisplayName} upgraded the adventure. This adventure offers a 2.00x payout rate! Success odds are now capped at 55%.`;
    });
}
