-- Recalculate all fish counters in FishStats from the Fish table
-- PostgreSQL

WITH fish_agg AS (
    SELECT
        f."channelProviderId",
        f."userId",
        COUNT(*) FILTER (WHERE f.rarity = 'Trash')      AS "trashFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Common')     AS "commonFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Uncommon')   AS "uncommonFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Fine')       AS "fineFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Rare')       AS "rareFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Epic')       AS "epicFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Exotic')     AS "exoticFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Mythic')     AS "mythicFishCount",
        COUNT(*) FILTER (WHERE f.rarity = 'Legendary')  AS "legendaryFishCount"

    FROM "Fish" f
    GROUP BY
        f."channelProviderId",
        f."userId"
)

UPDATE "FishStats" fs
SET
    "trashFishCount"     = fa."trashFishCount",
    "commonFishCount"    = fa."commonFishCount",
    "uncommonFishCount"  = fa."uncommonFishCount",
    "fineFishCount"      = fa."fineFishCount",
    "rareFishCount"      = fa."rareFishCount",
    "epicFishCount"      = fa."epicFishCount",
    "exoticFishCount"    = fa."exoticFishCount",
    "mythicFishCount"    = fa."mythicFishCount",
    "legendaryFishCount" = fa."legendaryFishCount",
    "updatedAt"          = "updatedAt"
FROM fish_agg fa
WHERE
    fs."channelProviderId" = fa."channelProviderId"
    AND fs."userId" = fa."userId";