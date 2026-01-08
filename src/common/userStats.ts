import { findOrCreateBalance, findOrCreateUserStats } from "@/db";
import { dbClient } from "@/prisma";
import { formatSilver } from "@/utils/misc";

interface GetUserStatsStringParams {
    prisma: dbClient;
    channelLogin: string;
    channelProviderId: string;
    userProviderId: string;
    userLogin: string;
    userDisplayName: string;
}

export async function getUserStatsString({
    prisma,
    channelLogin,
    channelProviderId,
    userProviderId,
    userLogin,
    userDisplayName,
}: GetUserStatsStringParams): Promise<string> {
    const userBalance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
    const userStats = await findOrCreateUserStats(prisma, channelLogin, channelProviderId, userProviderId);

    if (!userStats) {
        const balanceString = `Balance: ${formatSilver(userBalance.value)}`;
        return `@${userDisplayName} has no adventure/duel stats recorded yet! || ${balanceString}`;
    }

    const adventureWinRate = userStats.gamesPlayed > 0 ? Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100) : 0;
    const adventureProfit = userStats.totalWinnings - userStats.totalWagers;
    const duelWinRate = userStats.duelsPlayed > 0 ? Math.round((userStats.duelsWon / userStats.duelsPlayed) * 100) : 0;
    const duelProfit = userStats.duelsWonAmount - userStats.duelsWagered;

    let advStreakInfo = "";
    if (userStats.winStreak > 0) {
        advStreakInfo = `| ${userStats.winStreak}x Win Streak`;
    } else if (userStats.loseStreak > 0) {
        advStreakInfo = `| ${userStats.loseStreak}x Lose Streak`;
    }

    let duelStreakInfo = "";
    if (userStats.duelWinStreak > 0) {
        duelStreakInfo = `| ${userStats.duelWinStreak}x Win Streak`;
    } else if (userStats.duelLoseStreak > 0) {
        duelStreakInfo = `| ${userStats.duelLoseStreak}x Lose Streak`;
    }

    const adventureStatsString = `Adventures: ${userStats.gamesWon}/${userStats.gamesPlayed} wins (${adventureWinRate}%) | Wagered: ${formatSilver(userStats.totalWagers)} | Won: ${formatSilver(userStats.totalWinnings)} | Profit: ${adventureProfit >= 0 ? "+" : ""}${formatSilver(adventureProfit)} ${advStreakInfo}`;
    const duelStatsString = `Duels: ${userStats.duelsWon}/${userStats.duelsPlayed} wins (${duelWinRate}%) | Wagered: ${formatSilver(userStats.duelsWagered)} | Won: ${formatSilver(userStats.duelsWonAmount)} | Profit: ${duelProfit >= 0 ? "+" : ""}${formatSilver(duelProfit)} ${duelStreakInfo}`;
    const balanceString = `Balance: ${formatSilver(userBalance.value)} silver`;

    return `@${userDisplayName} Stats -> ${adventureStatsString} || ${duelStatsString} || ${balanceString}`;
}
