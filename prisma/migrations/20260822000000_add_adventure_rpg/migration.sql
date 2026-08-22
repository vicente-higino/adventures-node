-- CreateEnum
CREATE TYPE "AdventureStatus" AS ENUM ('OPEN', 'RESOLVING', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdventureItemType" AS ENUM ('EQUIPMENT', 'CONSUMABLE', 'MATERIAL', 'COLLECTIBLE');

-- CreateEnum
CREATE TYPE "AdventureItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AdventureResultOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- AlterTable
ALTER TABLE "Adventure"
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "status" "AdventureStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "scenarioId" TEXT,
ADD COLUMN "theme" TEXT,
ADD COLUMN "scenarioContext" JSONB,
ADD COLUMN "resolutionSeed" TEXT,
ADD COLUMN "rulesVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "scheduleGeneration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "schedulePaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "eligibleAt" TIMESTAMP(3),
ADD COLUMN "endsAt" TIMESTAMP(3),
ADD COLUMN "resolvingAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "finalChatResult" JSONB;

-- AlterTable
ALTER TABLE "Player"
ADD COLUMN "approachCode" TEXT,
ADD COLUMN "checkCode" TEXT,
ADD COLUMN "loadoutSnapshot" JSONB;

-- Adventure wagers are BIGINT; keep streak accounting in the same range so a
-- large but valid wager cannot overflow settlement.
ALTER TABLE "UserStats"
ALTER COLUMN "streakWager" TYPE BIGINT USING "streakWager"::BIGINT;

-- Record every original duplicate participant row before canonicalization.
-- Exact debits cannot be reconstructed from legacy absolute balance writes, so
-- this evidence is retained on the adventure for manual reconciliation.
CREATE TEMP TABLE "_migration_duplicate_player_adventures" AS
WITH duplicate_participants AS (
    SELECT "adventureId", "userId"
    FROM "Player"
    GROUP BY "adventureId", "userId"
    HAVING COUNT(*) > 1
)
SELECT
    player."adventureId",
    jsonb_agg(
        jsonb_build_object(
            'playerId', player."id",
            'userId', player."userId",
            'buyin', player."buyin"::TEXT,
            'createdAt', player."createdAt",
            'updatedAt', player."updatedAt"
        )
        ORDER BY player."userId", player."createdAt", player."id"
    ) AS "playerRows"
FROM "Player" AS player
JOIN duplicate_participants AS duplicate
  ON duplicate."adventureId" = player."adventureId"
 AND duplicate."userId" = player."userId"
GROUP BY player."adventureId";

UPDATE "Adventure" AS adventure
SET "scenarioContext" =
    COALESCE(adventure."scenarioContext", '{}'::JSONB)
    || jsonb_build_object(
        'migrationAudit',
        jsonb_build_object(
            'reason', 'Legacy duplicate participants produced by concurrent absolute balance writes',
            'policy', 'No automatic refund; reconcile manually from the preserved candidate rows',
            'duplicatePlayerRows', duplicate_players."playerRows"
        )
    )
FROM "_migration_duplicate_player_adventures" AS duplicate_players
WHERE adventure."id" = duplicate_players."adventureId";

-- For historical rows, keep the smallest observed wager on the oldest canonical
-- participant. MIN is intentionally a no-mint policy; it may understate a debit,
-- but cannot create value from an unknowable last-write-wins race.
WITH merged_players AS (
    SELECT
        "adventureId",
        "userId",
        MIN("id") AS "keeperId",
        MIN("buyin") AS "reconciledBuyin",
        MIN("createdAt") AS "firstCreatedAt",
        MAX("updatedAt") AS "lastUpdatedAt"
    FROM "Player"
    GROUP BY "adventureId", "userId"
    HAVING COUNT(*) > 1
)
UPDATE "Player" AS keeper
SET
    "buyin" = merged_players."reconciledBuyin",
    "createdAt" = merged_players."firstCreatedAt",
    "updatedAt" = merged_players."lastUpdatedAt"
FROM merged_players
WHERE keeper."id" = merged_players."keeperId";

WITH ranked_players AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "adventureId", "userId" ORDER BY "id") AS "rowNumber"
    FROM "Player"
)
DELETE FROM "Player" AS duplicate
USING ranked_players
WHERE duplicate."id" = ranked_players."id"
  AND ranked_players."rowNumber" > 1;

