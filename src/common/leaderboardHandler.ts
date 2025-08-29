import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { LeaderboardResult, LeaderboardType, handleAdventure, handleDuel, handleFish, handleSilver } from "@/common/leaderboards";

export const leaderboardSchema = z.object({
    amount: z.number().min(1).max(25).default(5),
    sortBy: z
        .string()
        .regex(
            /^(?:(adv|duel)-)?(wins|played|wagered|profit|streak|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top|treasure))?|silver)(-(?:asc|bottom))?$/i,
        )
        .default("silver"),
});

export async function getLeaderboard(
    prisma: PrismaClient,
    channelProviderId: string,
    params: z.infer<typeof leaderboardSchema>,
): Promise<LeaderboardResult & {
    order: "asc" | "desc";

} | string> {
    const { amount, sortBy } = params;

    const sortParts = sortBy
        .toLowerCase()
        .match(
            /^(?:(adv|duel)-)?(wins|played|wagered|profit|streak|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top|treasure))?|silver)(-(?:asc|bottom))?$/i,
        );

    if (!sortParts) {
        return "Invalid sort parameter format.";
    }

    const prefix = sortParts[1];
    const metricOrType = sortParts[2];
    const orderSuffix = sortParts[3];
    const order = orderSuffix && (orderSuffix === "-asc" || orderSuffix === "-bottom") ? "asc" : "desc";

    let leaderboardType: LeaderboardType;
    let internalMetric = metricOrType;

    if (["wins", "played", "wagered", "profit", "streak"].includes(metricOrType)) {
        internalMetric = metricOrType;
        leaderboardType = prefix === "duel" ? "Duel" : "Adventure";
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
        return "Invalid sort type.";
    }

    let result: LeaderboardResult | undefined;

    try {
        if (leaderboardType === "Adventure") {
            const adventureMetricSchema = z.enum(["wins", "played", "wagered", "profit", "streak"]);
            const parsedMetric = adventureMetricSchema.safeParse(internalMetric);
            if (!parsedMetric.success) {
                return "Invalid metric for Adventure leaderboard.";
            }
            result = await handleAdventure(prisma, channelProviderId, parsedMetric.data, order, amount);
        } else if (leaderboardType === "Duel") {
            const duelMetricSchema = z.enum(["wins", "played", "wagered", "profit", "streak"]);
            const parsedDuelMetric = duelMetricSchema.safeParse(internalMetric);
            if (!parsedDuelMetric.success) {
                return "Invalid metric for Duel leaderboard.";
            }
            result = await handleDuel(prisma, channelProviderId, parsedDuelMetric.data, order, amount);
        } else if (leaderboardType === "Fish") {
            const fishMetricSchema = z.enum([
                "count",
                "silver",
                "fines",
                "avg",
                "trash",
                "common",
                "uncommon",
                "fine",
                "rare",
                "epic",
                "legendary",
                "top",
                "treasure",
            ]);
            const parsedFishMetric = fishMetricSchema.safeParse(internalMetric);
            if (!parsedFishMetric.success) {
                return "Invalid metric for Fish leaderboard.";
            }
            result = await handleFish(prisma, channelProviderId, parsedFishMetric.data, order, amount);
        } else if (leaderboardType === "Silver") {
            result = await handleSilver(prisma, channelProviderId, order, amount);
        }
    } catch (error) {
        console.error("Leaderboard generation error:", error);
        // Check if error is a Prisma error and provide more details if needed
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error("Prisma Error Code:", error.code);
            console.error("Prisma Error Meta:", error.meta);
        }
        return "An error occurred while generating the leaderboard.";
    }

    if (!result) {
        return "Failed to generate leaderboard.";
    }

    return { ...result, order };
}
