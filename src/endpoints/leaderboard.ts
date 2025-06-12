import { OpenAPIRoute } from "chanfana";
import { type HonoEnv, FossaHeaders } from "@/types";
import { PrismaClient, Prisma } from "@prisma/client"; // Import Prisma namespace for types
import type { Context } from "hono";
import { z } from "zod";
import { LeaderboardResult, handleAdventure, handleDuel, handleFish, handleSilver } from "@/common/leaderboards";

type LeaderboardType = "Adventure" | "Duel" | "Fish" | "Silver"; // Renamed Points to Silver

export class ConsolidatedLeaderboard extends OpenAPIRoute {
    // Updated schema to handle all leaderboard types
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                amount: z.number({ description: "Top/Bottom amount", invalid_type_error: "Amount must be between 1-25" }).min(1).max(25).default(10),
                sortBy: z
                    .string({
                        description: "Sort criteria",
                        invalid_type_error:
                            "Sort by must be [adv-|duel-][wins|played|wagered|profit|streak][-asc|-bottom], fish[-silver|-avg|-fines|-trash|-common|-uncommon|-fine|-rare|-epic|-legendary|-top][-asc|-bottom], or silver[-asc|-bottom].",
                    })
                    .regex(
                        /^(?:(adv|duel)-)?(wins|played|wagered|profit|streak|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top))?|silver)(-(?:asc|bottom))?$/i,
                        "Sort by: [adventure-|duel-][wins|played|wagered|profit|streak][-asc|-bottom], fish[-silver|-avg|-fines|-trash|-common|-uncommon|-fine|-rare|-epic|-legendary|-top][-asc|-bottom], or silver[-asc|-bottom].",
                    )
                    .default("silver"), // Default to silver
            }),
        },
        responses: {},
    };

    handleValidationError(): Response {
        // Concise usage message
        const msg =
            "Usage: !leaderboard [duel-][wins|played|wagered|profit|streak] | fish[-silver|-avg|-fines|-rarity|-top] | silver [-asc|-bottom] [amount] (default: silver, 5)";
        return new Response(msg, { status: 400 });
    }

    async handle(c: Context<HonoEnv>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const { amount, sortBy } = data.params;

        // Parse sortBy to get type, metric, and order
        const sortParts = sortBy
            .toLowerCase()
            .match(
                /^(?:(adv|duel)-)?(wins|played|wagered|profit|streak|fish(?:-(?:silver|avg|fines|trash|common|uncommon|fine|rare|epic|legendary|top))?|silver)(-(?:asc|bottom))?$/i,
            ); // Use updated regex
        if (!sortParts) {
            // This should ideally not happen due to Zod validation, but good practice to keep.
            return c.text("Invalid sort parameter format.", { status: 400 });
        }

        const prefix = sortParts[1]; // 'adventure', 'duel', or undefined
        const metricOrType = sortParts[2]; // e.g., 'wins', 'fish', 'fish-silver', 'fish-legendary', 'silver'
        const orderSuffix = sortParts[3]; // Will be '-asc', '-bottom', or undefined
        const order = orderSuffix && (orderSuffix === "-asc" || orderSuffix === "-bottom") ? "asc" : "desc";

        let leaderboardType: LeaderboardType;
        let internalMetric: string = metricOrType; // Use a separate variable for internal logic if needed

        // Determine Leaderboard Type and adjust metric if needed
        if (["wins", "played", "wagered", "profit", "streak"].includes(metricOrType)) {
            internalMetric = metricOrType;
            if ((prefix === "adv" || !prefix)) {
                leaderboardType = "Adventure";
            } else if (prefix === "duel") {
                leaderboardType = "Duel";
            } else {
                return c.text("Invalid leaderboard type prefix.", { status: 400 });
            }
        } else if (metricOrType.startsWith("fish-")) {
            leaderboardType = "Fish";
            internalMetric = metricOrType.substring(5); // "silver", "fines", "legendary", etc.
        } else if (metricOrType === "fish") {
            leaderboardType = "Fish";
            internalMetric = "count"; // Default fish sorts by count
        } else if (metricOrType === "silver") {
            leaderboardType = "Silver";
            internalMetric = "value"; // Silver is based on balance value
        } else {
            // Should not be reachable due to regex validation
            return c.text("Invalid sort type.", { status: 400 });
        }

        let result: LeaderboardResult | undefined;

        try {
            if (leaderboardType === "Adventure") {
                const adventureMetricSchema = z.enum(["wins", "played", "wagered", "profit", "streak"]);
                const parsedMetric = adventureMetricSchema.safeParse(internalMetric);
                if (!parsedMetric.success) {
                    return c.text("Invalid metric for Adventure leaderboard.", { status: 400 });
                }
                result = await handleAdventure(prisma, channelProviderId, parsedMetric.data, order, amount);
            } else if (leaderboardType === "Duel") {
                const duelMetricSchema = z.enum(["wins", "played", "wagered", "profit", "streak"]);
                const parsedDuelMetric = duelMetricSchema.safeParse(internalMetric);
                if (!parsedDuelMetric.success) {
                    return c.text("Invalid metric for Duel leaderboard.", { status: 400 });
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
                ]);
                const parsedFishMetric = fishMetricSchema.safeParse(internalMetric);
                if (!parsedFishMetric.success) {
                    return c.text("Invalid metric for Fish leaderboard.", { status: 400 });
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
            return c.text("An error occurred while generating the leaderboard.", { status: 500 });
        }

        if (!result) {
            return c.text("Failed to generate leaderboard.", { status: 500 });
        }

        // Construct final response
        const direction = order === "asc" ? "Bottom" : "Top";
        // Use "Fish" as typeDisplay even if sorting by fines or silver value
        const typeDisplay = leaderboardType;
        const metricDisplay = result.metricDisplay.replace(/_/g, " "); // Make metric display friendly

        if (result.formattedLeaderboard.length === 0) {
            return c.text(`No data found for ${typeDisplay} leaderboard sorted by ${metricDisplay}.`);
        }

        return c.text(`${typeDisplay} ${direction} ${amount} by ${metricDisplay}:$(newline)${result.formattedLeaderboard.join(" | ")}`);
    }
}
