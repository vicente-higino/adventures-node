import { Prisma, PrismaClient, Rarity } from "@prisma/client";
import dayjs from "dayjs";
import { findOrCreateBalance, findOrCreateFishStats, increaseBalance } from "@/db";
import { getFish, getValueEmote } from "@/fishing";
import { formatTimeToWithSeconds } from "@/utils/time";
import { boxMullerTransform, pickRandom } from "@/utils/misc";
import { FISH_COOLDOWN_EMOTES, FISH_FINE_EMOTES } from "@/emotes";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const wrongPlaces = [
    "the neighbour's koi pond",
    "a restricted military zone",
    "the city fountain",
    "a private aquarium",
    "a wishing well",
    "the mall's decorative pond",
    "the general's swimming pool",
    "a children's inflatable pool",
    "a water treatment plant",
    "a historical landmark's moat",
    "a science lab's fish tank",
    "a theme park's water ride",
    "a hotel's luxury pool",
    "a zoo's penguin exhibit",
    "a public restroom's sink",
];

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
    const fishStats = await findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    if (fishStats.totalSilverWorth > 0) {
        const lastFishedAt = fishStats.updatedAt;
        const nextAvailable = new Date(lastFishedAt.getTime() + 1000 * 60 * 60 * cooldownHours);
        const now = new Date();
        const secondsLeft = Math.ceil((nextAvailable.getTime() - now.getTime()) / 1000);

        if (secondsLeft > 0) {
            const timeUntilNext = dayjs(nextAvailable);
            const cooldownMessage = `@${userDisplayName}, you can only fish again in ${formatTimeToWithSeconds(timeUntilNext.toDate())}. ${pickRandom(FISH_COOLDOWN_EMOTES)}`;
            return cooldownMessage;
        }
    }

    const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);

    // 1% chance to get caught
    if (fishStats.totalSilverWorth > 0 && Math.random() < 0.01) {
        const fine = Math.min(100, Math.floor(boxMullerTransform(50, 25, 25)));
        const place = pickRandom(wrongPlaces);
        if (!balance) {
            return `@${userDisplayName} Something went wrong finding your balance.`;
        }
        const updateCaughtTimestamp = prisma.fishStats.update({ where: { id: fishStats.id }, data: { updatedAt: dayjs().toISOString() } });
        const updateFishFinesInFishStats = prisma.fishStats.update({ where: { id: fishStats.id }, data: { fishFines: { increment: fine } } });
        await Promise.all([increaseBalance(prisma, balance.id, -fine), updateFishFinesInFishStats, updateCaughtTimestamp]);
        return `@${userDisplayName} POLICE You got caught fishing in ${place} and were fined ${fine} silver! ${pickRandom(FISH_FINE_EMOTES)}`;
    }

    const unitSystem = balance.user.unitSystem ?? "metric";
    const fish = getFish({ unitSystem });
    let bonus = 0;
    let treasureBonus = 0;
    let treasureMessage = "";
    if (fish.rarity === Rarity.Trash && Math.random() < 0.25) {
        // Treasure chest logic: random bonus between 50 and 200 silver
        const chestBonus = Math.floor(boxMullerTransform(1000, 500, 250));
        treasureBonus += chestBonus;
        treasureMessage = `🎁 You found a treasure chest hidden in the trash! (+${chestBonus} silver)`;
    }

    const [createdFish, existingRecord] = await Promise.all([
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

    Promise.all(promises);

    const totalValueMessage = bonus > 0 ? `${fish.sellValue} + ${bonus} (Bonus) = ${fish.sellValue + bonus}` : `${fish.sellValue}`;
    const valueEmote = bonus > 0 || treasureBonus > 0 ? getValueEmote(fish.sellValue + bonus + treasureBonus) : fish.rarityEmote;
    const resText = `@${userDisplayName} Caught a [${fish.rarity}] ${fish.prefix} ${fish.name} ${fish.emote} #${createdFish.id} ${fish.formatedSize} ${fish.formatedWeight}! It sold for ${totalValueMessage} silver! ${treasureMessage} ${recordMessage} ${valueEmote}`;
    return resText;
}
