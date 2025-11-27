import { OpenAPIRoute } from "chanfana";
import { type HonoEnv } from "../types";
import type { Context } from "hono";
import { prisma } from "@/prisma";
import z from "zod";
import { getUserByUsername } from "@/twitch/api";
import { EmoteProvider, Prisma } from "@prisma/client";
import { parseProviders } from "@/utils/params";
import { emoteTracker } from "@/bot";

export class emotesRank extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({ username: z.string().min(1) }),
            query: z.object({
                excludeUsers: z.string().optional(),
                page: z.coerce.number().optional(),
                perPage: z.coerce.number().optional(),
                from: z.coerce.date().optional(),
                to: z.coerce.date().optional(),
                providers: z.string().optional(),
                onlyCurrentEmotes: z.boolean().optional(),
            }),
        },
        responses: {},
    };

    async handle(c: Context<HonoEnv>) {
        // Read and sanitize query params
        const data = await this.getValidatedData<typeof this.schema>();
        const rawChannel = data.params.username;
        const rawExcludes = data.query.excludeUsers ?? "";
        const rawPage = data.query.page ?? 1;
        const rawPerPage = data.query.perPage ?? 10;
        const from = data.query.from ?? new Date(0);
        const to = data.query.to ?? new Date();
        const rawProviders = data.query.providers ?? "";
        const onlyCurrentEmoteSet = data.query.onlyCurrentEmotes ?? false;
        let emotesIdFilter: string[] = [];
        const user = await getUserByUsername(prisma, rawChannel);
        if (!user) {
            return c.json({ message: "User not found" }, 404);
        }
        const currentEmotes = emoteTracker?.getChannelEmotes(user.login);
        if (onlyCurrentEmoteSet && currentEmotes) {
            emotesIdFilter = [...currentEmotes.values()].map(emote => emote.id);
        }
        const channelProviderId = user.id;
        const excludeUsernames = rawExcludes
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        const excludeUserIds = await Promise.all(
            excludeUsernames.map(async username => {
                const user = await getUserByUsername(prisma, username);
                return user?.id ?? "";
            }),
        );
        const filterProviders = parseProviders(rawProviders.split(",")) ?? Object.values(EmoteProvider);
        // Parse pagination params
        const page = Math.max(1, Number.isFinite(+rawPage) ? Math.max(1, rawPage) : 1);
        const perPageRaw = Number.isFinite(+rawPerPage) ? Math.max(1, rawPerPage) : 50;
        const perPage = Math.min(perPageRaw, 1000); // cap perPage to 1000
        const skip = (page - 1) * perPage;
        const take = perPage;

        // Get total distinct emotes for pagination
        const [totalQuery, emotes] = await Promise.all([
            prisma.$queryRaw<[{ count: BigInt }]>`
            SELECT COUNT(DISTINCT "emoteId") as count
            FROM "EmoteUsageEventV2"
            WHERE "channelProviderId" = ${channelProviderId}
            AND "usedAt" >= ${from}
            AND "usedAt" <= ${to}
            AND "provider" IN (${filterProviders.length > 0 ? Prisma.join(filterProviders) : ""})
            AND "userId" NOT IN (${excludeUserIds.length > 0 ? Prisma.join(excludeUserIds) : ""})
            `,
            prisma.emoteUsageEventV2.groupBy({
                by: ["emoteId", "emoteName"],
                _count: { emoteName: true },
                _max: { provider: true },
                where: {
                    channelProviderId: channelProviderId,
                    userId: { notIn: excludeUserIds },
                    usedAt: { gte: from, lte: to },
                    provider: { in: filterProviders },
                    emoteId: onlyCurrentEmoteSet ? { in: emotesIdFilter } : undefined,
                },
                orderBy: { _count: { emoteName: "desc" } },
                skip: !onlyCurrentEmoteSet ? skip : undefined,
                take: !onlyCurrentEmoteSet ? take : undefined,
            }),
        ]);

        let total = Number(totalQuery[0].count);
        let totalPages = Math.max(1, Math.ceil(total / perPage));
        let result = emotes.map((r, i) => ({
            emoteName: r.emoteName,
            emoteId: r.emoteId,
            usage_count: r._count.emoteName,
            provider: r._max.provider,
            rank: skip + i + 1,
        }));
        if (onlyCurrentEmoteSet && currentEmotes && currentEmotes.size > 0) {
            if (filterProviders.length > 0) {
                result = result.filter(e => (e.provider ? filterProviders.includes(e.provider) : false));
            }
            const usedEmoteNames = new Set(result.map(e => e.emoteId));
            const usedEmotesSize = result.length;
            const missingEmotes = [...currentEmotes.values()]
                .filter(e => !usedEmoteNames.has(e.id))
                .filter(e => filterProviders.includes(e.provider))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((e, i) => ({ emoteName: e.name, emoteId: e.id, usage_count: 0, provider: e.provider, rank: usedEmotesSize + i + 1 }));
            result = result.concat(missingEmotes);
            total = result.length;
            totalPages = 1;
        }

        return c.json({
            data: result,
            meta: { page, perPage, total, totalPages, channelId: user.id, channelName: user.login, channelDisplayName: user.displayName },
        });
    }
}
