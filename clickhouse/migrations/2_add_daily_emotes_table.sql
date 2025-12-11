CREATE TABLE IF NOT EXISTS emotes_daily
(
    `channelProviderId` String,
    `provider` Enum8('Twitch' = 1, 'BTTV' = 2, 'FFZ' = 3, 'SevenTV' = 4),
    `emoteName` String,
    `emoteId` String,
    `day` Date,
    `count` UInt64
)
ENGINE = SummingMergeTree
ORDER BY (channelProviderId, day, provider, emoteId);

CREATE MATERIALIZED VIEW IF NOT EXISTS emotes_mv_daily TO emotes_daily
(
    `channelProviderId` String,
    `provider` Enum8('Twitch' = 1, 'BTTV' = 2, 'FFZ' = 3, 'SevenTV' = 4),
    `emoteName` String,
    `emoteId` String,
    `day` Date,
    `count` UInt64
)
AS SELECT
    channelProviderId,
    provider,
    emoteName,
    emoteId,
    toDate(usedAt) AS day,
    count() AS count
FROM emotes
GROUP BY
    channelProviderId,
    provider,
    emoteName,
    emoteId,
    day;

CREATE TABLE IF NOT EXISTS emotes_daily_user
(
    `channelProviderId` String,
    `userId` String,
    `provider` Enum8('Twitch' = 1, 'BTTV' = 2, 'FFZ' = 3, 'SevenTV' = 4),
    `emoteName` String,
    `emoteId` String,
    `day` Date,
    `count` UInt64
)
ENGINE = SummingMergeTree
ORDER BY (channelProviderId, day, userId,  provider, emoteId);

CREATE MATERIALIZED VIEW IF NOT EXISTS emotes_mv_daily_user
TO emotes_daily_user AS
SELECT
    channelProviderId,
    userId,
    provider,
    emoteName,
    emoteId,
    toDate(usedAt) AS day,
    count() AS count
FROM emotes
GROUP BY
    channelProviderId,
    userId,
    provider,
    emoteName,
    emoteId,
    day;