-- Backfill the creator from the first participant, including completed legacy
-- adventures whose original `name` has already been replaced with `DONE`.
UPDATE "Adventure" AS adventure
SET "createdByUserId" = (
    SELECT player."userId"
    FROM "Player" AS player
    WHERE player."adventureId" = adventure."id"
    ORDER BY player."createdAt", player."id"
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM "Player" AS player
    WHERE player."adventureId" = adventure."id"
);

-- Translate the legacy lifecycle marker and reconstruct the timestamps that are
-- knowable from existing rows. `updatedAt` is the closest recorded resolution time.
UPDATE "Adventure"
SET
    "status" = 'RESOLVED',
    "eligibleAt" = "createdAt" + INTERVAL '10 minutes',
    "endsAt" = "updatedAt",
    "resolvedAt" = "updatedAt"
WHERE "name" = 'DONE';

UPDATE "Adventure"
SET "eligibleAt" = "createdAt" + INTERVAL '10 minutes'
WHERE "eligibleAt" IS NULL;

UPDATE "Adventure"
SET "endsAt" = "createdAt" + INTERVAL '45 minutes'
WHERE "status" = 'OPEN'
  AND "endsAt" IS NULL;

-- Quarantine open adventures with duplicate participants, plus every open run in
-- a channel that has multiple runs. Because no ledger can prove which absolute
-- balance write committed, do not mint an automatic refund; the cancelled rows
-- remain intact for explicit manual reconciliation.
WITH duplicate_open_channels AS (
    SELECT "channelProviderId"
    FROM "Adventure"
    WHERE "status" = 'OPEN'
    GROUP BY "channelProviderId"
    HAVING COUNT(*) > 1
), quarantined_open_adventures AS (
    SELECT adventure."id"
    FROM "Adventure" AS adventure
    JOIN duplicate_open_channels AS duplicate_channel
      ON duplicate_channel."channelProviderId" = adventure."channelProviderId"
    WHERE adventure."status" = 'OPEN'

    UNION

    SELECT adventure."id"
    FROM "Adventure" AS adventure
    JOIN "_migration_duplicate_player_adventures" AS duplicate_player
      ON duplicate_player."adventureId" = adventure."id"
    WHERE adventure."status" = 'OPEN'
)
UPDATE "Adventure" AS adventure
SET
    "name" = 'DONE',
    "status" = 'CANCELLED',
    "endsAt" = COALESCE(adventure."endsAt", adventure."updatedAt"),
    "cancelledAt" = COALESCE(adventure."cancelledAt", adventure."updatedAt"),
    "finalChatResult" = '["Cancelled during the RPG migration because legacy concurrent balance writes could not be reconciled safely."]'::JSONB
FROM quarantined_open_adventures AS quarantined
WHERE adventure."id" = quarantined."id"
  AND adventure."status" = 'OPEN';

DROP TABLE "_migration_duplicate_player_adventures";

