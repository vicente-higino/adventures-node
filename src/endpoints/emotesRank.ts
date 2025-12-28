import { OpenAPIRoute } from "chanfana";
import { type HonoEnv } from "../types";
import type { Context } from "hono";
import { prisma } from "@/prisma";
import z from "zod";
import { getUserByUsername, getUsersByUsername } from "@/twitch/api";
import { EmoteProvider, Prisma } from "@prisma/client";
import { parseProviders } from "@/utils/params";
import { emoteTracker } from "@/bot";
import clickhouse from "@/db/clickhouse";
import logger from "@/logger";

export class emotesRank extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({ username: z.string().min(1) }),
            query: z.object({
                users: z.string().optional(),
                page: z.coerce.number().optional(),
                perPage: z.coerce.number().optional(),
                from: z.coerce.date().optional(),
                to: z.coerce.date().optional(),
                providers: z.string().optional(),
                onlyCurrentEmotes: z.boolean().optional(),
                userScope: z.enum(["all", "include", "exclude"]).default("all"),
                groupBy: z.enum(["id", "name"]).default("id"),
            }),
        },
        responses: {},
    };

    async handle(c: Context<HonoEnv>) {
        // Read and sanitize query params
        const data = await this.getValidatedData<typeof this.schema>();
        const rawChannel = data.params.username;
        const rawUsers = data.query.users ?? "";
        const rawPage = data.query.page ?? 1;
        const rawPerPage = data.query.perPage ?? 10;
        const from = data.query.from ?? new Date(0);
        const to = data.query.to ?? new Date();
        const rawProviders = data.query.providers ?? "";
        const onlyCurrentEmoteSet = data.query.onlyCurrentEmotes ?? false;
        const groupBy = data.query.groupBy;
        const userScope = data.query.userScope;
        let channelEmotes: string[] = [];
        const user = await getUserByUsername(prisma, rawChannel);
        if (!user) {
            return c.json({ message: "User not found" }, 404);
        }
        const currentEmotes = emoteTracker?.getChannelEmotes(user.login);
        if (onlyCurrentEmoteSet && currentEmotes) {
            channelEmotes = [...currentEmotes.values()].map(emote => (groupBy == "id" ? emote.id : emote.name));
        }
        const channelProviderId = user.id;
        const usernames = rawUsers
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        const users = await getUsersByUsername(usernames);
        const userIds = users ? users.map(user => user.id) : [];
        const filterProviders = parseProviders(rawProviders.split(",")) ?? Object.values(EmoteProvider);
        // Parse pagination params
        const page = Math.max(1, Number.isFinite(+rawPage) ? Math.max(1, rawPage) : 1);
        const perPageRaw = Number.isFinite(+rawPerPage) ? Math.max(1, rawPerPage) : 50;
        const perPage = Math.min(perPageRaw, 1000); // cap perPage to 1000
        const skip = (page - 1) * perPage;
        const take = perPage;

        const { sql } = buildEmoteQuery({ groupBy, userIds, userScope, channelEmotes, onlyCurrentEmoteSet });

        const query = await clickhouse.query({
            query: sql,
            format: "JSON",
            query_params: { channelProviderId, take, skip, from, to, userIds, filterProviders, emotesFilter: channelEmotes },
        });
        const queryResult = await query.json<{ emoteId: string; emoteName: string; provider: EmoteProvider; total: number }>();
        logger.debug({ ...queryResult, data: null });
        const emotes = queryResult.data;
        let total = queryResult.rows_before_limit_at_least!;
        let totalPages = Math.max(1, Math.ceil(total / perPage));
        let result = emotes.map((r, i) => ({
            emoteName: r.emoteName,
            emoteId: r.emoteId,
            usage_count: r.total,
            provider: r.provider,
            rank: skip + i + 1,
        }));
        if (onlyCurrentEmoteSet && currentEmotes && currentEmotes.size > 0) {
            if (filterProviders.length > 0) {
                result = result.filter(e => (e.provider ? filterProviders.includes(e.provider) : false));
            }
            const usedEmoteNames = new Set(result.map(e => (groupBy == "id" ? e.emoteId : e.emoteName)));
            const usedEmotesSize = result.length;
            const missingEmotes = [...currentEmotes.values()]
                .filter(e => !usedEmoteNames.has(groupBy == "id" ? e.id : e.name))
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

function buildEmoteQuery(options: {
    groupBy: "id" | "name";
    userIds: string[];
    userScope: "all" | "include" | "exclude";
    channelEmotes: string[];
    onlyCurrentEmoteSet: boolean;
}) {
    const { groupBy, userIds, userScope, channelEmotes, onlyCurrentEmoteSet } = options;

    const isGroupById = groupBy === "id";

    const select = isGroupById ? "emoteId, any(emoteName) AS emoteName" : "emoteName, topKWeighted(1)(emoteId, count)[1] AS emoteId";

    const group = isGroupById ? "emoteId" : "emoteName";

    const table = userIds.length > 0 ? "emotes_daily_user" : "emotes_daily";

    // Build WHERE clauses
    const where: string[] = [
        "channelProviderId = {channelProviderId: String}",
        "provider IN {filterProviders: Array(Enum8('Twitch' = 1, 'BTTV' = 2, 'FFZ' = 3, 'SevenTV' = 4))}",
        "day >= {from: DateTime64}",
        "day <= {to: DateTime64}",
    ];

    if (userIds.length > 0 && userScope !== "all") {
        const inOrNotIn = userScope == "include" ? "IN" : "NOT IN";
        where.push(`userId ${inOrNotIn} {userIds: Array(String)}`);
    }

    if (channelEmotes.length > 0) {
        where.push(isGroupById ? "emoteId IN {emotesFilter: Array(String)}" : "emoteName IN {emotesFilter: Array(String)}");
    }

    // Optional limit
    const limit = onlyCurrentEmoteSet && channelEmotes.length > 0 ? "" : "LIMIT {take: Int32} OFFSET {skip: Int32}";

    // Final SQL
    const sql = `
        SELECT ${select}, provider, sum(count) AS total
        FROM ${table}
        WHERE ${where.join("\n  AND ")}
        GROUP BY ${group}, provider
        ORDER BY total DESC
        ${limit}
    `;

    return { sql, group, select, table };
}
