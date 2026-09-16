import { getCatalogAdventure, parseStoredAdventureScenario, StoredAdventureScenario } from "@/common/adventureScenario";
import { cancelScheduleAdventureWarnings } from "@/common/helpers/schedule";
import { withTransactionRetry } from "@/common/helpers/transactionRetry";
import {
    ADVENTURE_ITEMS,
    AdventureCheck,
    CriticalRoll,
    createPlayerRandom,
    getAdventureTheme,
    isAdventureThemeCode,
    ModifierEntry,
    pickSeeded,
    resolveAdventureCheck,
    selectThemeLoot,
} from "@/adventures/rpg";
import logger from "@/logger";
import { prisma } from "@/prisma";
import { calculateLoseStreakBonus, calculateWinStreakBonus } from "@/utils/misc";
import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { evaluateAdventureConditions } from "./adventureConditions";
import { AdventureLootConversionReason, evaluateAdventureLootEligibility } from "./adventureLoot";
import { AdventureChatPlayerResult, formatAdventureChatResult, joinAdventureChatMessages } from "./adventureMessages";

interface RpgEndParams {
    channelLogin: string;
    channelProviderId: string;
    adventureId: number;
}

interface SnapshotItem {
    code: string;
    name: string;
    slot: string;
    theme: string | null;
    modifier: number;
}

interface PlayerLoadoutSnapshot {
    equippedItems: SnapshotItem[];
}

interface CalculatedResult {
    playerId: number;
    userId: string;
    displayName: string;
    approachCode: string;
    check: AdventureCheck;
    roll: number;
    rawModifier: number;
    effectiveModifier: number;
    chancePercent: number;
    total: number;
    success: boolean;
    criticalCode: CriticalRoll;
    modifierBreakdown: Prisma.InputJsonValue;
    narrative: string;
    buyin: number;
    grossPayout: number;
    profit: number;
    streakBonus: number;
    streak: number;
    xpAwarded: 0;
    loot?: (typeof ADVENTURE_ITEMS)[number];
    lootAutoEquipped: boolean;
    lootSilverBonus: number;
    lootConversion?: { item: (typeof ADVENTURE_ITEMS)[number]; convertedToSilver: number; reason: AdventureLootConversionReason };
    status?: { code: string; label: string; modifier: -1 | 2; affectedChecks: readonly AdventureCheck[]; durationAdventures: number };
}

const EMPTY_LOADOUT: PlayerLoadoutSnapshot = { equippedItems: [] };

function asJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseLoadoutSnapshot(value: unknown): PlayerLoadoutSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_LOADOUT;
    const candidate = value as Record<string, unknown>;
    const itemSource = Array.isArray(candidate.equippedItems)
        ? candidate.equippedItems
        : Array.isArray(candidate.equipment)
          ? candidate.equipment
          : [];
    const equippedItems = itemSource.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const entry = item as Record<string, unknown>;
        if (typeof entry.code !== "string" || typeof entry.name !== "string") return [];
        return [
            {
                code: entry.code,
                name: entry.name,
                slot: typeof entry.slot === "string" ? entry.slot : "gear",
                theme: typeof entry.theme === "string" ? entry.theme : null,
                modifier: typeof entry.modifier === "number" && Number.isInteger(entry.modifier) ? entry.modifier : 0,
            },
        ];
    });
    return { equippedItems };
}

function messagesFromJson(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every(entry => typeof entry === "string") ? value : undefined;
}

function pickSpecialLoot(seed: string, userId: string) {
    return pickSeeded(ADVENTURE_ITEMS, seed, userId, "raid-loot");
}

function getCriticalFailureStatus(theme: string) {
    if (isAdventureThemeCode(theme)) {
        const status = getAdventureTheme(theme).criticalFailureStatus;
        return { code: status.code, label: status.label, modifier: -1 as const, affectedChecks: [] as const, durationAdventures: 1 };
    }
    return { code: "special.rattled", label: "Rattled", modifier: -1 as const, affectedChecks: [] as const, durationAdventures: 1 };
}

