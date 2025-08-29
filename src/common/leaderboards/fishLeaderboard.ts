import { PrismaClient } from "@prisma/client";
import { formatSilver, roundToDecimalPlaces } from "@/utils/misc";
import { LeaderboardResult } from "@/common/leaderboards";

type FishMetric =
    | "count"
    | "silver"
    | "fines"
    | "avg"
    | "trash"
    | "common"
    | "uncommon"
    | "fine"
    | "rare"
    | "epic"
    | "legendary"
    | "top"
    | "treasure";

export async function handleFish(
    prisma: PrismaClient,
    channelProviderId: string,
    metric: FishMetric,
    order: "asc" | "desc",
    amount: number,
): Promise<LeaderboardResult> {
    if (metric === "top") {
        // Fetch the most valuable individual fish caught in this channel
        // Assumes a FishCatch table with value, species, userId, and user relation
        const topFish = await prisma.fish.findMany({
            where: { channelProviderId },
            include: { user: { select: { displayName: true } } },
            orderBy: { value: order === "asc" ? "asc" : "desc" },
            take: amount,
        });
        const totalEntries = await prisma.fish.count({ where: { channelProviderId } });
        const formattedLeaderboard = topFish.map((entry, i) => {
            const index = order === "asc" ? totalEntries - i : i + 1;
            // Show fish species, value, and who caught it
            return `${index}. ${entry.user.displayName}: ${formatSilver(entry.value)} Silver (${entry.name} - ${entry.rarity})`;
        });
        return { formattedLeaderboard, metricDisplay: "most valuable fish", leaderboardType: "Fish" };
    }

    // 1. Fetch FishStats including User for displayName
    const fishStatsEntries = await prisma.fishStats.findMany({
        where: { channelProviderId: channelProviderId },
        include: { user: { select: { providerId: true, displayName: true } } },
    });

    // 2. Combine data from FishStats
    const combinedData = fishStatsEntries
        .map(fs => {
            const name = fs.user.displayName;
            const totalCount =
                fs.trashFishCount +
                fs.commonFishCount +
                fs.uncommonFishCount +
                fs.fineFishCount +
                fs.rareFishCount +
                fs.epicFishCount +
                fs.legendaryFishCount;
            const value = fs.totalSilverWorth;
            const fines = fs.fishFines;
            // Calculate avg value per fish, avoid division by zero
            const avg = totalCount > 0 ? roundToDecimalPlaces(value / totalCount, 2) : 0;
            // Add treasure count
            const treasure = fs.treasureSilver ?? 0;
            return {
                name,
                value,
                count: totalCount,
                fines,
                avg,
                trash: fs.trashFishCount,
                common: fs.commonFishCount,
                uncommon: fs.uncommonFishCount,
                fine: fs.fineFishCount,
                rare: fs.rareFishCount,
                epic: fs.epicFishCount,
                legendary: fs.legendaryFishCount,
                treasure,
            };
        })
        // Optional: Filter out users with 0 in the metric being sorted, unless sorting ascending
        .filter(entry => {
            if (order === "desc") {
                if (metric === "count") return entry.count > 0;
                if (metric === "silver") return entry.value > 0;
                if (metric === "fines") return entry.fines > 0;
                if (metric === "avg") return entry.count > 0;
                if (metric === "trash") return entry.trash > 0;
                if (metric === "common") return entry.common > 0;
                if (metric === "uncommon") return entry.uncommon > 0;
                if (metric === "fine") return entry.fine > 0;
                if (metric === "rare") return entry.rare > 0;
                if (metric === "epic") return entry.epic > 0;
                if (metric === "legendary") return entry.legendary > 0;
                if (metric === "treasure") return entry.treasure > 0;
            }
            return true; // Keep all for ascending sort or if value is non-zero
        });

    const totalEntries = combinedData.length;

    // 4. Sort combined data
    const formattedLeaderboard = combinedData
        .sort((a, b) => {
            const multiplier = order === "asc" ? 1 : -1;
            let compareA, compareB;
            // Tie-breakers: 1. total value (desc), 2. total count (desc), 3. fines (asc)
            const tieBreakerValue = b.value - a.value; // Higher value is better
            const tieBreakerCount = b.count - a.count; // Higher count is better
            const tieBreakerFines = a.fines - b.fines; // Lower fines is better

            switch (metric) {
                case "count":
                    compareA = a.count;
                    compareB = b.count;
                    break;
                case "silver":
                    compareA = a.value;
                    compareB = b.value;
                    break;
                case "fines":
                    compareA = a.fines;
                    compareB = b.fines;
                    if (compareA !== compareB) return (compareA - compareB) * multiplier;
                    if (tieBreakerValue !== 0) return tieBreakerValue;
                    return tieBreakerCount;
                case "avg":
                    compareA = a.avg;
                    compareB = b.avg;
                    break;
                case "trash":
                    compareA = a.trash;
                    compareB = b.trash;
                    break;
                case "common":
                    compareA = a.common;
                    compareB = b.common;
                    break;
                case "uncommon":
                    compareA = a.uncommon;
                    compareB = b.uncommon;
                    break;
                case "fine":
                    compareA = a.fine;
                    compareB = b.fine;
                    break;
                case "rare":
                    compareA = a.rare;
                    compareB = b.rare;
                    break;
                case "epic":
                    compareA = a.epic;
                    compareB = b.epic;
                    break;
                case "legendary":
                    compareA = a.legendary;
                    compareB = b.legendary;
                    break;
                case "treasure":
                    compareA = a.treasure;
                    compareB = b.treasure;
                    break;
            }

            if (compareA !== compareB) {
                return (compareA - compareB) * multiplier;
            }
            // Apply standard tie-breakers for non-fines metrics
            if (tieBreakerValue !== 0) return tieBreakerValue;
            if (tieBreakerCount !== 0) return tieBreakerCount;
            return tieBreakerFines;
        })
        .slice(0, amount)
        // 5. Format output string based on the metric
        .map((entry, i) => {
            const index = order === "asc" ? totalEntries - i : i + 1;
            switch (metric) {
                case "count":
                case "silver":
                    return `${index}. ${entry.name}: ${entry.count} Fish (${formatSilver(entry.value)} Silver)`;
                case "avg":
                    return `${index}. ${entry.name}: ${entry.count > 0 ? formatSilver(entry.avg) : "0"} avg Silver per fish`;
                case "fines":
                    return `${index}. ${entry.name}: ${formatSilver(entry.fines)} Silver in fines`;
                case "trash":
                    return `${index}. ${entry.name}: ${entry.trash} Trash Fish`;
                case "common":
                    return `${index}. ${entry.name}: ${entry.common} Common Fish`;
                case "uncommon":
                    return `${index}. ${entry.name}: ${entry.uncommon} Uncommon Fish`;
                case "fine":
                    return `${index}. ${entry.name}: ${entry.fine} Fine Fish`;
                case "rare":
                    return `${index}. ${entry.name}: ${entry.rare} Rare Fish`;
                case "epic":
                    return `${index}. ${entry.name}: ${entry.epic} Epic Fish`;
                case "legendary":
                    return `${index}. ${entry.name}: ${entry.legendary} Legendary Fish`;
                case "treasure":
                    return `${index}. ${entry.name}: ${entry.treasure} Silver found`;
                default:
                    return "";
            }
        });

    // 6. Determine display metric based on the 'metric' parameter
    let metricDisplay: string;
    switch (metric) {
        case "count":
            metricDisplay = "fish caught";
            break;
        case "silver":
            metricDisplay = "silver value";
            break;
        case "avg":
            metricDisplay = "average fish value";
            break;
        case "fines":
            metricDisplay = "fines";
            break;
        case "trash":
            metricDisplay = "trash fish";
            break;
        case "common":
            metricDisplay = "common fish";
            break;
        case "uncommon":
            metricDisplay = "uncommon fish";
            break;
        case "fine":
            metricDisplay = "fine fish";
            break;
        case "rare":
            metricDisplay = "rare fish";
            break;
        case "epic":
            metricDisplay = "epic fish";
            break;
        case "legendary":
            metricDisplay = "legendary fish";
            break;
        case "treasure":
            metricDisplay = "treasure chests";
            break;
    }

    return { formattedLeaderboard, metricDisplay, leaderboardType: "Fish" };
}
