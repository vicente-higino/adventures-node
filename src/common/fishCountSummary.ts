import { PrismaClient, Rarity } from "@prisma/client";
import { formatSize, formatWeight, roundToDecimalPlaces, formatSilver } from "@/utils/misc";
import { findOrCreateFishStats } from "@/db";
import { getUserById } from "@/twitch/api";

export async function getFishRecordStats({
    prisma,
    channelProviderId,
    userProviderId,
}: {
    prisma: PrismaClient;
    channelProviderId: string;
    userProviderId: string;
}): Promise<string> {
    const fishRecords = await prisma.fishRecord.findMany({
        where: {
            channelProviderId: channelProviderId,
            OR: [
                { largestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                { smallestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                { heaviestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
                { lightestFish: { userId: userProviderId, rarity: { not: Rarity.Trash } } },
            ],
        },
        select: {
            fishName: true,
            largestFish: { select: { userId: true, size: true, rarity: true } },
            smallestFish: { select: { userId: true, size: true, rarity: true } },
            heaviestFish: { select: { userId: true, weight: true, rarity: true } },
            lightestFish: { select: { userId: true, weight: true, rarity: true } },
        },
    });

    const records = fishRecords.reduce<{
        largest: { text: string; value: number }[];
        smallest: { text: string; value: number }[];
        heaviest: { text: string; value: number }[];
        lightest: { text: string; value: number }[];
    }>(
        (acc, record) => {
            if (record.largestFish.userId === userProviderId) {
                acc.largest.push({
                    text: `${record.fishName} (${formatSize(parseFloat(record.largestFish.size))})`,
                    value: parseFloat(record.largestFish.size),
                });
            }
            if (record.smallestFish.userId === userProviderId) {
                acc.smallest.push({
                    text: `${record.fishName} (${formatSize(parseFloat(record.smallestFish.size))})`,
                    value: parseFloat(record.smallestFish.size),
                });
            }
            if (record.heaviestFish.userId === userProviderId) {
                acc.heaviest.push({
                    text: `${record.fishName} (${formatWeight(parseFloat(record.heaviestFish.weight))})`,
                    value: parseFloat(record.heaviestFish.weight),
                });
            }
            if (record.lightestFish.userId === userProviderId) {
                acc.lightest.push({
                    text: `${record.fishName} (${formatWeight(parseFloat(record.lightestFish.weight))})`,
                    value: parseFloat(record.lightestFish.weight),
                });
            }
            return acc;
        },
        { largest: [], smallest: [], heaviest: [], lightest: [] },
    );

    // Sort and limit each category
    Object.keys(records).forEach(key => {
        const recordArray = records[key as keyof typeof records];
        const sorted = recordArray.sort((a, b) => {
            return key === "smallest" || key === "lightest" ? a.value - b.value : b.value - a.value;
        });

        records[key as keyof typeof records] = sorted.slice(0, 3);
        if (sorted.length > 3) {
            const lastRecord = records[key as keyof typeof records][2];
            lastRecord.text += ` and ${sorted.length - 3} more`;
        }
    });

    const recordsText = Object.entries(records).some(([_, items]) => items.length > 0)
        ? `They hold the record for: ${Object.entries(records)
              .filter(([_, items]) => items.length > 0)
              .map(([type, items]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${items.map(i => i.text).join(", ")}`)
              .join("; ")}!`
        : "They do not hold any records.";

    return recordsText;
}

export async function getFishCountSummary({
    prisma,
    channelLogin,
    channelProviderId,
    userProviderId,
    userLogin,
    userDisplayName,
}: {
    prisma: PrismaClient;
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}): Promise<string> {
    // Optionally update user info if getUserByIdFn is provided
    const user = await getUserById(prisma, userProviderId);
    if (user) {
        userProviderId = user.id;
        userLogin = user.login;
        userDisplayName = user.displayName;
    }
    // Get FishStats
    const fishStats = await findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);

    const fishCountsByRarity = [
        { rarity: Rarity.Legendary, count: fishStats.legendaryFishCount },
        { rarity: Rarity.Epic, count: fishStats.epicFishCount },
        { rarity: Rarity.Rare, count: fishStats.rareFishCount },
        { rarity: Rarity.Fine, count: fishStats.fineFishCount },
        { rarity: Rarity.Uncommon, count: fishStats.uncommonFishCount },
        { rarity: Rarity.Common, count: fishStats.commonFishCount },
        { rarity: Rarity.Trash, count: fishStats.trashFishCount },
    ];

    const totalCount = fishCountsByRarity.reduce((acc, curr) => acc + curr.count, 0);
    const totalValue = fishStats.totalSilverWorth;

    // Calculate average silver per fish
    const avgSilverPerFish = totalCount > 0 ? roundToDecimalPlaces(totalValue / totalCount, 2) : 0;

    const rarityBreakdown = fishCountsByRarity
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(f => `${f.count} ${f.rarity.toLowerCase()}`)
        .join(", ");

    const finesText = fishStats.fishFines > 0 ? `been fined ${formatSilver(fishStats.fishFines)} silver` : "";
    const treasureText = fishStats.treasureSilver > 0 ? `found ${formatSilver(fishStats.treasureSilver)} silver in treasure` : "";
    let extras = "";
    if (finesText && treasureText) {
        extras = `They have ${finesText} and ${treasureText}.`;
    } else if (finesText) {
        extras = `They have ${finesText}.`;
    } else if (treasureText) {
        extras = `They have ${treasureText}.`;
    }
    return totalCount > 0
        ? `@${userDisplayName} has caught ${totalCount} fish worth ${formatSilver(totalValue)} silver in total! (avg ${formatSilver(avgSilverPerFish)} silver/fish)${rarityBreakdown.length > 0 ? ` (${rarityBreakdown})` : ""}. ${extras}`
        : `@${userDisplayName} has not caught any fish yet!${extras}`;
}
