import { LeaderboardResult, LeaderboardType, handleAdventure, handleDuel, handleFish, handleSilver } from "@/common/leaderboards";
import logger from "@/logger";
import { dbClient } from "@/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handleRPS } from "./leaderboards/rpsLeaderboard";

const paramsRegex =
    /^(?:(adv|duel|rps)-)?(wins|played|wagered|profit|streak|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|exotic|mythic|legendary|top|treasure))?|silver)(-(?:asc|bottom))?$/i;

export const leaderboardCommandSyntax = (prefix: string = "!") =>
    `Usage: ${prefix}leaderboard [duel-|rps-][wins|played|wagered|profit|streak] | fish[-silver|-avg|-fines|-rarity|-top|-treasure] | silver [-asc|-bottom] [amount] (default: silver, 5)`;

export const leaderboardSchema = z.object({ amount: z.number().min(1).max(25).default(5), sortBy: z.string().regex(paramsRegex).default("silver") });

export async function getLeaderboard(
    prisma: dbClient,
    channelProviderId: string,
    params: z.infer<typeof leaderboardSchema>,
): Promise<LeaderboardResult> {
    const { amount, sortBy } = params;

    const sortParts = sortBy.toLowerCase().match(paramsRegex);

    if (!sortParts) {
        return {
            error: true,
            reason: "Invalid sort type.",
        };
    }

    const prefix = sortParts[1];
    const metricOrType = sortParts[2];
    const orderSuffix = sortParts[3];
    const order = orderSuffix && (orderSuffix === "-asc" || orderSuffix === "-bottom") ? "asc" : "desc";

    let leaderboardType: LeaderboardType;
    let internalMetric = metricOrType;

    if (["wins", "played", "wagered", "profit", "streak"].includes(metricOrType)) {
        internalMetric = metricOrType;
        switch (prefix) {
            case "duel":
                leaderboardType = "Duel";
                break;
            case "rps":
                leaderboardType = "RPS";
                break;
            default:
                leaderboardType = "Adventure";
                break;
        }
    } else if (metricOrType.startsWith("fish-")) {
        leaderboardType = "Fish";
        internalMetric = metricOrType.substring(5);
    } else if (metricOrType === "fish") {
        leaderboardType = "Fish";
        internalMetric = "count";
    } else if (metricOrType === "silver") {
        leaderboardType = "Silver";
        internalMetric = "value";
    } else {
        return {
            error: true,
            reason: "Invalid sort type.",
        };
    }

    let result: LeaderboardResult | undefined;

    try {
        if (leaderboardType === "Adventure") {
            result = await handleAdventure(prisma, channelProviderId, internalMetric, order, amount);
        } else if (leaderboardType === "Duel") {
            result = await handleDuel(prisma, channelProviderId, internalMetric, order, amount);
        } else if (leaderboardType === "RPS") {
            result = await handleRPS(prisma, channelProviderId, internalMetric, order, amount);
        } else if (leaderboardType === "Fish") {
            result = await handleFish(prisma, channelProviderId, internalMetric, order, amount);
        } else if (leaderboardType === "Silver") {
            result = await handleSilver(prisma, channelProviderId, order, amount);
        }
        if (result && result.error) return result;
    } catch (error) {
        logger.error(error, "Leaderboard generation error");
        // Check if error is a Prisma error and provide more details if needed
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Prisma Error Code: " + error.code);
            logger.error(error, "Prisma Error Meta: " + error.meta);
        }
        return {
            error: true,
            reason: "An error occurred while generating the leaderboard.",
        };
    }

    if (!result) {
        return {
            error: true,
            reason: "Failed to generate leaderboard.",
        };
    }

    return { ...result, order };
}