function getCriticalSuccessStatus() {
    return { code: "special.inspired", label: "Inspired", modifier: 2 as const, affectedChecks: [] as const, durationAdventures: 1 };
}

function getApproach(scenario: StoredAdventureScenario, approachCode: string | null, checkCode: string | null) {
    return (
        scenario.approaches.find(approach => approach.id === approachCode && approach.check === checkCode) ??
        scenario.approaches.find(approach => approach.id === approachCode) ??
        scenario.approaches.find(approach => approach.check === checkCode) ??
        scenario.approaches[0]
    );
}

function renderSeededLegacyMessage(factory: (name: string) => string, seed: string, subject: string, stream: string, name: string): string {
    const originalRandom = Math.random;
    Math.random = createPlayerRandom(seed, subject, stream);
    try {
        return factory(name).trim();
    } finally {
        Math.random = originalRandom;
    }
}

export async function handleRpgAdventureEnd({ channelLogin, channelProviderId, adventureId }: RpgEndParams): Promise<string> {
    const transactionResult = await withTransactionRetry(
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
                        const savedMessages = messagesFromJson(existing?.finalChatResult);
                        if (savedMessages) return { messages: savedMessages, resolved: true };
                        return {
                            messages: [
                                existing?.status === "RESOLVING" ? "The adventure is already being resolved." : "The adventure has already ended.",
                            ],
                            resolved: false,
                        };
                    }

                    const adventure = await tx.adventure.findUniqueOrThrow({
                        where: { id: adventureId },
                        include: { players: { include: { user: true } } },
                    });
                    const scenario = parseStoredAdventureScenario(adventure.scenarioContext);
                    const catalogEntry = getCatalogAdventure(adventure.scenarioId);
                    if (!scenario || !adventure.resolutionSeed) throw new Error(`Adventure ${adventure.id} is missing its persisted RPG scenario.`);
                    if (!catalogEntry)
                        logger.warn(
                            { adventureId, scenarioId: adventure.scenarioId },
                            "Using fallback prose for an unavailable adventure catalog entry",
                        );

                    const profiles = await Promise.all(
                        adventure.players.map(player =>
                            tx.adventureProfile.upsert({
                                where: { channelProviderId_userId: { channelProviderId, userId: player.userId } },
                                update: { channel: channelLogin },
                                create: { channelProviderId, channel: channelLogin, userId: player.userId },
                            }),
                        ),
                    );
                    const profileByUser = new Map(profiles.map(profile => [profile.userId, profile]));
                    const inventoryItems = await tx.adventureInventoryItem.findMany({
                        where: { profileId: { in: profiles.map(profile => profile.id) }, quantity: { gt: 0 } },
                        include: { item: true },
                    });
                    const inventoryByProfile = new Map<number, typeof inventoryItems>();
                    for (const inventory of inventoryItems) {
                        const entries = inventoryByProfile.get(inventory.profileId) ?? [];
                        entries.push(inventory);
                        inventoryByProfile.set(inventory.profileId, entries);
                    }
                    const persistedItems = await tx.adventureItem.findMany({ where: { code: { in: ADVENTURE_ITEMS.map(item => item.id) } } });
                    const persistedItemByCode = new Map(persistedItems.map(item => [item.code, item]));
                    const conditions = await tx.adventureProfileCondition.findMany({
                        where: {
                            profileId: { in: profiles.map(profile => profile.id) },
                            remainingAdventures: { gt: 0 },
                            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                        },
                    });
                    const conditionsByProfile = new Map<number, typeof conditions>();
                    for (const condition of conditions) {
                        const entries = conditionsByProfile.get(condition.profileId) ?? [];
                        entries.push(condition);
                        conditionsByProfile.set(condition.profileId, entries);
                    }

                    const loadouts = new Map(adventure.players.map(player => [player.id, parseLoadoutSnapshot(player.loadoutSnapshot)]));
                    const advancedConditionIds = new Set<number>();

                    const calculated: CalculatedResult[] = adventure.players.map(player => {
                        const loadout = loadouts.get(player.id) ?? EMPTY_LOADOUT;
                        const approach = getApproach(scenario, player.approachCode, player.checkCode);
                        const modifiers: ModifierEntry[] = [];
                        const matchingItems = loadout.equippedItems
                            .filter(item => item.modifier > 0 && (!item.theme || scenario.theme === "special" || item.theme === scenario.theme))
                            .sort((left, right) => right.modifier - left.modifier)
                            .slice(0, 1);
                        modifiers.push(
                            ...matchingItems.map(item => ({ code: item.code, label: item.name, source: "item" as const, modifier: item.modifier })),
                        );
                        const profile = profileByUser.get(player.userId)!;
                        const conditionEvaluation = evaluateAdventureConditions(conditionsByProfile.get(profile.id) ?? []);
                        for (const conditionId of conditionEvaluation.conditionIdsToAdvance) advancedConditionIds.add(conditionId);
                        if (conditionEvaluation.modifier) modifiers.push(conditionEvaluation.modifier);
                        const resolution = resolveAdventureCheck({
                            adventureSeed: adventure.resolutionSeed!,
                            playerId: player.userId,
                            check: approach.check,
                            payoutRate: adventure.payoutRate,
                            modifiers,
                        });
                        const buyin = Number(player.buyin);
                        const grossPayout = resolution.success ? new Decimal(player.buyin.toString()).mul(adventure.payoutRate).ceil().toNumber() : 0;
                        const narrative = catalogEntry
                            ? renderSeededLegacyMessage(
                                  pickSeeded(
                                      resolution.success ? catalogEntry.winMessages : catalogEntry.loseMessages,
                                      adventure.resolutionSeed!,
                                      player.userId,
                                      "narrative",
                                  ),
                                  adventure.resolutionSeed!,
                                  player.userId,
                                  "narrative-render",
                                  player.user.displayName,
                              )
                            : `${player.user.displayName} ${resolution.success ? "overcame" : "was stopped by"} the challenge using ${approach.label}.`;
                        const loot =
                            resolution.roll === 20
                                ? isAdventureThemeCode(scenario.theme)
                                    ? selectThemeLoot(scenario.theme, adventure.resolutionSeed!, player.userId)
                                    : pickSpecialLoot(adventure.resolutionSeed!, player.userId)
                                : undefined;
                        const status =
                            resolution.roll === 20
                                ? getCriticalSuccessStatus()
                                : resolution.roll === 1
                                  ? getCriticalFailureStatus(scenario.theme)
                                  : undefined;
                        return {
                            playerId: player.id,
                            userId: player.userId,
                            displayName: player.user.displayName,
                            approachCode: approach.id,
                            check: approach.check,
                            roll: resolution.roll,
                            rawModifier: resolution.modifierBreakdown.rawTotal,
                            effectiveModifier: resolution.modifier,
                            chancePercent: resolution.chancePercent,
                            total: resolution.total,
                            success: resolution.success,
                            criticalCode: resolution.critical,
                            modifierBreakdown: asJson(resolution.modifierBreakdown),
                            narrative,
                            buyin,
                            grossPayout,
                            profit: resolution.success ? grossPayout - buyin : 0,
                            streakBonus: 0,
                            streak: 0,
                            xpAwarded: 0,
                            loot,
                            lootAutoEquipped: false,
                            lootSilverBonus: 0,
                            status,
                        };
                    });

                    for (const result of calculated) {
                        const profile = profileByUser.get(result.userId)!;
                        if (result.loot) {
                            const candidate = result.loot;
                            const item = persistedItemByCode.get(candidate.id);
                            const ownedItems = (inventoryByProfile.get(profile.id) ?? []).map(inventory => ({
                                code: inventory.item.code,
                                quantity: inventory.quantity,
                                active: inventory.item.active,
                                equippedSlot: inventory.equippedSlot,
                                theme: inventory.item.theme,
                                modifier: inventory.item.modifier,
                            }));
                            const eligibility = evaluateAdventureLootEligibility(candidate, item?.active ?? false, ownedItems);
                            if (!eligibility.eligible) {
                                result.lootSilverBonus = eligibility.silverBonus;
                                result.lootConversion = { item: candidate, convertedToSilver: eligibility.silverBonus, reason: eligibility.reason };
                                result.loot = undefined;
                                if (!item) {
                                    logger.warn({ itemCode: candidate.id }, "Adventure loot catalog was not synchronized; converted loot to silver");
                                }
                            } else if (item) {
                                await tx.adventureInventoryItem.updateMany({
                                    where: { profileId: profile.id, equippedSlot: candidate.slot },
                                    data: { equippedSlot: null },
                                });
                                await tx.adventureInventoryItem.upsert({
                                    where: { profileId_itemId: { profileId: profile.id, itemId: item.id } },
                                    update: { quantity: { increment: 1 }, equippedSlot: candidate.slot },
                                    create: { profileId: profile.id, itemId: item.id, quantity: 1, equippedSlot: candidate.slot },
                                });
                                result.lootAutoEquipped = true;
                            }
                        }

                        const stats =
                            (await tx.userStats.findUnique({ where: { channelProviderId_userId: { channelProviderId, userId: result.userId } } })) ??
                            (await tx.userStats.create({ data: { channel: channelLogin, channelProviderId, userId: result.userId } }));
                        const newWinStreak = result.success ? stats.winStreak + 1 : 0;
                        const newLoseStreak = result.success ? 0 : stats.loseStreak + 1;
                        const newStreakWager =
                            (result.success ? newWinStreak : newLoseStreak) === 1 ? result.buyin : stats.streakWager + result.buyin;
                        const streakLength = result.success ? newWinStreak : newLoseStreak;
                        const streakBonusPaid = streakLength === 1 ? 0 : Number(stats.streakBonusPaid);
                        const streakBonus = result.success
                            ? calculateWinStreakBonus(newWinStreak, result.buyin)
                            : calculateLoseStreakBonus(newLoseStreak, newStreakWager);
                        result.streakBonus = streakBonus;
                        result.streak = result.success ? newWinStreak : newLoseStreak;
                        const totalReward = result.grossPayout + streakBonus + result.lootSilverBonus;

                        await tx.userStats.update({
                            where: { id: stats.id },
                            data: {
                                gamesPlayed: { increment: 1 },
                                gamesWon: result.success ? { increment: 1 } : undefined,
                                totalWagers: { increment: BigInt(result.buyin) },
                                totalWinnings: totalReward > 0 ? { increment: BigInt(totalReward) } : undefined,
                                winStreak: newWinStreak,
                                loseStreak: newLoseStreak,
                                streakWager: newStreakWager,
                                streakBonusPaid: streakBonusPaid,
                            },
                        });
                        if (totalReward > 0) {
                            await tx.balance.update({
                                where: { channelProviderId_userId: { channelProviderId, userId: result.userId } },
                                data: { value: { increment: BigInt(totalReward) } },
                            });
                        }
                    }

                    if (advancedConditionIds.size > 0) {
                        const usedConditionIds = [...advancedConditionIds];
                        await tx.adventureProfileCondition.updateMany({
                            where: { id: { in: usedConditionIds } },
                            data: { remainingAdventures: { decrement: 1 } },
                        });
                        await tx.adventureProfileCondition.deleteMany({ where: { id: { in: usedConditionIds }, remainingAdventures: { lte: 0 } } });
                    }

                    for (const result of calculated.filter(result => result.status)) {
                        const profile = profileByUser.get(result.userId)!;
                        const status = result.status!;
                        await tx.adventureProfileCondition.deleteMany({ where: { profileId: profile.id } });
                        await tx.adventureProfileCondition.upsert({
                            where: { profileId_code: { profileId: profile.id, code: status.code } },
                            update: {
                                name: status.label,
                                modifier: status.modifier,
                                checkCodes: [...status.affectedChecks],
                                themeCodes: [],
                                remainingAdventures: status.durationAdventures,
                                sourceAdventureId: adventure.id,
                            },
                            create: {
                                profileId: profile.id,
                                code: status.code,
                                name: status.label,
                                modifier: status.modifier,
                                checkCodes: [...status.affectedChecks],
                                themeCodes: [],
                                remainingAdventures: status.durationAdventures,
                                sourceAdventureId: adventure.id,
                            },
                        });
                    }

                    await tx.adventurePlayerResult.createMany({
                        data: calculated.map(result => ({
                            adventureId: adventure.id,
                            playerId: result.playerId,
                            userId: result.userId,
                            approachCode: result.approachCode,
                            checkCode: result.check,
                            roll: result.roll,
                            dc: 11,
                            rawModifier: result.rawModifier,
                            effectiveModifier: result.effectiveModifier,
                            modifierBreakdown: result.modifierBreakdown,
                            chancePercent: result.chancePercent,
                            outcome: result.success ? "SUCCESS" : "FAILURE",
                            criticalCode: result.criticalCode,
                            buyin: BigInt(result.buyin),
                            payoutRate: adventure.payoutRate,
                            payout: BigInt(result.grossPayout),
                            streakBonus: BigInt(result.streakBonus),
                            xpAwarded: BigInt(result.xpAwarded),
                            lootSnapshot: result.loot
                                ? asJson(result.loot)
                                : result.lootConversion
                                  ? asJson({
                                        item: result.lootConversion.item,
                                        convertedToSilver: result.lootConversion.convertedToSilver,
                                        reason: result.lootConversion.reason,
                                    })
                                  : undefined,
                            statusSnapshot: result.status ? asJson(result.status) : undefined,
                            narrative: result.narrative,
                        })),
                    });

                    const winners = calculated
                        .filter(result => result.success)
                        .map(result => result.displayName)
                        .join(", ");
                    const losers = calculated
                        .filter(result => !result.success)
                        .map(result => result.displayName)
                        .join(", ");
                    const epilogue = catalogEntry
                        ? [
                              catalogEntry.endLose
                                  ? renderSeededLegacyMessage(catalogEntry.endLose, adventure.resolutionSeed!, "party", "epilogue-lose", losers)
                                  : undefined,
                              catalogEntry.endWin
                                  ? renderSeededLegacyMessage(catalogEntry.endWin, adventure.resolutionSeed!, "party", "epilogue-win", winners)
                                  : undefined,
                          ]
                              .filter(Boolean)
                              .join(" ")
                        : "";
                    const chatPlayers: AdventureChatPlayerResult[] = calculated.map(result => ({
                        displayName: result.displayName,
                        roll: result.roll,
                        modifier: result.effectiveModifier,
                        total: result.total,
                        chancePercent: result.chancePercent,
                        success: result.success,
                        criticalCode: result.criticalCode,
                        narrative: result.narrative,
                        profit: result.profit,
                        streakBonus: result.streakBonus,
                        streak: result.streak,
                        lootName: result.loot?.name,
                        lootEquipped: result.lootAutoEquipped,
                        lootSilverBonus: result.lootSilverBonus,
                        statusName: result.status?.label,
                    }));
                    const messages = formatAdventureChatResult({
                        title: scenario.title,
                        intro: scenario.intro,
                        payoutRate: adventure.payoutRate,
                        presentationMode: scenario.presentationMode,
                        epilogue,
                        players: chatPlayers,
                    });

                    await tx.adventure.update({
                        where: { id: adventure.id },
                        data: { status: "RESOLVED", name: "DONE", resolvedAt: new Date(), finalChatResult: messages },
                    });
                    return { messages, resolved: true };
                },
                { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 },
            ),
        { retryUniqueConflicts: true },
    );

    if (transactionResult.resolved) {
        await cancelScheduleAdventureWarnings(adventureId).catch(error =>
            logger.error({ error, adventureId }, "Failed to cancel warnings for resolved RPG adventure"),
        );
    }
    logger.info({ adventureId, channelProviderId }, "Resolved RPG adventure");
    return joinAdventureChatMessages(transactionResult.messages);
}
