import { Context } from "hono";
import { FossaHeaders, HonoEnv } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { getUserById } from "@/twitch/api"; // Ensure getUserById is imported
import { findOrCreateBalance, increaseBalance } from "@/db"; // Ensure db functions are imported
import { calculateAmount } from "@/utils/misc"; // Import calculateAmount
import { createUserIdParam } from "@/utils/params";

export class PointGive extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                // Update giveAmount validation
                giveAmount: z
                    .string({ description: "Silver amount to give ('all', number, or percentage)", required_error: "Silver amount is required" })
                    .regex(/^(all|\d+(\.\d+)?%|\d+(\.\d+)?[kmb]?|\d+)$/i, {
                        message: "Amount must be a positive whole number, K/M/B (e.g., 5k), percentage (e.g., 50%), or 'all'",
                    }),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        // Update usage message to be more specific about format
        const msg = "Usage: !givesilver [username] [silver|K/M/B|%|all]";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<HonoEnv>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.headers["x-fossabot-message-userproviderid"];
        const userlogin = data.headers["x-fossabot-message-userlogin"];
        const userDisplayName = data.headers["x-fossabot-message-userdisplayname"];
        // giveAmountStr now comes directly from the validated string parameter
        const giveAmountStr = data.params.giveAmount;
        const toUserProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];
        const toUser = await getUserById(prisma, toUserProviderId); // Pass prisma
        if (!toUser) {
            return c.text("user not found", { status: 404 });
        }
        const toUserDisplayName = toUser.displayName;
        const toUserLogin = toUser.login;
        if (userProviderId === toUserProviderId) {
            return c.text(`@${userDisplayName}, Usage: !givesilver <username> <amount|%|all>`);
        }
        const fromBalance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userlogin, userDisplayName);

        // Check if the sender has any silver *before* calculating the amount
        if (fromBalance.value <= 0) {
            return c.text(`@${userDisplayName}, you have no silver to give.`);
        }

        const toBalance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, toUserProviderId, toUserLogin, toUserDisplayName);

        // Use calculateAmount with the validated string
        const giveAmount = calculateAmount(giveAmountStr, fromBalance.value);

        // Check if the calculated amount is valid (greater than 0)
        if (giveAmount <= 0) {
            // This handles cases where 'all' results in 0, or invalid input defaults to 1 but user has < 1
            return c.text(`@${userDisplayName}, minimum amount to give is 1 silver.`);
        }

        // Proceed with the transfer
        const newBalance = await increaseBalance(prisma, fromBalance.id, -giveAmount);
        const newToBalance = await increaseBalance(prisma, toBalance.id, giveAmount);

        // Use formatSilver for consistent output if desired, otherwise keep as is
        const formattedGiveAmount = giveAmount; // Or formatSilver(giveAmount)
        const formattedNewBalance = newBalance.value; // Or formatSilver(newBalance.value)

        if (newBalance.value === 0 && giveAmountStr.toLowerCase() === "all") {
            return c.text(`@${userDisplayName}, you gave all your silver (${formattedGiveAmount}) to @${toUserDisplayName}.`);
        }
        return c.text(
            `@${userDisplayName}, you gave ${formattedGiveAmount} silver to @${toUserDisplayName}. You have ${formattedNewBalance} silver left.`,
        );
    }
}