-- CreateTable
CREATE TABLE "AdventureProfile" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classCode" TEXT,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdventureProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventureItem" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "AdventureItemType" NOT NULL,
    "rarity" "AdventureItemRarity" NOT NULL DEFAULT 'COMMON',
    "theme" TEXT,
    "checkCode" TEXT,
    "modifier" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdventureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventureInventoryItem" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "equippedSlot" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdventureInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventureProfileCondition" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modifier" INTEGER NOT NULL,
    "checkCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "themeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "remainingAdventures" INTEGER NOT NULL DEFAULT 1,
    "sourceAdventureId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdventureProfileCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventurePlayerResult" (
    "id" SERIAL NOT NULL,
    "adventureId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "approachCode" TEXT NOT NULL,
    "checkCode" TEXT NOT NULL,
    "roll" INTEGER NOT NULL,
    "dc" INTEGER NOT NULL,
    "rawModifier" INTEGER NOT NULL,
    "effectiveModifier" INTEGER NOT NULL,
    "modifierBreakdown" JSONB NOT NULL,
    "chancePercent" INTEGER NOT NULL,
    "outcome" "AdventureResultOutcome" NOT NULL,
    "criticalCode" TEXT,
    "buyin" BIGINT NOT NULL,
    "payoutRate" DOUBLE PRECISION NOT NULL,
    "payout" BIGINT NOT NULL DEFAULT 0,
    "streakBonus" BIGINT NOT NULL DEFAULT 0,
    "xpAwarded" BIGINT NOT NULL DEFAULT 0,
    "lootSnapshot" JSONB,
    "statusSnapshot" JSONB,
    "narrative" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdventurePlayerResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventureJoinRequest" (
    "id" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT,
    "adventureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdventureJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_adventureId_userId_key" ON "Player"("adventureId", "userId");

-- CreateIndex
CREATE INDEX "Player_userId_createdAt_idx" ON "Player"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Adventure_channelProviderId_status_createdAt_idx" ON "Adventure"("channelProviderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Adventure_scenarioId_idx" ON "Adventure"("scenarioId");

-- PostgreSQL partial index: Prisma cannot currently express this in the schema.
CREATE UNIQUE INDEX "one_active_adventure_per_channel"
ON "Adventure"("channelProviderId")
WHERE "status" IN ('OPEN', 'RESOLVING');

-- CreateIndex
CREATE UNIQUE INDEX "AdventureProfile_channelProviderId_userId_key" ON "AdventureProfile"("channelProviderId", "userId");

-- CreateIndex
CREATE INDEX "AdventureProfile_userId_idx" ON "AdventureProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdventureItem_code_key" ON "AdventureItem"("code");

-- CreateIndex
CREATE INDEX "AdventureItem_type_active_idx" ON "AdventureItem"("type", "active");

-- CreateIndex
CREATE INDEX "AdventureItem_theme_checkCode_idx" ON "AdventureItem"("theme", "checkCode");

-- CreateIndex
CREATE UNIQUE INDEX "AdventureInventoryItem_profileId_itemId_key" ON "AdventureInventoryItem"("profileId", "itemId");

-- PostgreSQL allows multiple NULL slots but only one equipped item per named slot.
CREATE UNIQUE INDEX "AdventureInventoryItem_profileId_equippedSlot_key" ON "AdventureInventoryItem"("profileId", "equippedSlot");

-- CreateIndex
CREATE INDEX "AdventureInventoryItem_itemId_idx" ON "AdventureInventoryItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AdventureProfileCondition_profileId_code_key" ON "AdventureProfileCondition"("profileId", "code");

-- CreateIndex
CREATE INDEX "AdventureProfileCondition_sourceAdventureId_idx" ON "AdventureProfileCondition"("sourceAdventureId");

-- CreateIndex
CREATE UNIQUE INDEX "AdventurePlayerResult_playerId_key" ON "AdventurePlayerResult"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AdventurePlayerResult_adventureId_userId_key" ON "AdventurePlayerResult"("adventureId", "userId");

-- CreateIndex
CREATE INDEX "AdventurePlayerResult_userId_createdAt_idx" ON "AdventurePlayerResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdventurePlayerResult_adventureId_outcome_idx" ON "AdventurePlayerResult"("adventureId", "outcome");

-- CreateIndex
CREATE INDEX "AdventureJoinRequest_createdAt_idx" ON "AdventureJoinRequest"("createdAt");

-- AddCheckConstraint
ALTER TABLE "Adventure"
ADD CONSTRAINT "Adventure_rulesVersion_positive_check" CHECK ("rulesVersion" >= 1),
ADD CONSTRAINT "Adventure_contentVersion_positive_check" CHECK ("contentVersion" >= 1),
ADD CONSTRAINT "Adventure_schedule_generation_non_negative_check" CHECK ("scheduleGeneration" >= 0),
ADD CONSTRAINT "Adventure_context_object_check" CHECK ("scenarioContext" IS NULL OR jsonb_typeof("scenarioContext") = 'object'),
ADD CONSTRAINT "Adventure_chat_result_array_check" CHECK ("finalChatResult" IS NULL OR jsonb_typeof("finalChatResult") = 'array'),
ADD CONSTRAINT "Adventure_resolving_timestamp_check" CHECK ("status" <> 'RESOLVING' OR "resolvingAt" IS NOT NULL),
ADD CONSTRAINT "Adventure_resolved_timestamp_check" CHECK ("status" <> 'RESOLVED' OR "resolvedAt" IS NOT NULL),
ADD CONSTRAINT "Adventure_cancelled_timestamp_check" CHECK ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL);

