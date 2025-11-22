import { OpenAPIRoute } from "chanfana";
import { type HonoEnv } from "../types";
import type { Context } from "hono";
import { prisma } from "@/prisma";
import z from "zod";
import { getUserById } from "@/twitch/api";

export class emotesRank extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({
                userId: z.string().refine(c => !isNaN(parseInt(c)))
            }),
            query: z.object({
                excludeUserIds: z.string().refine(c => !isNaN(parseInt(c))).optional(),
                page: z.coerce.number().optional(),
                perPage: z.coerce.number().optional()
            })
        }, responses: {}
    };

    async handle(c: Context<HonoEnv>) {
        // Read and sanitize query params
        const data = await this.getValidatedData<typeof this.schema>();
        const rawChannel = data.params.userId;
        const rawExcludes = data.query.excludeUserIds ?? "";
        const rawPage = data.query.page ?? 1;
        const rawPerPage = data.query.perPage ?? 10;

        const sanitizeId = z.string().safeParse(rawChannel);
        if (!sanitizeId.success) {
            return c.json({ message: "Error parsing userId" }, 400);
        }
        const channelProviderId = sanitizeId.data;
        const user = await getUserById(prisma, channelProviderId);
        if (!user) {
            return c.json({ message: "User not found" }, 404);
        }
        const excludeUserIds = rawExcludes
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        // Parse pagination params
        const page = Math.max(1, Number.isFinite(+rawPage) ? Math.max(1, rawPage) : 1);
        const perPageRaw = Number.isFinite(+rawPerPage) ? Math.max(1, rawPerPage) : 50;
        const perPage = Math.min(perPageRaw, 1000); // cap perPage to 1000
        const skip = (page - 1) * perPage;
        const take = perPage;

        // Get total distinct emotes for pagination
        const totalQuery = await prisma.$queryRaw<[{ count: BigInt }]>`
            SELECT COUNT(DISTINCT "emoteName") as count
            FROM "EmoteUsageEventV2"
            WHERE "channelProviderId" = ${channelProviderId}`;
        const total = Number(totalQuery[0].count);
        // Query the aggregated emote usage with pagination
        const emotes = await prisma.emoteUsageEventV2.groupBy({
            by: ["emoteName"],
            _count: { emoteName: true },
            _max: { provider: true, emoteId: true },
            where: { channelProviderId: channelProviderId, userId: { notIn: excludeUserIds } },
            orderBy: { _count: { emoteName: "desc" } },
            skip,
            take
        });

        // Normalize types and return JSON
        const result = emotes.map((r, i) => ({
            emoteName: r.emoteName,
            emoteId: r._max.emoteId,
            usage_count: r._count.emoteName,
            provider: r._max.provider,
            rank: skip + i + 1,
        }));

        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return c.json({
            data: result,
            meta: {
                page,
                perPage,
                total,
                totalPages,
                channelId: user.id,
                channelName: user.login,
                channelDisplayName: user.displayName
            }
        });
    }
}
