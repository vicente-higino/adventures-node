import { createBotCommand } from "../BotCommandWithKeywords";
import { prisma } from "@/prisma";
import { getLeaderboard, leaderboardSchema } from "@/common/leaderboardHandler";
import { getBotConfig } from "..";

export const leaderboardCommand = createBotCommand(
    "leaderboard",
    async (params, ctx) => {
        const { broadcasterId, say } = ctx;
        const sortBy = params[0] || "silver";
        const amount = parseInt(params[1], 10) || 5;

        const validation = leaderboardSchema.safeParse({ sortBy, amount });
        if (!validation.success) {
            say(
                `${getBotConfig().prefix}leaderboard [duel-][wins|played|wagered|profit|streak] | fish[-silver|-avg|-fines|-rarity|-top|-treasure] | silver [-asc|-bottom] [amount] (default: silver, 5)`,
            );
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
