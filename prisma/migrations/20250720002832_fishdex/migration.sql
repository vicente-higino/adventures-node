-- CreateTable
CREATE TABLE "FishDex" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "fishName" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "firstCaughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FishDex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FishDex_channelProviderId_userId_rarity_fishName_idx" ON "FishDex"("channelProviderId", "userId", "rarity", "fishName");

-- CreateIndex
CREATE UNIQUE INDEX "FishDex_channelProviderId_userId_fishName_key" ON "FishDex"("channelProviderId", "userId", "fishName");

-- AddForeignKey
ALTER TABLE "FishDex" ADD CONSTRAINT "FishDex_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;
