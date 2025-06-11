import { PrismaClient } from "@prisma/client";
import { formatSilver } from "@/utils/misc";
import { LeaderboardResult } from ".";

export async function handleDuel(
    prisma: PrismaClient,
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