-- AddCheckConstraint
ALTER TABLE "Player"
ADD CONSTRAINT "Player_loadout_object_check" CHECK ("loadoutSnapshot" IS NULL OR jsonb_typeof("loadoutSnapshot") = 'object'),
ADD CONSTRAINT "Player_buyin_non_negative_check" CHECK ("buyin" >= 0);

-- AddCheckConstraint
ALTER TABLE "AdventureProfile"
ADD CONSTRAINT "AdventureProfile_xp_non_negative_check" CHECK ("xp" >= 0);

-- AddCheckConstraint
ALTER TABLE "AdventureItem"
ADD CONSTRAINT "AdventureItem_modifier_bounded_check" CHECK ("modifier" BETWEEN -1 AND 1),
ADD CONSTRAINT "AdventureItem_config_object_check" CHECK (jsonb_typeof("config") = 'object');

-- AddCheckConstraint
ALTER TABLE "AdventureInventoryItem"
ADD CONSTRAINT "AdventureInventoryItem_quantity_non_negative_check" CHECK ("quantity" >= 0),
ADD CONSTRAINT "AdventureInventoryItem_equipped_quantity_check" CHECK ("equippedSlot" IS NULL OR "quantity" > 0),
ADD CONSTRAINT "AdventureInventoryItem_metadata_object_check" CHECK (jsonb_typeof("metadata") = 'object');

-- AddCheckConstraint
ALTER TABLE "AdventureProfileCondition"
ADD CONSTRAINT "AdventureProfileCondition_modifier_check" CHECK ("modifier" IN (-1, 1)),
ADD CONSTRAINT "AdventureProfileCondition_remaining_non_negative_check" CHECK ("remainingAdventures" >= 0);

-- AddCheckConstraint
ALTER TABLE "AdventurePlayerResult"
ADD CONSTRAINT "AdventurePlayerResult_roll_check" CHECK ("roll" BETWEEN 1 AND 20),
ADD CONSTRAINT "AdventurePlayerResult_dc_check" CHECK ("dc" BETWEEN 1 AND 20),
ADD CONSTRAINT "AdventurePlayerResult_effective_modifier_check" CHECK ("effectiveModifier" BETWEEN -4 AND 4),
ADD CONSTRAINT "AdventurePlayerResult_chance_check" CHECK ("chancePercent" BETWEEN 30 AND 70 AND MOD("chancePercent", 5) = 0),
ADD CONSTRAINT "AdventurePlayerResult_outcome_check" CHECK (
    ("outcome" = 'SUCCESS' AND "roll" + "effectiveModifier" >= "dc") OR
    ("outcome" = 'FAILURE' AND "roll" + "effectiveModifier" < "dc")
),
ADD CONSTRAINT "AdventurePlayerResult_buyin_non_negative_check" CHECK ("buyin" >= 0),
ADD CONSTRAINT "AdventurePlayerResult_payout_rate_positive_check" CHECK ("payoutRate" > 0),
ADD CONSTRAINT "AdventurePlayerResult_rewards_non_negative_check" CHECK ("payout" >= 0 AND "streakBonus" >= 0 AND "xpAwarded" >= 0);

