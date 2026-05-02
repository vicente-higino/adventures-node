import { createBotCommand } from "../botCommandWithKeywords";
import { prisma } from "@/prisma";
import { getLeaderboard, leaderboardCommandSyntax, leaderboardSchema } from "@/common/leaderboardHandler";
import { getBotPrefix } from "..";

export const leaderboardCommand = createBotCommand(
    "leaderboard",
    async (params, ctx) => {
        const { broadcasterId, say } = ctx;
        const sortBy = params[0] || "silver";
        const amount = parseInt(params[1], 10) || 5;

        const validation = leaderboardSchema.safeParse({ sortBy, amount });
        if (!validation.success) {
            say(leaderboardCommandSyntax(getBotPrefix()));
            return;
        }

        const result = await getLeaderboard(prisma, broadcasterId, validation.data);

        if (typeof result === "string") {
            say(result);
            return;
        }

        if (result.formattedLeaderboard.length === 0) {
            say("No data found for leaderboard.");
            return;
        }

        const direction = result.order === "asc" ? "Bottom" : "Top";
        say(`${result.leaderboardType} ${direction} ${amount} by ${result.metricDisplay.replace(/_/g, " ")}:`);
        say(result.formattedLeaderboard.join(" | "));
    },
    { aliases: ["lb"] },
);
