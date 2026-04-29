/*
  Warnings:

  - A unique constraint covering the columns `[channelProviderId,fishName,quality]` on the table `FishRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FishQuality" AS ENUM ('Normal', 'Glistening', 'Opulent', 'Radiant', 'Alpha');

-- DropIndex
DROP INDEX "FishRecord_channelProviderId_fishName_key";

-- AlterTable
ALTER TABLE "Fish" ADD COLUMN     "quality" "FishQuality" NOT NULL DEFAULT 'Normal';

-- AlterTable
ALTER TABLE "FishRecord" ADD COLUMN     "quality" "FishQuality" NOT NULL DEFAULT 'Normal';

-- AlterTable
ALTER TABLE "FishStats" ADD COLUMN     "fishingRodLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "FishRecord_channelProviderId_fishName_quality_key" ON "FishRecord"("channelProviderId", "fishName", "quality");
