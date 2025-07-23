-- DropForeignKey
ALTER TABLE "FishRecord" DROP CONSTRAINT "FishRecord_heaviestFishId_fkey";

-- DropForeignKey
ALTER TABLE "FishRecord" DROP CONSTRAINT "FishRecord_largestFishId_fkey";

-- DropForeignKey
ALTER TABLE "FishRecord" DROP CONSTRAINT "FishRecord_lightestFishId_fkey";

-- DropForeignKey
ALTER TABLE "FishRecord" DROP CONSTRAINT "FishRecord_smallestFishId_fkey";

-- CreateTable
CREATE TABLE "FishDexCompletion" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reward" INTEGER NOT NULL,

    CONSTRAINT "FishDexCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FishDexCompletion_channelProviderId_userId_rarity_idx" ON "FishDexCompletion"("channelProviderId", "userId", "rarity");

-- CreateIndex
CREATE UNIQUE INDEX "FishDexCompletion_channelProviderId_userId_rarity_key" ON "FishDexCompletion"("channelProviderId", "userId", "rarity");

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_largestFishId_fkey" FOREIGN KEY ("largestFishId") REFERENCES "Fish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_smallestFishId_fkey" FOREIGN KEY ("smallestFishId") REFERENCES "Fish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_heaviestFishId_fkey" FOREIGN KEY ("heaviestFishId") REFERENCES "Fish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_lightestFishId_fkey" FOREIGN KEY ("lightestFishId") REFERENCES "Fish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishDexCompletion" ADD CONSTRAINT "FishDexCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;
