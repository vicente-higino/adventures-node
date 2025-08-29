import { PrismaClient } from "@prisma/client";
import { formatSilver } from "@/utils/misc";
import { LeaderboardResult } from "@/common/leaderboards";

export async function handleSilver(
    prisma: PrismaClient,
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

    return { formattedLeaderboard, metricDisplay: "silver", leaderboardType: "Silver" };
}
