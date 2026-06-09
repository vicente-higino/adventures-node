export function buildEmoteQuery(options: {
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