-- AddForeignKey
ALTER TABLE "Adventure" ADD CONSTRAINT "Adventure_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("providerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureProfile" ADD CONSTRAINT "AdventureProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureInventoryItem" ADD CONSTRAINT "AdventureInventoryItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AdventureProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureInventoryItem" ADD CONSTRAINT "AdventureInventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AdventureItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureProfileCondition" ADD CONSTRAINT "AdventureProfileCondition_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AdventureProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureProfileCondition" ADD CONSTRAINT "AdventureProfileCondition_sourceAdventureId_fkey" FOREIGN KEY ("sourceAdventureId") REFERENCES "Adventure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventurePlayerResult" ADD CONSTRAINT "AdventurePlayerResult_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventurePlayerResult" ADD CONSTRAINT "AdventurePlayerResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventurePlayerResult" ADD CONSTRAINT "AdventurePlayerResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureJoinRequest" ADD CONSTRAINT "AdventureJoinRequest_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep legacy rows and the new lifecycle marker synchronized during the
-- controlled cutover. Old application binaries must be drained before this
-- migration because the new uniqueness constraints are intentionally stricter.
CREATE FUNCTION sync_adventure_legacy_lifecycle() RETURNS trigger AS $$
BEGIN
    IF NEW."eligibleAt" IS NULL AND NEW."status" = 'OPEN' THEN
        NEW."eligibleAt" := COALESCE(NEW."createdAt", CURRENT_TIMESTAMP) + INTERVAL '10 minutes';
    END IF;

    IF NEW."name" = 'DONE' AND NEW."status" IN ('OPEN', 'RESOLVING') THEN
        NEW."status" := 'RESOLVED';
    END IF;

    IF NEW."status" = 'RESOLVING' THEN
        NEW."resolvingAt" := COALESCE(NEW."resolvingAt", CURRENT_TIMESTAMP);
    ELSIF NEW."status" = 'RESOLVED' THEN
        NEW."name" := 'DONE';
        NEW."endsAt" := COALESCE(NEW."endsAt", CURRENT_TIMESTAMP);
        NEW."resolvedAt" := COALESCE(NEW."resolvedAt", CURRENT_TIMESTAMP);
    ELSIF NEW."status" = 'CANCELLED' THEN
        NEW."name" := 'DONE';
        NEW."endsAt" := COALESCE(NEW."endsAt", CURRENT_TIMESTAMP);
        NEW."cancelledAt" := COALESCE(NEW."cancelledAt", CURRENT_TIMESTAMP);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Adventure_sync_legacy_lifecycle"
BEFORE INSERT OR UPDATE OF "name", "status", "eligibleAt", "endsAt", "resolvingAt", "resolvedAt", "cancelledAt"
ON "Adventure"
FOR EACH ROW
EXECUTE FUNCTION sync_adventure_legacy_lifecycle();

-- Settlement rows are append-only. Cascading deletes remain available for account
-- deletion and legacy adventure cleanup, but a recorded result cannot be rewritten.
CREATE FUNCTION prevent_adventure_player_result_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AdventurePlayerResult rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AdventurePlayerResult_prevent_update"
BEFORE UPDATE OF
    "id",
    "adventureId",
    "playerId",
    "userId",
    "approachCode",
    "checkCode",
    "roll",
    "dc",
    "rawModifier",
    "effectiveModifier",
    "modifierBreakdown",
    "chancePercent",
    "outcome",
    "criticalCode",
    "buyin",
    "payoutRate",
    "payout",
    "streakBonus",
    "xpAwarded",
    "lootSnapshot",
    "statusSnapshot",
    "narrative",
    "createdAt"
ON "AdventurePlayerResult"
FOR EACH ROW
EXECUTE FUNCTION prevent_adventure_player_result_update();
