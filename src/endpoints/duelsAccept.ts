import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
// Import findOrCreateUserStats
import { findOrCreateBalance, increaseBalanceWithChannelID, updateUseDuelsStats } from "@/db";
import { pickRandom } from "@/utils/misc";
import { createUserIdParam } from "@/utils/params";
// Add import for duel win emotes
import { DUEL_WIN_EMOTES } from "@/emotes";
import { getUserById } from "@/twitch/api";

export class DuelAccept extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                // Make challengerId optional
                challengerId: createUserIdParam("Challenger user id").optional(),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !accept [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        // Ensure Context uses Env
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const challengedId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        // Destructure optional challengerId
        const { challengerId } = data.params;

        let duel;

        if (challengerId) {
            // Logic for accepting a specific duel
            if (challengerId == challengedId) {
                return c.text(`@${userDisplayName}, you can't duel yourself.`);
            }
            duel = await prisma.duel.findUnique({
                where: { channelProviderId_challengerId_challengedId: { channelProviderId, challengerId, challengedId } },
                include: { challenger: true },
            });

            if (!duel) {
                // Use challenger's display name if possible, otherwise ID
                const challengerInfo = await getUserById(prisma, challengerId);
                const challengerName = challengerInfo?.displayName ?? challengerId;
                return c.text(`${userDisplayName}, you have no pending duels from ${challengerName}.`, { status: 404 });
            }
        } else {
            // Logic for accepting any pending duel (find the oldest one)
            duel = await prisma.duel.findFirst({
                where: { channelProviderId, challengedId, status: "Pending" },
                orderBy: {
                    createdAt: "asc", // Get the oldest pending duel
                },
                include: { challenger: true },
            });

            if (!duel) {
                return c.text(`${userDisplayName}, you have no pending duels to accept.`, { status: 404 });
            }
            // If a duel is found, we now know the challengerId for the rest of the logic
            // No need to reassign challengerId variable, just use duel.challengerId
        }

        // Common logic starts here, using the found 'duel' object

        if (duel.status !== "Pending") {
            // This case might be less likely now with the findFirst filtering by Pending, but keep for safety
            return c.text(`${userDisplayName}, this duel is no longer pending.`, { status: 400 });
        }

        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, challengedId, userlogin, userDisplayName);
        if (duel.wagerAmount > balance.value) {
            return c.text(
                `${userDisplayName}, you don't have enough silver (${balance.value}) to accept the ${duel.wagerAmount} silver duel from ${duel.challenger.displayName}.`,
            );
        }
        const isChallengerWinner = Math.random() < 0.5;
        // Use duel.challengerId and duel.challengedId consistently
        const winnerId = isChallengerWinner ? duel.challengerId : duel.challengedId;
        const loserId = isChallengerWinner ? duel.challengedId : duel.challengerId;
        const winnerDisplayName = isChallengerWinner ? duel.challenger.displayName : userDisplayName;

        // Create an array to hold background tasks
        const backgroundTasks: Promise<any>[] = [];

        // Update balances
        if (isChallengerWinner) {
            backgroundTasks.push(increaseBalanceWithChannelID(prisma, channelProviderId, loserId, -duel.wagerAmount));
            // Challenger gets their wager back + challenged's wager. The initial wager was already deducted on creation.
            // So, we give them wagerAmount (from challenged) + wagerAmount (their original wager back) = wagerAmount * 2
            backgroundTasks.push(increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, duel.wagerAmount * 2));
        } else {
            // Challenged (acceptor) wins. Their balance wasn't touched yet.
            // Challenger lost their wager (deducted on creation).
            // We just need to give the winner (challenged) the challenger's wager amount.
            backgroundTasks.push(increaseBalanceWithChannelID(prisma, channelProviderId, winnerId, duel.wagerAmount));
        }

        // Update stats
        backgroundTasks.push(
            updateUseDuelsStats(prisma, channelLogin, channelProviderId, winnerId, {
                didWin: true,
                wagerAmount: duel.wagerAmount,
                winAmount: duel.wagerAmount * 2, // Winner always gains the wager amount
            }),
        );
        backgroundTasks.push(
            updateUseDuelsStats(prisma, channelLogin, channelProviderId, loserId, {
                didWin: false,
                wagerAmount: duel.wagerAmount,
                winAmount: 0, // Loser gains 0, loses wagerAmount (already deducted or handled above)
            }),
        );

        // Delete the duel using the specific IDs from the found duel object
        backgroundTasks.push(
            prisma.duel.delete({
                where: {
                    channelProviderId_challengerId_challengedId: {
                        channelProviderId,
                        challengerId: duel.challengerId, // Use ID from the found duel
                        challengedId: duel.challengedId, // Use ID from the found duel
                    },
                },
            }),
        );

        // Execute tasks in the background
        await Promise.all(backgroundTasks);

        // Return response immediately
        return c.text(
            `${winnerDisplayName} won the duel against ${isChallengerWinner ? userDisplayName : duel.challenger.displayName} and claimed ${duel.wagerAmount} silver! ${pickRandom(DUEL_WIN_EMOTES)}`,
        );
    }
}
