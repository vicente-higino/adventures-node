import { Context } from "hono";
import { PrismaClient } from "@prisma/client";
import { FossaHeaders } from "types";
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getUserById } from "twitch/api";
import { findOrCreateBalance, increaseBalanceWithChannelID } from "db";
// Import calculateAmount
import { pickRandom, calculateAmount } from "utils/misc";
import { Env } from "types"; // Import Env if not already present
import { createUserIdParam } from "utils/params";
// Add import for duel create emotes
import { DUEL_CREATE_EMOTES } from "../emotes";

export class DuelCreate extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                challengedId: z.string({ description: "ChallengedId must be a number" }).refine(s => {
                    const n = parseInt(s);
                    return !isNaN(n);
                }),
                // Update wagerAmount to accept string matching the pattern
                wagerAmount: z
                    .string({
                        description: "Silver amount (number, percentage, K/M/B, or 'all')",
                        invalid_type_error: "Wager amount must be a number, percentage (e.g., 50%), K/M/B (e.g., 5k), or 'all'",
                        required_error: "Wager amount is required",
                    })
                    // Updated regex to allow K/M/B suffixes (case-insensitive)
                    .regex(/^(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)$/i, {
                        message: "Wager must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), or 'all'",
                    }),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !duel username [silver|K/M/B|%|all]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<Env>) {
        // Ensure Context uses Env
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const challengerId = data.headers["x-fossabot-message-userproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        // wagerAmount is now a string
        const { challengedId, wagerAmount: wagerAmountStr } = data.params;

        if (!challengedId) {
            return c.text("Missing username. Try !duel username silver", { status: 400 });
        }

        const challenged = await getUserById(c, prisma, challengedId); // Pass prisma
        if (!challenged) {
            return c.text("user not found", { status: 404 });
        }
        if (challengerId == challengedId) {
            return c.text(`@${userDisplayName}, you can't duel yourself.`);
        }

        // Check if the current user already challenged the target
        const existingDuel = await prisma.duel.findUnique({
            where: { channelProviderId_challengerId_challengedId: { channelProviderId, challengerId, challengedId } },
            include: { challenger: true, challenged: true },
        });
        if (existingDuel) {
            return c.text(
                `@${userDisplayName}, this duel already exists with a ${existingDuel.wagerAmount} silver bet. 
                use "!cancelduel ${challenged.displayName}" to cancel this duel.
                @${existingDuel.challenged.displayName} you can use "!accept|deny ${userDisplayName}".`,
                { status: 400 },
            );
        }

        // Check if the target user already challenged the current user
        const reverseDuel = await prisma.duel.findUnique({
            where: {
                channelProviderId_challengerId_challengedId: {
                    channelProviderId,
                    challengerId: challengedId, // Swapped
                    challengedId: challengerId, // Swapped
                },
            },
            include: {
                challenger: true, // The user who was originally challenged
                challenged: true, // The user who originally challenged
            },
        });

        if (reverseDuel) {
            return c.text(
                `@${userDisplayName}, ${challenged.displayName} has already challenged you for a duel with a ${reverseDuel.wagerAmount} silver bet! 
                You can use "!accept|deny ${challenged.displayName}" to respond.`,
                { status: 400 },
            );
        }

        // Fetch challenger's balance *before* calculating the amount
        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, challengerId, userlogin, userDisplayName);

        // Calculate the actual wager amount using the utility function
        const actualWagerAmount = calculateAmount(wagerAmountStr, balance.value);

        // Validate the calculated wager amount
        if (actualWagerAmount < 1) {
            return c.text(`@${userDisplayName}, the minimum wager amount is 1 silver.`);
        }
        if (actualWagerAmount > balance.value) {
            return c.text(`@${userDisplayName}, you don't have enough silver (${balance.value}) to wager ${actualWagerAmount}.`);
        }

        // Create an array to hold background tasks
        const backgroundTasks: Promise<any>[] = [];

        // Deduct actual wager from challenger's balance
        backgroundTasks.push(increaseBalanceWithChannelID(prisma, channelProviderId, challengerId, -actualWagerAmount));

        // Create the duel entry using the actual wager amount
        backgroundTasks.push(
            prisma.duel.create({
                // Use actualWagerAmount here
                data: { channelProviderId, channel: channelLogin, challengerId, challengedId, wagerAmount: actualWagerAmount, status: "Pending" },
                // No need to include relations if we don't use the result immediately
                // include: {
                //     challenger: true,
                //     challenged: true,
                // },
            }),
        );

        // Execute tasks in the background
        await Promise.all(backgroundTasks);

        // Return response immediately, using the actual wager amount
        return c.text(
            `@${userDisplayName} challenged ${challenged.displayName} for a duel with a ${actualWagerAmount} silver bet!
            use "!cancelduel ${challenged.displayName}" to get your silver back.
             @${challenged.displayName} you can use "!accept|deny ${userDisplayName}".
             ${pickRandom(DUEL_CREATE_EMOTES)}`,
        );
    }
}
