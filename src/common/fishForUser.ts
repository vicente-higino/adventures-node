import {
    createFishDexCompletion,
    findOrCreateBalance,
    findOrCreateFishDexEntry,
    findOrCreateFishStats,
    hasFishDexCompletion,
    increaseBalance,
} from "@/db";
import {
    CONGRATULATIONS_EMOTES,
    CONGRATULATIONS_TRASH_FISH_DEX_EMOTES,
    FACTS_EMOTES,
    FISH_COOLDOWN_EMOTES,
    FISH_FINE_EMOTES,
    PAUSE_EMOTES,
    QUOTES_EMOTES,
} from "@/emotes";
import { getFish, getQualityRecordBonus, getRod, getValueEmote } from "@/fishing";
import { fishingFacts } from "@/fishing/facts";
import { fishTable } from "@/fishing/fishTable";
import logger from "@/logger";
import { dbClient } from "@/prisma";
import { boxMullerTransform, delay, pickRandom, sendActionToChannel } from "@/utils/misc";
import { formatTimeToWithSeconds } from "@/utils/time";
import { Prisma, Rarity } from "@prisma/client";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { friendlyCooldownMessages, motivationalQuotes, wrongPlaces } from "./phrases";
dayjs.extend(relativeTime);

interface FishForUserParams {
    prisma: dbClient;
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
    cooldownHours: number;
}

