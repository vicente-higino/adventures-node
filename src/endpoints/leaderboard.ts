import { OpenAPIRoute } from "chanfana";
import { type HonoEnv, FossaHeaders } from "@/types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient, Prisma } from "@prisma/client"; // Import Prisma namespace for types
import type { Context } from "hono";
import { z } from "zod";
import { formatSilver, roundToDecimalPlaces } from "@/utils/misc"; // Ensure utils/misc path is correct

// Define a union type for leaderboard types
// Note: "Silver" is removed as it's now handled via "fish-silver"
// Rename "Points" to "Silver"
type LeaderboardType = "Adventure" | "Duel" | "Fish" | "Silver"; // Renamed Points to Silver

// Add "avg" to FishMetric
// Define internal metrics for Fish leaderboard
type FishMetric = "count" | "silver" | "fines" | "avg" | "trash" | "common" | "uncommon" | "fine" | "rare" | "epic" | "legendary" | "top";

type LeaderboardResult = { formattedLeaderboard: string[]; metricDisplay: string };

export class ConsolidatedLeaderboard extends OpenAPIRoute {
    // Updated schema to handle all leaderboard types
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                amount: z.number({ description: "Top/Bottom amount", invalid_type_error: "Amount must be between 1-25" }).min(1).max(25).default(10),
                sortBy: z
                    .string({
                        description: "Sort criteria",
                        invalid_type_error:
                            "Sort by must be [adventure-|duel-][wins|played|wagered|profit][-asc|-bottom], fish[-silver|-avg|-fines|-trash|-common|-uncommon|-fine|-rare|-epic|-legendary|-top][-asc|-bottom], or silver[-asc|-bottom]. Default: silver.", // Added top
                    })
                    .regex(
                        // Add top to regex
                        /^(?:(adventure|duel)-)?(wins|played|wagered|profit|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top))?|silver)(-(?:asc|bottom))?$/i,
                        "Sort by: [adventure-|duel-][wins|played|wagered|profit][-asc|-bottom], fish[-silver|-avg|-fines|-trash|-common|-uncommon|-fine|-rare|-epic|-legendary|-top][-asc|-bottom], or silver[-asc|-bottom].", // Added top
                    )
                    .default("silver"), // Default to silver
            }),
        },
        responses: {},
    };

    handleValidationError(errors: z.ZodIssue[]): Response {
        // Concise usage message
        const msg =
            "Usage: !leaderboard [duel-][wins|played|wagered|profit] | fish[-silver|-avg|-fines|-rarity|-top] | silver [-asc|-bottom] [amount] (default: silver, 5)";
        return new Response(msg, { status: 400 });
    }

    // Helper function for Adventure Leaderboards
    private async _handleAdventure(
        prisma: PrismaClient<{ adapter: PrismaD1 }>,
        channelProviderId: string,
        metric: "wins" | "played" | "wagered" | "profit",
        order: "asc" | "desc",
        amount: number,
    ): Promise<LeaderboardResult> {
        const stats = await prisma.userStats.findMany({
            where: { channelProviderId: channelProviderId, gamesPlayed: { gt: 0 } },
            include: { user: true },
        });
        const totalEntries = stats.length;

        const formattedLeaderboard = stats
            .map(entry => {
                const wins = entry.gamesWon;
                const played = entry.gamesPlayed;
                const wagered = entry.totalWagers;
                const profit = entry.totalWinnings - entry.totalWagers;
                const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
                return { name: entry.user.displayName, wins, played, wagered, profit, winRate };
            })
            .sort((a, b) => {
                const multiplier = order === "asc" ? 1 : -1;
                let compareA, compareB;
                switch (metric) {
                    case "wins":
                        compareA = a.wins;
                        compareB = b.wins;
                        break;
                    case "played":
                        compareA = a.played;
                        compareB = b.played;
                        break;
                    case "wagered":
                        compareA = a.wagered;
                        compareB = b.wagered;
                        break;
                    case "profit":
                        compareA = a.profit;
                        compareB = b.profit;
                        break;
                }
                let tieBreakerA = a.winRate,
                    tieBreakerB = b.winRate;
                if (metric === "wagered") {
                    tieBreakerA = a.profit;
                    tieBreakerB = b.profit;
                } else if (metric === "profit") {
                    tieBreakerA = a.wins;
                    tieBreakerB = b.wins;
                }

                return compareA === compareB ? (tieBreakerA - tieBreakerB) * multiplier : (compareA - compareB) * multiplier;
            })
            .slice(0, amount)
            .map((entry, i) => {
                const index = order === "asc" ? totalEntries - i : i + 1;
                switch (metric) {
                    case "wins":
                        return `${index}. ${entry.name}: ${entry.wins} wins (${entry.winRate}% WR)`;
                    case "played":
                        return `${index}. ${entry.name}: ${entry.played} games (${entry.winRate}% WR)`;
                    case "wagered":
                        return `${index}. ${entry.name}: ${formatSilver(entry.wagered)} silver`;
                    case "profit":
                        return `${index}. ${entry.name}: ${entry.profit >= 0 ? "+" : ""}${formatSilver(entry.profit)} silver`;
                    default:
                        return "";
                }
            });

        return { formattedLeaderboard, metricDisplay: metric };
    }

    // Helper function for Duel Leaderboards
    private async _handleDuel(
        prisma: PrismaClient<{ adapter: PrismaD1 }>,
        channelProviderId: string,
        metric: "wins" | "played" | "wagered" | "profit",
        order: "asc" | "desc",
        amount: number,
    ): Promise<LeaderboardResult> {
        const stats = await prisma.userStats.findMany({
            where: { channelProviderId: channelProviderId, duelsPlayed: { gt: 0 } },
            include: { user: true },
        });
        const totalEntries = stats.length;

        const formattedLeaderboard = stats
            .map(entry => {
                const wins = entry.duelsWon;
                const played = entry.duelsPlayed;
                const wagered = entry.duelsWagered;
                const profit = entry.duelsWonAmount - entry.duelsWagered;
                const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
                return { name: entry.user.displayName, wins, played, wagered, profit, winRate };
            })
            .sort((a, b) => {
                const multiplier = order === "asc" ? 1 : -1;
                let compareA, compareB;
                switch (metric) {
                    case "wins":
                        compareA = a.wins;
                        compareB = b.wins;
                        break;
                    case "played":
                        compareA = a.played;
                        compareB = b.played;
                        break;
                    case "wagered":
                        compareA = a.wagered;
                        compareB = b.wagered;
                        break;
                    case "profit":
                        compareA = a.profit;
                        compareB = b.profit;
                        break;
                }
                let tieBreakerA = a.winRate,
                    tieBreakerB = b.winRate;
                if (metric === "wagered") {
                    tieBreakerA = a.profit;
                    tieBreakerB = b.profit;
                } else if (metric === "profit") {
                    tieBreakerA = a.wins;
                    tieBreakerB = b.wins;
                }

                return compareA === compareB ? (tieBreakerA - tieBreakerB) * multiplier : (compareA - compareB) * multiplier;
            })
            .slice(0, amount)
            .map((entry, i) => {
                const index = order === "asc" ? totalEntries - i : i + 1;
                switch (metric) {
                    case "wins":
                        return `${index}. ${entry.name}: ${entry.wins} wins (${entry.winRate}% WR)`;
                    case "played":
                        return `${index}. ${entry.name}: ${entry.played} duels (${entry.winRate}% WR)`;
                    case "wagered":
                        return `${index}. ${entry.name}: ${formatSilver(entry.wagered)} silver`;
                    case "profit":
                        return `${index}. ${entry.name}: ${entry.profit >= 0 ? "+" : ""}${formatSilver(entry.profit)} silver`;
                    default:
                        return "";
                }
            });

        return { formattedLeaderboard, metricDisplay: metric };
    }

    // Helper function for Fish Leaderboards (handles count, silver value, fines, avg, rarities, and top fish)
    private async _handleFish(
        prisma: PrismaClient<{ adapter: PrismaD1 }>,
        channelProviderId: string,
        metric: FishMetric, // Use the FishMetric type
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
            return { formattedLeaderboard, metricDisplay: "most valuable fish" };
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
        }

        return { formattedLeaderboard, metricDisplay };
    }

    // Helper function for Silver Leaderboard (previously Points)
    private async _handleSilver(
        // Renamed from _handlePoints
        prisma: PrismaClient<{ adapter: PrismaD1 }>,
        channelProviderId: string,
        order: "asc" | "desc",
        amount: number,
    ): Promise<LeaderboardResult> {
        const balances = await prisma.balance.findMany({
            where: { channelProviderId: channelProviderId },
            include: { user: { select: { displayName: true } } },
        });
        const totalEntries = balances.length;

        const formattedLeaderboard = balances
            .map(entry => ({ name: entry.user.displayName, value: entry.value }))
            .sort((a, b) => {
                const multiplier = order === "asc" ? 1 : -1;
                return (a.value - b.value) * multiplier;
            })
            .slice(0, amount)
            .map((entry, i) => {
                const index = order === "asc" ? totalEntries - i : i + 1;
                return `${index}. ${entry.name}: ${formatSilver(entry.value)} Silver`;
            });

        return { formattedLeaderboard, metricDisplay: "silver" }; // Changed metricDisplay from "points" to "silver"
    }

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const { amount, sortBy } = data.params;

        // Parse sortBy to get type, metric, and order
        const sortParts = sortBy
            .toLowerCase()
            .match(
                /^(?:(adventure|duel)-)?(wins|played|wagered|profit|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top))?|silver)(-(?:asc|bottom))?$/i,
            ); // Use updated regex
        if (!sortParts) {
            // This should ideally not happen due to Zod validation, but good practice to keep.
            return c.text("Invalid sort parameter format.", { status: 400 });
        }

        const prefix = sortParts[1]; // 'adventure', 'duel', or undefined
        const metricOrType = sortParts[2]; // e.g., 'wins', 'fish', 'fish-silver', 'fish-legendary', 'silver'
        const orderSuffix = sortParts[3]; // Will be '-asc', '-bottom', or undefined
        const order = orderSuffix && (orderSuffix === "-asc" || orderSuffix === "-bottom") ? "asc" : "desc";

        let leaderboardType: LeaderboardType;
        let internalMetric: string = metricOrType; // Use a separate variable for internal logic if needed

        // Determine Leaderboard Type and adjust metric if needed
        if (["wins", "played", "wagered", "profit"].includes(metricOrType)) {
            // If prefix is 'duel', it's Duel. Otherwise (adventure or undefined), it's Adventure.
            leaderboardType = prefix === "duel" ? "Duel" : "Adventure";
        } else if (metricOrType.startsWith("fish-")) {
            leaderboardType = "Fish";
            internalMetric = metricOrType.substring(5); // "silver", "fines", "legendary", etc.
        } else if (metricOrType === "fish") {
            leaderboardType = "Fish";
            internalMetric = "count"; // Default fish sorts by count
        } else if (metricOrType === "silver") {
            leaderboardType = "Silver";
            internalMetric = "value"; // Silver is based on balance value
        } else {
            // Should not be reachable due to regex validation
            return c.text("Invalid sort type.", { status: 400 });
        }

        let result: LeaderboardResult;

        try {
            // Call the appropriate helper function based on the determined leaderboardType
            if (leaderboardType === "Adventure") {
                result = await this._handleAdventure(
                    prisma,
                    channelProviderId,
                    internalMetric as "wins" | "played" | "wagered" | "profit",
                    order,
                    amount,
                );
            } else if (leaderboardType === "Duel") {
                result = await this._handleDuel(prisma, channelProviderId, internalMetric as "wins" | "played" | "wagered" | "profit", order, amount);
            } else if (leaderboardType === "Fish") {
                // Call the renamed _handleFish function with the correct FishMetric
                result = await this._handleFish(prisma, channelProviderId, internalMetric as FishMetric, order, amount);
            } else {
                // Silver (previously Points)
                result = await this._handleSilver(prisma, channelProviderId, order, amount); // Call renamed function
            }
        } catch (error) {
            console.error("Leaderboard generation error:", error);
            // Check if error is a Prisma error and provide more details if needed
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                console.error("Prisma Error Code:", error.code);
                console.error("Prisma Error Meta:", error.meta);
            }
            return c.text("An error occurred while generating the leaderboard.", { status: 500 });
        }

        // Construct final response
        const direction = order === "asc" ? "Bottom" : "Top";
        // Use "Fish" as typeDisplay even if sorting by fines or silver value
        const typeDisplay = leaderboardType;
        const metricDisplay = result.metricDisplay.replace(/_/g, " "); // Make metric display friendly

        if (result.formattedLeaderboard.length === 0) {
            return c.text(`No data found for ${typeDisplay} leaderboard sorted by ${metricDisplay}.`);
        }

        return c.text(`${typeDisplay} ${direction} ${amount} by ${metricDisplay}:$(newline)${result.formattedLeaderboard.join(" | ")}`);
    }
}
