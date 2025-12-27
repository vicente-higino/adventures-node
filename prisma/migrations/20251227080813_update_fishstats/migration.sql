-- AlterTable
ALTER TABLE "FishStats" ADD COLUMN     "fishFinesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "treasureCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "FishStats"
SET "treasureCount" = ROUND("treasureSilver"::numeric / 1000),
"fishFinesCount" = ROUND("fishFines"::numeric / 50);

