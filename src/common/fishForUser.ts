import { Prisma, PrismaClient, Rarity } from "@prisma/client";
import dayjs from "dayjs";
import {
    findOrCreateBalance,
    findOrCreateFishStats,
    increaseBalance,
    findOrCreateFishDexEntry,
    createFishDexCompletion,
    hasFishDexCompletion,
} from "@/db";
import { getFish, getValueEmote } from "@/fishing";
import { formatTimeToWithSeconds } from "@/utils/time";
import { boxMullerTransform, delay, pickRandom, sendActionToAllChannel, sendActionToChannel, sendMessageToChannel } from "@/utils/misc";
import {
    CONGRATULATIONS_EMOTES,
    CONGRATULATIONS_TRASH_FISH_DEX_EMOTES,
    FACTS_EMOTES,
    FISH_COOLDOWN_EMOTES,
    FISH_FINE_EMOTES,
    PAUSE_EMOTES,
    QUOTES_EMOTES,
} from "@/emotes";
import relativeTime from "dayjs/plugin/relativeTime";
import { fishTable } from "@/fishing/fishTable";
import { fishingFacts } from "@/fishing/facts";
import { friendlyCooldownMessages, fishingFriendlyQuestions, wrongPlaces, motivationalQuotes } from "./phrases";
import logger from "@/logger";
dayjs.extend(relativeTime);

interface FishForUserParams {
    prisma: PrismaClient;
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
                            ` ${pickRandom(FISH_COOLDOWN_EMOTES)} ${pickRandom(friendlyCooldownMessages)}`,
                            ` ${pickRandom(QUOTES_EMOTES)} ${pickRandom(motivationalQuotes)}`,
                            ` ${pickRandom(FACTS_EMOTES)} ${pickRandom(fishingFacts)}`,
                        ])
                    );
                }
                return `${cooldownMessage} ${pickRandom(FISH_COOLDOWN_EMOTES)}`;
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
            return `@${userDisplayName} POLICE You got caught fishing in ${place} and were fined ${fine} silver! ${pickRandom(FISH_FINE_EMOTES)}`;
        }

        const unitSystem = balance.user.unitSystem ?? "metric";
        const fish = getFish({ unitSystem });
        let bonus = 0;
        let treasureBonus = 0;
        let treasureMessage = "";
        if (fish.rarity === Rarity.Trash && Math.random() < 0.25) {
            const chestBonus = Math.floor(boxMullerTransform(1000, 500, 250));
            treasureBonus += chestBonus;
            treasureMessage = `💰 While sifting through the trash, you discovered a hidden treasure chest containing ${chestBonus} silver! ${getValueEmote(chestBonus)}`;
            setTimeout(async () => {
                sendActionToChannel(channelLogin, `@${userDisplayName} Hold on... something's glimmering in the trash! ${pickRandom(PAUSE_EMOTES)}`);
                await delay(2000);
                sendActionToChannel(channelLogin, `@${userDisplayName} ${treasureMessage}`);
            }, 2000);
        }

        const [createdFish, channelFishCount, existingRecord] = await prisma.$transaction([
            prisma.fish.create({
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
                },
            }),
            prisma.channelFishCount.upsert({
                where: { channelProviderId },
                create: { channelProviderId, total: 1 },
                update: { total: { increment: 1 } },
            }),
            prisma.fishRecord.findUnique({
                where: { channelProviderId_fishName: { channelProviderId, fishName: fish.name } },
                include: { largestFish: true, smallestFish: true, heaviestFish: true, lightestFish: true },
            }),
        ]);

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
                    largestFishId: createdFish.id,
                    smallestFishId: createdFish.id,
                    heaviestFishId: createdFish.id,
                    lightestFishId: createdFish.id,
                },
            });
            promises.push(newRecord);
            recordMessage = "This is the first of its kind!";
            bonus = fish.rarity !== "Trash" ? 100 : 0;
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
                bonus += 100 * multiplier;
            }
            if (size < parseFloat(existingRecord.smallestFish.size)) {
                updates.smallestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.smallestFish.createdAt);
                record.push(`smallest (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += 100 * multiplier;
            }
            if (weight > parseFloat(existingRecord.heaviestFish.weight)) {
                updates.heaviestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.heaviestFish.createdAt);
                record.push(`weight (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += 100 * multiplier;
            }
            if (weight < parseFloat(existingRecord.lightestFish.weight)) {
                updates.lightestFishId = createdFish.id;
                const { multiplier, humanizedDuration } = calculateMultiplierAndDuration(existingRecord.lightestFish.createdAt);
                record.push(`lightest (held for ${humanizedDuration}, ${multiplier}x bonus)`);
                bonus += 100 * multiplier;
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
        const { fishDexEntry, created } = await findOrCreateFishDexEntry(prisma, channelProviderId, userProviderId, fish.name, fish.rarity);
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
                                `@${userDisplayName} completed the Trash FishDex and earned ${bonus} silver! EarthDay Thanks for cleaning up the ocean and helping nature! ${pickRandom(CONGRATULATIONS_TRASH_FISH_DEX_EMOTES)}`,
                            );
                        } else {
                            sendActionToChannel(
                                channelLogin,
                                `@${userDisplayName} has completed the FishDex for [${fish.rarity}] rarity and earned a bonus of ${bonus} silver! ${pickRandom(CONGRATULATIONS_EMOTES)}`,
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
        const resText = `${useAction}@${userDisplayName} Caught a [${fish.rarity}] ${fish.prefix} ${fish.name} ${fish.emote} #${channelFishCount.total} ${fish.formatedSize} ${fish.formatedWeight}!
                    It sold for ${totalValueMessage} silver! ${recordMessage} ${fishDexMessage} ${valueEmote}`;
        return resText;
    } catch (error) {
        logger.error(error, "Fish error");
        return "oopsie Something went wrong.";
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
    prisma: PrismaClient,
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
    Rare: 10000,
    Epic: 25000,
    Trash: 50000,
    Legendary: 1000000,
};
