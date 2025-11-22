import { OpenAPIRoute } from "chanfana";
import { type HonoEnv } from "../types";
import type { Context } from "hono";
import { prisma } from "@/prisma";

export class emotesRank extends OpenAPIRoute {
    schema = {
        request: {
        }, responses: {}
    };
    async handle(c: Context<HonoEnv>) {
        // Read and sanitize query params
        const url = new URL(c.req.url);
        const rawChannel = url.searchParams.get("channelId") ?? "83402203";
        const rawExcludes = url.searchParams.get("excludeUserIds") ?? "237719657,1313280375";

        const sanitizeId = (s: string) => s.replace(/\D/g, "");
        const channelProviderId = sanitizeId(rawChannel) || "83402203";

        const excludeUserIds = rawExcludes
            .split(",")
            .map(s => s.trim())
            .map(sanitizeId)
            .filter(Boolean);


        // Query the aggregated emote usage
        const emotes = await prisma.emoteUsageEventV2.groupBy({
            by: ["emoteName"],
            _count: { emoteName: true },
            _max: { provider: true, emoteId: true },
            where: { channelProviderId: channelProviderId, userId: { notIn: excludeUserIds } },
            orderBy: { _count: { emoteName: "desc" } },
        });

        // Normalize types and return JSON
        const result = emotes.map((r, i) => ({
            emoteName: r.emoteName,
            emoteId: r._max.emoteId,
            usage_count: r._count.emoteName,
            provider: r._max.provider,
            rank: i + 1,
        }));

        return c.json(result);
    }
}
