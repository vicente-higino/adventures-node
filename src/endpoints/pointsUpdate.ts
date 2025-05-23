import { Context } from "hono";
import { FossaHeaders, Env } from "@/types"; // Import Env
import { z } from "zod";
import { OpenAPIRoute } from "chanfana";
import { getUserById } from "@/twitch/api"; // Ensure getUserById is imported
import { findOrCreateBalance } from "@/db"; // Ensure findOrCreateBalance is imported
import { createUserIdParam } from "@/utils/params"; // Ensure createUserIdParam is imported

export class PointUpdate extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                newBalance: z
                    .number({ description: "New balance", invalid_type_error: "New balance must be a number" })
                    .min(0, "Value must be positive")
                    .default(500),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !updatesilver <username> <new_balance>";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<Env>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];
        const user = await getUserById(c, prisma, userProviderId); // Pass prisma
        if (!user) {
            return c.text("user not found", { status: 404 });
        }
        const userDisplayName = user.displayName;
        const userLogin = user.login;

        const balance = await findOrCreateBalance(
            prisma,
            channelLogin,
            channelProviderId,
            userProviderId,
            userLogin,
            userDisplayName,
            data.params.newBalance,
        );
        const newBalance = await prisma.balance.update({
            where: { userId: userProviderId, channel: channelLogin, id: balance.id },
            data: { value: data.params.newBalance },
        });

        return c.text(`Updated @${userDisplayName} silver to ${newBalance.value}.`);
    }
}
