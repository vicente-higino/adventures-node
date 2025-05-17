import { OpenAPIRoute } from "chanfana";
import { type Env, FossaHeaders } from "../types";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";
import type { Context } from "hono";
import { z } from "zod";
import { formatSilver } from "../utils/misc";

export class FishLeaderboard extends OpenAPIRoute {
    schema = {
        request: {
            headers: FossaHeaders,
            params: z.object({
                amount: z.number({ description: "Top amount", invalid_type_error: "Amount must be between 1-25" }).min(1).max(25).default(5),
                sortBy: z
                    .string({ description: "Sort by", invalid_type_error: "Sort by can only be fish or silver" })
                    .regex(/(fish|silver)(?!.+)/gim, "Sort by can only be fish or silver"),
            }),
        },
        responses: {},
    };

    handleValidationError(errors: z.ZodIssue[]): Response {
        const msg = "Usage: !fishingleaderboard [amount] [fish|silver]";
        return new Response(msg, { status: 400 });
    }

    async handle(c: Context<Env>) {
        const data = await this.getValidatedData<typeof this.schema>();
        const adapter = new PrismaD1(c.env.DB);
        const prisma = new PrismaClient({ adapter });
        const channelProviderId = data.headers["x-fossabot-channelproviderid"];
        const { amount, sortBy } = data.params;

        const [users, fishData] = await Promise.all([
            prisma.user.findMany({ where: { Fish: { some: { channelProviderId: channelProviderId } } } }),
            prisma.fish.groupBy({
                by: ["userId"],
                where: { channelProviderId: channelProviderId },
                _count: { userId: true },
                _sum: { value: true },
                orderBy:
                    sortBy === "silver"
                        ? {
                              _sum: {
                                  value: "desc", // Order by the sum of value in descending order
                              },
                          }
                        : {
                              _count: {
                                  userId: "desc", // Order by the count of userId in descending order
                              },
                          },
                take: amount,
            }),
        ]);

        const formattedLeaderboard = fishData
            .map(entry => {
                const totalCount = entry._count.userId;
                const totalValue = entry._sum.value ?? 0;
                const user = users.find(u => u.providerId === entry.userId);
                return { name: user?.displayName ?? entry.userId, value: totalValue, count: totalCount };
            })
            .sort((a, b) => {
                const i = sortBy == "fish" ? a.count : a.value;
                const j = sortBy == "fish" ? b.count : b.value;
                return j - i;
            })
            .slice(0, amount)
            .map((entry, i) => `${i + 1}. ${entry.name}: ${entry.count} Fish (${formatSilver(entry.value)} Silver Worth)`);

        return c.text(`Top ${amount}: ${formattedLeaderboard.join(" | ")}`);
    }
}
