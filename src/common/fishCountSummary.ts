import { PrismaClient, Rarity } from "@prisma/client";
import { formatWeight, roundToDecimalPlaces, formatSilver } from "@/utils/misc";
import { findOrCreateFishStats } from "@/db";
import { getUserById } from "@/twitch/api";

// Helper to format the summary for both user and channel stats
function formatFishCountSummary({
    displayName,
    totalCount,
    totalValue,
    avgSilverPerFish,
    fishCountsByRarity,
    fines,
    finesCount,
    treasure,
    treasureCount,
    isChannel = false,
}: {
    displayName: string;
    totalCount: number;
    totalValue: number;
    avgSilverPerFish: number;
    fishCountsByRarity: { rarity: Rarity; count: number }[];
    fines: number;
    finesCount: number;
    treasure: number;
    treasureCount: number;
    isChannel?: boolean;
}) {
    const rarityBreakdown = fishCountsByRarity
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(f => `${f.count} ${f.rarity.toLowerCase()}`)
        .join(", ");

    // Improved fines and treasure text
    const finesText = fines > 0 ? `received ${finesCount} fine${finesCount !== 1 ? "s" : ""} totaling ${formatSilver(fines)} silver` : "";
    const treasureText =
        treasure > 0 ? `discovered ${formatSilver(treasure)} silver in ${treasureCount} treasure chest${treasureCount !== 1 ? "s" : ""}` : "";

    let extras = "";
    if (finesText && treasureText) {
        extras = isChannel ? `The channel has ${finesText} and has ${treasureText}.` : `They have ${finesText} and have ${treasureText}.`;
    } else if (finesText) {
        extras = isChannel ? `The channel has ${finesText}.` : `They have ${finesText}.`;
    } else if (treasureText) {
        extras = isChannel ? `The channel has ${treasureText}.` : `They have ${treasureText}.`;
    }
    if (totalCount > 0) {
        return isChannel
            ? `Channel "${displayName}" has caught ${totalCount} fish worth ${formatSilver(totalValue)} silver in total! (avg ${formatSilver(avgSilverPerFish)} silver/fish)${rarityBreakdown.length > 0 ? ` (${rarityBreakdown})` : ""}. ${extras}`
            : `@${displayName} has caught ${totalCount} fish worth ${formatSilver(totalValue)} silver in total! (avg ${formatSilver(avgSilverPerFish)} silver/fish)${rarityBreakdown.length > 0 ? ` (${rarityBreakdown})` : ""}. ${extras}`;
    } else {
        return isChannel ? `Channel "${displayName}" has not caught any fish yet!${extras}` : `@${displayName} has not caught any fish yet!${extras}`;
    }
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
    userProviderId: string | null;
    userLogin: string | null;
    userDisplayName: string;
}): Promise<string> {
    if (!userProviderId) {
        // Global/channel stats
        const stats = await prisma.fishStats.aggregate({
            where: { channelProviderId },
            _sum: {
                trashFishCount: true,
                commonFishCount: true,
                uncommonFishCount: true,
                fineFishCount: true,
                rareFishCount: true,
                epicFishCount: true,
                legendaryFishCount: true,
                fishFines: true,
                fishFinesCount: true,
                treasureSilver: true,
                treasureCount: true,
                totalSilverWorth: true,
            },
        });
        const fishCountsByRarity = [
            { rarity: Rarity.Legendary, count: stats._sum.legendaryFishCount ?? 0 },
            { rarity: Rarity.Epic, count: stats._sum.epicFishCount ?? 0 },
            { rarity: Rarity.Rare, count: stats._sum.rareFishCount ?? 0 },
            { rarity: Rarity.Fine, count: stats._sum.fineFishCount ?? 0 },
            { rarity: Rarity.Uncommon, count: stats._sum.uncommonFishCount ?? 0 },
            { rarity: Rarity.Common, count: stats._sum.commonFishCount ?? 0 },
            { rarity: Rarity.Trash, count: stats._sum.trashFishCount ?? 0 },
        ];
        const totalCount = fishCountsByRarity.reduce((acc, curr) => acc + curr.count, 0);
        const totalValue = stats._sum.totalSilverWorth ?? 0;
        const avgSilverPerFish = totalCount > 0 ? roundToDecimalPlaces(totalValue / totalCount, 2) : 0;
        return formatFishCountSummary({
            displayName: channelLogin,
            totalCount,
            totalValue,
            avgSilverPerFish,
            fishCountsByRarity,
            fines: stats._sum.fishFines ?? 0,
            finesCount: stats._sum.fishFinesCount ?? 0,
            treasure: stats._sum.treasureSilver ?? 0,
            treasureCount: stats._sum.treasureCount ?? 0,
            isChannel: true,
        });
    }
    // Optionally update user info if getUserByIdFn is provided
    const user = await getUserById(prisma, userProviderId);
    if (user) {
        userProviderId = user.id;
        userLogin = user.login;
        userDisplayName = user.displayName;
    }
    const fishStats = await findOrCreateFishStats(prisma, channelLogin, channelProviderId, userProviderId, userLogin!, userDisplayName);

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
    const avgSilverPerFish = totalCount > 0 ? roundToDecimalPlaces(totalValue / totalCount, 2) : 0;

    return formatFishCountSummary({
        displayName: userDisplayName,
        totalCount,
        totalValue,
        avgSilverPerFish,
        fishCountsByRarity,
        fines: fishStats.fishFines,
        finesCount: fishStats.fishFinesCount,
        treasure: fishStats.treasureSilver,
        treasureCount: fishStats.treasureCount,
        isChannel: false,
    });
}
