import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { increaseBalanceWithChannelID } from "@/db";
import { pickRandom } from "@/utils/misc";
import { createUserIdParam } from "@/utils/params";
import { getUserById } from "@/twitch/api"; // Import getUserById
import { DUEL_DENY_EMOTES } from "@/emotes"; // Add import for duel deny emotes

export class DuelCancel extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                // Make challengedId optional
                challengedId: createUserIdParam("User id of the other player").optional(),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        // Combined usage for cancelling or denying
        const msg = "Usage: !cancelduel [username] OR !deny [username]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        // Ensure Context uses Env
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const currentUserId = data.headers["x-fossabot-message-userproviderid"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        // Destructure optional challengedId
        const { challengedId } = data.params;

        let duel;
        let otherUserName: string | null = null;

        if (challengedId) {
            // Logic for cancelling/denying a specific duel
            if (challengedId === currentUserId) {
                return c.text(`@${userDisplayName}, you can't duel with yourself.`);
            }
            duel = await prisma.duel.findFirst({
                where: {
                    channelProviderId,
                    status: "Pending", // Only find pending duels
                    OR: [
                        { challengerId: currentUserId, challengedId },
                        { challengerId: challengedId, challengedId: currentUserId },
                    ],
                },
                include: { challenged: true, challenger: true },
            });
            if (!duel) {
                // Try to get the display name for the error message
                const otherUserInfo = await getUserById(c, prisma, challengedId);
                otherUserName = otherUserInfo?.displayName ?? challengedId;
                return c.text(`@${userDisplayName}, there is no pending duel between you and ${otherUserName}.`, { status: 404 });
            }
        } else {
            // Logic for cancelling/denying the oldest pending duel involving the current user
            duel = await prisma.duel.findFirst({
                where: { channelProviderId, status: "Pending", OR: [{ challengerId: currentUserId }, { challengedId: currentUserId }] },
                orderBy: {
                    createdAt: "asc", // Get the oldest one
                },
                include: { challenged: true, challenger: true },
            });

            if (!duel) {
                return c.text(`@${userDisplayName}, you have no pending duels to cancel or deny.`, { status: 404 });
            }
        }

        // Common logic starts here, using the found 'duel' object

        // This check might be redundant due to the 'status: "Pending"' filter in the queries, but keep for safety
        if (duel.status !== "Pending") {
            return c.text(`@${userDisplayName}, this duel is no longer pending.`, { status: 400 });
        }

        // Create an array to hold background tasks
        const backgroundTasks: Promise<any>[] = [];

        // Refund the wager to the challenger
        backgroundTasks.push(increaseBalanceWithChannelID(prisma, channelProviderId, duel.challengerId, duel.wagerAmount));

        // Delete the duel
        backgroundTasks.push(
            prisma.duel.delete({
                where: {
                    // Use the unique identifier from the found duel
                    channelProviderId_challengerId_challengedId: {
                        channelProviderId: duel.channelProviderId,
                        challengerId: duel.challengerId,
                        challengedId: duel.challengedId,
                    },
                },
            }),
        );

        // Execute tasks in the background
        await Promise.all(backgroundTasks);

        // Determine the other user's display name for the response message
        const otherUser = currentUserId === duel.challengerId ? duel.challenged : duel.challenger;
        otherUserName = otherUser.displayName; // Use the display name from the included relation

        // Return response immediately
        if (currentUserId === duel.challengerId) {
            // User cancelled a duel they initiated
            return c.text(
                `${userDisplayName} cancelled their duel challenge to ${otherUserName}!`,
            );
        } else {
            // User denied a duel they were challenged to
            return c.text(
                `${userDisplayName} declined the duel challenge from ${otherUserName}! ${pickRandom(DUEL_DENY_EMOTES)}`,
            );
        }
    }
}