export async function fishForUser({
    prisma,
    channelLogin,
    channelProviderId,
    userProviderId,
    userLogin,
    userDisplayName,
    cooldownHours,
}: FishForUserParams): Promise<string> {
    try {
        const fishStats = await findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
        if (fishStats.totalSilverWorth > 0) {
            const lastFishedAt = fishStats.updatedAt;
            const nextAvailable = new Date(lastFishedAt.getTime() + 1000 * 60 * 60 * cooldownHours);
            const now = new Date();
            const secondsLeft = Math.floor((nextAvailable.getTime() - now.getTime()) / 1000);

            if (secondsLeft >= 1) {
                const timeUntilNext = dayjs(nextAvailable);
                let cooldownMessage = `@${userDisplayName}, you can only fish again in ${formatTimeToWithSeconds(timeUntilNext.toDate())}.`;
                if (Math.random() < 0.33) {
                    return (
                        cooldownMessage +
                        pickRandom([
                            ` ${FISH_COOLDOWN_EMOTES(channelLogin)} ${pickRandom(friendlyCooldownMessages)}`,
                            ` ${QUOTES_EMOTES(channelLogin)} ${pickRandom(motivationalQuotes)}`,
                            ` ${FACTS_EMOTES(channelLogin)} ${pickRandom(fishingFacts)}`,
                        ])
                    );
                }
                return `${cooldownMessage} ${FISH_COOLDOWN_EMOTES(channelLogin)}`;
            }
        }

        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);

        // 1% chance to get caught
        if (fishStats.totalSilverWorth > 0 && Math.random() < 0.01 && balance.value >= 50) {
            const fine = Math.min(100, Math.floor(boxMullerTransform(50, 25, 25)));
            const place = pickRandom(wrongPlaces);
            if (!balance) {
                return `@${userDisplayName} Something went wrong finding your balance.`;
            }
            const updateCaughtTimestamp = prisma.fishStats.update({ where: { id: fishStats.id }, data: { updatedAt: dayjs().toISOString() } });
            const updateFishFinesInFishStats = prisma.fishStats.update({
                where: { id: fishStats.id },
                data: { fishFines: { increment: fine }, fishFinesCount: { increment: 1 } },
            });
            await Promise.all([increaseBalance(prisma, balance.id, -fine), updateFishFinesInFishStats, updateCaughtTimestamp]);
            return `@${userDisplayName} POLICE You got caught fishing in ${place} and were fined ${fine} silver! ${FISH_FINE_EMOTES(channelLogin)}`;
        }

        const unitSystem = balance.user.unitSystem ?? "metric";
        const fish = getFish({ unitSystem, channel: channelLogin, rodLevel: fishStats.activeRodLevel });
        let bonus = 0;
        let treasureBonus = 0;
        let treasureMessage = "";
        if (fish.rarity === Rarity.Trash && Math.random() < 0.25) {
            const chestBonus = Math.floor(boxMullerTransform(1000, 500, 250));
            treasureBonus += chestBonus;
            treasureMessage = `💰 While sifting through the trash, you discovered a hidden treasure chest containing ${chestBonus} silver! ${getValueEmote(chestBonus)}`;
            setTimeout(async () => {
                sendActionToChannel(
                    channelLogin,
                    `@${userDisplayName} Hold on... something's glimmering in the trash! ${PAUSE_EMOTES(channelLogin)}`,
                );
                await delay(2000);
                sendActionToChannel(channelLogin, `@${userDisplayName} ${treasureMessage}`);
            }, 2000);
        }

        const [createdFish, channelFishCount] = await prisma.$transaction(async tx => {
            const channelFishCount = await prisma.channelFishCount.upsert({
                where: { channelProviderId },
                create: { channelProviderId, total: 1 },
                update: { total: { increment: 1 } },
            });
            const createdFish = await prisma.fish.create({
                data: {
                    name: fish.name,
                    rarity: fish.rarity,
                    size: fish.size.toString(),
                    weight: fish.weight.toString(),
                    value: fish.sellValue,
                    prefix: fish.prefix,
                    channel: channelLogin,
                    channelProviderId: channelProviderId,
                    userId: userProviderId,
                    fishId: channelFishCount.total.toString(),
                },
            });
            return [createdFish, channelFishCount];
        });
        const existingRecord = await prisma.fishRecord.findUnique({
            where: { channelProviderId_fishName_quality: { channelProviderId, fishName: fish.name, quality: fish.quality } },
            include: { largestFish: true, smallestFish: true, heaviestFish: true, lightestFish: true },
        });

        let recordMessage = "";
        const size = fish.size;
        const weight = fish.weight;
        const promises: Promise<unknown>[] = [];

        if (!existingRecord) {
            const newRecord = prisma.fishRecord.create({
                data: {
                    channelProviderId,
                    channel: channelLogin,
                    fishName: fish.name,
                    quality: fish.quality,
                    largestFishId: createdFish.id,
                    smallestFishId: createdFish.id,
                    heaviestFishId: createdFish.id,
                    lightestFishId: createdFish.id,
                },
            });
            promises.push(newRecord);
            recordMessage = "This is the first of its kind!";
            bonus = fish.rarity !== "Trash" ? getQualityRecordBonus(fish.quality) : 0;
        } else {
            const record: string[] = [];
            const updates: { largestFishId?: number; smallestFishId?: number; heaviestFishId?: number; lightestFishId?: number } = {};

            const calculateMultiplierAndDuration = (recordCreatedAt: Date): { multiplier: number; humanizedDuration: string } => {
                const now = dayjs();
                const recordDate = dayjs(recordCreatedAt);
                const daysHeld = now.diff(recordDate, "days");
                const multiplier = 1 + Math.floor(daysHeld / 7);
                const duration = dayjs().from(recordDate, true);
                const humanizedDuration = duration;
                return { multiplier, humanizedDuration };
            };

            if (size > parseFloat(existingRecord.largestFish.size)) {
                updates.largestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.largestFish.createdAt);
                record.push(`size (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += getQualityRecordBonus(fish.quality) * multiplier;
            }
            if (size < parseFloat(existingRecord.smallestFish.size)) {
                updates.smallestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.smallestFish.createdAt);
                record.push(`smallest (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += getQualityRecordBonus(fish.quality) * multiplier;
            }
            if (weight > parseFloat(existingRecord.heaviestFish.weight)) {
                updates.heaviestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.heaviestFish.createdAt);
                record.push(`weight (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += getQualityRecordBonus(fish.quality) * multiplier;
            }
            if (weight < parseFloat(existingRecord.lightestFish.weight)) {
                updates.lightestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.lightestFish.createdAt);
                record.push(`lightest (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += getQualityRecordBonus(fish.quality) * multiplier;
            }
            if (Object.keys(updates).length > 0) {
                promises.push(prisma.fishRecord.update({ where: { id: existingRecord.id }, data: updates }));
                recordMessage = `New ${record.join(" & ")} record!`;
            }
        }

        if (bonus > 0) {
            const updateFishValue = prisma.fish.update({ where: { id: createdFish.id }, data: { value: { increment: bonus } } });
            promises.push(updateFishValue);
        }
        promises.push(increaseBalance(prisma, balance.id, fish.sellValue + bonus + treasureBonus));

        let fishStatsUpdateData: Prisma.FishStatsUpdateInput = {
            totalSilverWorth: { increment: fish.sellValue + bonus + treasureBonus },
            treasureSilver: { increment: treasureBonus },
            treasureCount: { increment: treasureBonus > 0 ? 1 : 0 },
            xp: { increment: fish.xp },
        };
        switch (fish.rarity) {
            case Rarity.Trash:
                fishStatsUpdateData = { ...fishStatsUpdateData, trashFishCount: { increment: 1 } };
                break;
            case Rarity.Common:
                fishStatsUpdateData = { ...fishStatsUpdateData, commonFishCount: { increment: 1 } };
                break;
            case Rarity.Uncommon:
                fishStatsUpdateData = { ...fishStatsUpdateData, uncommonFishCount: { increment: 1 } };
                break;
            case Rarity.Fine:
                fishStatsUpdateData = { ...fishStatsUpdateData, fineFishCount: { increment: 1 } };
                break;
            case Rarity.Rare:
                fishStatsUpdateData = { ...fishStatsUpdateData, rareFishCount: { increment: 1 } };
                break;
            case Rarity.Epic:
                fishStatsUpdateData = { ...fishStatsUpdateData, epicFishCount: { increment: 1 } };
                break;
            case Rarity.Legendary:
                fishStatsUpdateData = { ...fishStatsUpdateData, legendaryFishCount: { increment: 1 } };
                break;
        }
        if (Object.keys(fishStatsUpdateData).length > 0) {
            promises.push(prisma.fishStats.update({ where: { id: fishStats.id }, data: fishStatsUpdateData }));
        }

        // Add to FishDex and check if it's a new entry
        let fishDexMessage = "";
        const { created } = await findOrCreateFishDexEntry(prisma, channelProviderId, userProviderId, fish.name, fish.rarity);
        if (created) {
            // This is a new entry (just created)
            fishDexMessage = `New entry in your FishDex!`;

            // Check if FishDex is now completed for this rarity
            const completed = await isFishDexCompletedForRarity(prisma, channelProviderId, userProviderId, fish.rarity);
            if (completed) {
                // Check if user already has completion record
                const hasCompletion = await hasFishDexCompletion(prisma, channelProviderId, userProviderId, fish.rarity);
                if (!hasCompletion) {
                    // Create completion record and award bonus only if this is the first time
                    const bonus = FISHDEX_COMPLETION_BONUS[fish.rarity] ?? 0;
                    await createFishDexCompletion(prisma, channelProviderId, userProviderId, fish.rarity, bonus);
                    if (bonus > 0) {
                        await increaseBalance(prisma, balance.id, bonus);
                    }
                    setTimeout(() => {
                        if (fish.rarity === Rarity.Trash) {
                            sendActionToChannel(
                                channelLogin,
                                `@${userDisplayName} completed the Trash FishDex and earned ${bonus} silver! EarthDay Thanks for cleaning up the ocean and helping nature! ${CONGRATULATIONS_TRASH_FISH_DEX_EMOTES(channelLogin)}`,
                            );
                        } else {
                            sendActionToChannel(
                                channelLogin,
                                `@${userDisplayName} has completed the FishDex for [${fish.rarity}] rarity and earned a bonus of ${bonus} silver! ${CONGRATULATIONS_EMOTES(channelLogin)}`,
                            );
                        }
                    }, 1000);
                }
            }
        }

        await Promise.all(promises);

        const totalValueMessage = bonus > 0 ? `${fish.sellValue} + ${bonus} (Bonus) = ${fish.sellValue + bonus}` : `${fish.sellValue}`;
        const valueEmote = bonus > 0 ? getValueEmote(fish.sellValue + bonus) : fish.rarityEmote;
        const useAction = fish.rarity == Rarity.Legendary ? "/me " : "";
        const rod = getRod(fishStats.activeRodLevel);
        const resText = `${useAction}@${userDisplayName} [${rod.name}] Caught a [${fish.rarity}] ${fish.prefix} ${fish.name} ${fish.emote} ${fish.formatedQuality} #${channelFishCount.total} ${fish.formatedSize} ${fish.formatedWeight}!
                    It sold for ${totalValueMessage} silver! ${recordMessage} ${fishDexMessage} ${valueEmote}`;
        return resText;
    } catch (error) {
        logger.error(error, "Fish error");
        return "Something went wrong.";
    }
}

/**
 * Checks if the user has completed the FishDex for a given rarity in a channel.
 * @param prisma PrismaClient instance
 * @param channelProviderId Channel provider ID
 * @param userProviderId User provider ID
 * @param rarity Rarity string (e.g. "Epic")
 * @returns Promise<boolean>
 */
export async function isFishDexCompletedForRarity(
    prisma: dbClient,
    channelProviderId: string,
    userProviderId: string,
    rarity: Rarity,
): Promise<boolean> {
    // Get all fish names of this rarity from the fishTable
    const allFishNames = new Set(fishTable.filter(f => f.rarity === rarity).map(f => f.name));
    if (allFishNames.size === 0) return false;

    // Get all fish names of this rarity the user has caught in this channel
    const userFishDex = await prisma.fishDexEntry.count({ where: { channelProviderId, userId: userProviderId, rarity } });

    return userFishDex === allFishNames.size;
}

// Bonus table for FishDex completion per rarity
const FISHDEX_COMPLETION_BONUS: Record<Rarity, number> = {
    Common: 2500,
    Uncommon: 5000,
    Fine: 7500,
    Rare: 10_000,
    Epic: 25_000,
    Trash: 50_000,
    Exotic: 100_000,
    Mythic: 500_000,
    Legendary: 5_000_000,
};
