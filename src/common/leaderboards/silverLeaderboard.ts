import { LeaderboardResult } from "@/common/leaderboards";
import { dbClient } from "@/prisma";
import { formatSilver } from "@/utils/misc";

export async function handleSilver(prisma: dbClient, channelProviderId: string, order: "asc" | "desc", amount: number): Promise<LeaderboardResult> {
    const balances = await prisma.balance.findMany({
        where: { channelProviderId: channelProviderId },
        include: { user: { select: { displayName: true, login: true } } },
    });
    const totalEntries = balances.length;

    const formattedLeaderboard = balances
        .map(entry => ({ name: entry.user.login, displayName: entry.user.displayName, value: entry.value }))
        .sort((a, b) => {
            const multiplier = order === "asc" ? 1 : -1;
            const nameSort = a.name.localeCompare(b.name);
            return (a.value - b.value + nameSort) * multiplier;
        })
        .slice(0, amount)
        .map((entry, i) => {
            const index = order === "asc" ? totalEntries - i : i + 1;
            return `${index}. ${entry.displayName}: ${formatSilver(entry.value)} Silver`;
        });

    return { formattedLeaderboard, metricDisplay: "silver", leaderboardType: "Silver" };
}
