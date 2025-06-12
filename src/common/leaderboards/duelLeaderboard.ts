import { PrismaClient } from "@prisma/client";
import { formatSilver } from "@/utils/misc";
import { LeaderboardResult } from ".";

export async function handleDuel(
    prisma: PrismaClient,
    channelProviderId: string,
    metric: "wins" | "played" | "wagered" | "profit" | "streak",
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
            const streak = entry.winStreak > 0 ? entry.winStreak : -entry.loseStreak; // Combine win/lose streaks
            return { name: entry.user.displayName, wins, played, wagered, profit, winRate, streak };
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
                case "streak":
                    compareA = a.streak;
                    compareB = b.streak;
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
            } else if (metric === "streak") {
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
                case "streak":
                    const streakType = entry.streak > 0 ? "win" : "lose";
                    const streakValue = Math.abs(entry.streak);
                    return `${index}. ${entry.name}: ${streakValue}x ${streakType} streak`;
                default:
                    return "";
            }
        });

    return { formattedLeaderboard, metricDisplay: metric };
}
