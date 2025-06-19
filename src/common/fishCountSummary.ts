import { PrismaClient, Rarity } from "@prisma/client";
import { formatWeight, roundToDecimalPlaces, formatSilver } from "@/utils/misc";
import { findOrCreateFishStats } from "@/db";
import { getUserById } from "@/twitch/api";

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
