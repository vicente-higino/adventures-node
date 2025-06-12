import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { getUserById } from "@/twitch/api"; // Ensure getUserById is imported
import { createUserIdParam } from "@/utils/params"; // Ensure createUserIdParam is imported
import { formatSilver } from "@/utils/misc";
import { findOrCreateBalance } from "@/db"; // Import findOrCreateBalance

export class AdventureStats extends OpenAPIRoute {
    schema = { request: { headers: FossaHeaders, params: z.object({ userId: createUserIdParam() }) }, responses: {} };

    handleValidationError(): Response {
        const msg = "Usage: !stats [username]";
        return new Response(msg, { status: 400 });
    }

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const channel = data.headers["x-fossabot-channellogin"];
        let userProviderId = data.headers["x-fossabot-message-userproviderid"];
        let userlogin = data.headers["x-fossabot-message-userlogin"];
        let userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        if (data.params.userId && data.params.userId !== data.headers["x-fossabot-message-userproviderid"]) {
            const user = await getUserById(prisma, data.params.userId); // Pass prisma
            userProviderId = user?.id ?? data.headers["x-fossabot-message-userproviderid"];
            userDisplayName = user?.displayName ?? data.headers["x-fossabot-message-userdisplayname"];
            userlogin = user?.login ?? data.headers["x-fossabot-message-userlogin"];
        }

        const userStats = await prisma.userStats.findUnique({ where: { channelProviderId_userId: { channelProviderId, userId: userProviderId } } });
        const userBalance = await findOrCreateBalance(prisma, channel, channelProviderId, userProviderId, userlogin, userDisplayName); // Fetch balance

        if (!userStats) {
            // Use findOrCreateUserStats logic from the previous step or handle appropriately
            // For now, assuming if general stats don't exist, duel stats won't either.
            // A more robust approach might use findOrCreateUserStats here as well.
            // Even if stats don't exist, balance might. Show balance if available.
            const balanceString = `Balance: ${formatSilver(userBalance.value)}`;
            return c.text(`@${userDisplayName} has no adventure/duel stats recorded yet! || ${balanceString}`);
        }

        // Adventure Stats Calculation
        const adventureWinRate = userStats.gamesPlayed > 0 ? Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100) : 0;
        const adventureProfit = userStats.totalWinnings - userStats.totalWagers;
        const duelWinRate = userStats.duelsPlayed > 0 ? Math.round((userStats.duelsWon / userStats.duelsPlayed) * 100) : 0;
        const duelProfit = userStats.duelsWonAmount - userStats.duelsWagered; // This might be negative if losses > wins

        // Streak info
        let advStreakInfo = "";
        if (userStats.winStreak > 0) {
            advStreakInfo = `| ${userStats.winStreak}x Win Streak`;
        } else if (userStats.loseStreak > 0) {
            advStreakInfo = `| ${userStats.loseStreak}x Lose Streak`;
        }

        // Duel streak info
        let duelStreakInfo = "";
        if (userStats.duelWinStreak > 0) {
            duelStreakInfo = `| ${userStats.duelWinStreak}x Win Streak`;
        } else if (userStats.duelLoseStreak > 0) {
            duelStreakInfo = `| ${userStats.duelLoseStreak}x Lose Streak`;
        }

        // Construct the response string
        const adventureStatsString = `Adventures: ${userStats.gamesWon}/${userStats.gamesPlayed} wins (${adventureWinRate}%) | Wagered: ${formatSilver(userStats.totalWagers)} | Won: ${formatSilver(userStats.totalWinnings)} | Profit: ${adventureProfit >= 0 ? "+" : ""}${formatSilver(adventureProfit)} ${advStreakInfo}`;
        const duelStatsString = `Duels: ${userStats.duelsWon}/${userStats.duelsPlayed} wins (${duelWinRate}%) | Wagered: ${formatSilver(userStats.duelsWagered)} | Won: ${formatSilver(userStats.duelsWonAmount)} | Profit: ${duelProfit >= 0 ? "+" : ""}${formatSilver(duelProfit)} ${duelStreakInfo}`; // Using calculated profit

        const balanceString = `Balance: ${formatSilver(userBalance.value)} silver`; // Use fetched balance

        return c.text(`@${userDisplayName} Stats -> ${adventureStatsString} || ${duelStatsString} || ${balanceString}`);
    }
}
