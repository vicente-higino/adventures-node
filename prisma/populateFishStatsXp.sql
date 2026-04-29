UPDATE "FishStats"
SET xp =
    ROUND(
        SQRT("trashFishCount" * 1) +           -- Trash: baseXp=1
        SQRT("commonFishCount" * 25) +         -- Common: baseXp=25
        SQRT("uncommonFishCount" * 50) +       -- Uncommon: baseXp=50
        SQRT("fineFishCount" * 75) +           -- Fine: baseXp=75
        SQRT("rareFishCount" * 100) +          -- Rare: baseXp=100
        SQRT("epicFishCount" * 250) +          -- Epic: baseXp=250
        SQRT("legendaryFishCount" * 1000)      -- Legendary: baseXp=1000
    );