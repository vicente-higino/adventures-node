import { Bool, Num, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { Env, FossaHeaders } from "@/types";
import { Context } from "hono";
import { getUserById } from "@/twitch/api";
import { findOrCreateBalance } from "@/db";
import { createUserIdParam } from "@/utils/params";

export class PointAdd extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                userId: createUserIdParam(),
                add: z.number({ description: "Added amount", invalid_type_error: "Added amount must be a number" }).default(1),
            }),
        },
        responses: {},
    };
    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !addsilver <username> <amount>";
        return new Response(msg, { status: 400 });
    }
    async handle(c: Context<Env>) {
        // Get validated data
        const data = await this.getValidatedData<typeof this.schema>();
        const prisma = c.get("prisma");
        const channelLogin = data.headers["x-fossabot-channellogin"];
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const userProviderId = data.params.userId ?? data.headers["x-fossabot-message-userproviderid"];
        const user = await getUserById(c, prisma, userProviderId);
        if (!user) {
            return c.text("user not found", { status: 404 });
        }
        const userDisplayName = user.displayName;
        const userLogin = user.login;

        const balance = await findOrCreateBalance(prisma, channelLogin, channelProviderId, userProviderId, userLogin, userDisplayName);
        const isBalanceNegative = balance.value + data.params.add < 0;
        const newBalance = await prisma.balance.update({
            where: { userId: userProviderId, channel: channelLogin, id: balance.id },
            data: { value: { increment: isBalanceNegative ? -balance.value : data.params.add } },
        });

        return c.text(`Updated @${userDisplayName} silver to ${newBalance.value}.`);
    }
}
