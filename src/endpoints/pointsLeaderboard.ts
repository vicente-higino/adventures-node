import { OpenAPIRoute } from "chanfana";
import { type Env, FossaHeaders } from "../types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import type { Context } from "hono";
import { z } from "zod";
import { formatSilver } from "utils/misc";

export class PointLeaderboard extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                amount: z.number({ description: "Top amount", invalid_type_error: "Amount must be between 1-25" }).min(1).max(25).default(10),
                sortBy: z
                    .string({ description: "Sort by", invalid_type_error: "Sort by can only be asc or desc" })
                    .regex(/^(asc|desc|top|bottom)(?!.+)/gim, "Sort by can only be asc|desc|top|bottom")
                    .toLowerCase(),
            }),
        },
        responses: {},
    };

    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !silverleaderboard [amount] [top|bottom]";
        return new Response(msg, { status: 400 });
    }

    async handle(c: Context<Env>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const adapter = new PrismaD1(c.env.DB);
        const prisma = new PrismaClient({ adapter });
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        let { amount, sortBy } = data.params;
        if (sortBy == "top") sortBy = "desc";
        if (sortBy == "bottom") sortBy = "asc";
        const balances = await prisma.balance.findMany({ where: { channelProviderId: channelProviderId }, include: { user: true } });
        const formattedLeaderboard = balances
            .map(entry => {
                const totalValue = entry.value;
                return { name: entry.user.displayName, value: totalValue };
            })
            .sort((a, b) => {
                return sortBy == "asc" ? a.value - b.value : b.value - a.value;
            })
            .slice(0, amount)
            .map((entry, i) => `${sortBy == "desc" ? i + 1 : balances.length - i}. ${entry.name}: ${formatSilver(entry.value)} Silver`);

        return c.text(`${sortBy == "desc" ? "Top" : "Bottom"} ${amount}: ${formattedLeaderboard.join(" | ")}`);
    }
}
