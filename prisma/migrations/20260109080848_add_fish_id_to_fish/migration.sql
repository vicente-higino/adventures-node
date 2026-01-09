
-- AlterTable
ALTER TABLE "Fish" ADD COLUMN     "fishId" TEXT NOT NULL default '';

WITH r AS (select id, ROW_NUMBER() OVER ( PARTITION BY "channelProviderId" order by "id") as r from "Fish")
UPDATE "Fish" SET "fishId" = r.r FROM r WHERE "Fish".id = r.id;

-- CreateIndex
CREATE UNIQUE INDEX "Fish_channelProviderId_fishId_key" ON "Fish"("channelProviderId", "fishId");


-- AlterTable
ALTER TABLE "Fish" ALTER COLUMN "fishId" DROP DEFAULT;
