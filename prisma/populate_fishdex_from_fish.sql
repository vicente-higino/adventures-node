INSERT INTO "FishDex" (
    "userId",
    "channelProviderId",
    "fishName",
    "rarity",
    "firstCaughtAt"
)
SELECT
    "userId",
    "channelProviderId",
    "name" AS "fishName",
    "rarity",
    MIN("createdAt") AS "firstCaughtAt"
FROM "Fish"
GROUP BY "userId", "channelProviderId", "name", "rarity"
ON CONFLICT ("channelProviderId", "userId", "fishName") DO NOTHING;
