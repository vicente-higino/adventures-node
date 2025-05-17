import { OpenAPIRoute } from "chanfana";
import { type Env, FossaHeaders } from "../types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { Prisma, PrismaClient, Rarity } from "@prisma/client";
import type { Context } from "hono";
import { findOrCreateBalance, findOrCreateUserStats, increaseBalance, findOrCreateFishStats } from "db";
import { getFish, getValueEmote } from "fishing";
import dayjs from "dayjs";
import { formatTimeToWithSeconds } from "utils/time";
import { boxMullerTransform, pickRandom } from "utils/misc";
import { FISH_COOLDOWN_EMOTES, FISH_FINE_EMOTES } from "emotes";
import relativeTime from "dayjs/plugin/relativeTime";
import { PrismaPg } from "@prisma/adapter-pg";

dayjs.extend(relativeTime);
// Define random wrong places
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

export class Fish extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders }, responses: {} };
    async handle(c: Context<Env>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");

        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let userProviderId = data.headers["x-fossabot-message-userproviderid"];
        let userLogin = data.headers["x-fossabot-message-userlogin"];
        let userDisplayName = data.headers["x-fossabot-message-userdisplayname"];

        const fishStats = await findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
        if (fishStats.totalSilverWorth > 0 && fishStats.updatedAt > new Date(Date.now() - 1000 * 60 * 60 * c.env.COOLDOWN_FISHING_IN_HOURS)) {
            const timeUntilNext = dayjs(fishStats.updatedAt).add(60, "minutes");
            return c.text(
                `@${userDisplayName}, you can only fish again in ${formatTimeToWithSeconds(timeUntilNext.toDate())}.
                ${pickRandom(FISH_COOLDOWN_EMOTES)}`,
            );
        }

        let balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);

        // 1% chance to get caught
        if (fishStats.totalSilverWorth > 0 && Math.random() < 0.01) {
            // 1% chance to get caught
            const fine = Math.min(100, Math.floor(boxMullerTransform(50, 25, 25)));
            const place = pickRandom(wrongPlaces);
            // Ensure balance is not null before decreasing
            if (!balance) {
                // This should ideally not happen due to findOrCreateBalance, but handle defensively
                return c.text(`@${userDisplayName} Something went wrong finding your balance.`);
            }
            // Update the last fish record's updatedAt timestamp to reset the cooldown
            const updateCaughtTimestamp = prisma.fishStats.update({
                where: { id: fishStats.id },
                data: { updatedAt: dayjs().toISOString() }, // Explicitly update the timestamp
            });
            const updateFishFinesInFishStats = prisma.fishStats.update({ where: { id: fishStats.id }, data: { fishFines: { increment: fine } } }); // Increment fishFines in FishStats
            // Add the timestamp update to waitUntil
            await Promise.all([increaseBalance(prisma, balance.id, -fine), updateFishFinesInFishStats, updateCaughtTimestamp]);
            return c.text(
                `@${userDisplayName} POLICE You got caught fishing in ${place} and were fined ${fine} silver! ${pickRandom(FISH_FINE_EMOTES)}`,
            );
        }

        // If not caught, proceed with fishing
        // Use the user associated with the last fish or the fetched balance's user
        const unitSystem = balance.user.unitSystem ?? "metric";
        const fish = getFish({ unitSystem });
        let bonus = 0; // Initialize bonus

        const [createdFish, existingRecord] = await Promise.all([
            // Balance is already fetched/created, no need to do it again here
            // Use the existing 'balance' variable which holds the result of findOrCreateBalance
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

        // Determine if a record was broken and set bonus
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
            bonus = fish.rarity !== "Trash" ? 100 : 0; // Bonus for the first of its kind
        } else {
            const record: string[] = [];
            const updates: { largestFishId?: number; smallestFishId?: number; heaviestFishId?: number; lightestFishId?: number } = {};

            const calculateMultiplierAndDuration = (recordCreatedAt: Date): { multiplier: number; humanizedDuration: string } => {
                const now = dayjs();
                const recordDate = dayjs(recordCreatedAt);
                const daysHeld = now.diff(recordDate, "days");
                const multiplier = 1 + Math.floor(daysHeld / 7); // 1x base, +1 for each full week held
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
                // Persist updates to FishRecord
                promises.push(prisma.fishRecord.update({ where: { id: existingRecord.id }, data: updates }));
                recordMessage = `New ${record.join(" & ")} record!`;
            }
        }

        // Create the fish entry with the potential bonus included in its value
        if (bonus > 0) {
            const updateFishValue = prisma.fish.update({ where: { id: createdFish.id }, data: { value: { increment: bonus } } });
            promises.push(updateFishValue);
        }
        // Use the balance.id obtained earlier, add bonus to the amount credited
        promises.push(increaseBalance(prisma, balance.id, fish.sellValue + bonus));

        // Update FishStats for the caught fish rarity
        let fishStatsUpdateData: Prisma.FishStatsUpdateInput = { totalSilverWorth: { increment: fish.sellValue + bonus } };
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

        await Promise.all(promises);

        const totalValueMessage = bonus > 0 ? `${fish.sellValue} + ${bonus} (Record Bonus) = ${fish.sellValue + bonus}` : `${fish.sellValue}`;
        const valueEmote = bonus > 0 ? getValueEmote(fish.sellValue + bonus) : fish.rarityEmote;
        return c.text(
            `@${userDisplayName} Caught a [${fish.rarity}] ${fish.prefix} ${fish.name} ${fish.emote} ${fish.formatedSize} ${fish.formatedWeight}! It sold for ${totalValueMessage} silver! ${recordMessage} ${valueEmote}`,
        );
    }
}
