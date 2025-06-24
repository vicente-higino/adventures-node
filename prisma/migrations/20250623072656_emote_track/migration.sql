-- CreateTable
CREATE TABLE "EmoteUsage" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "emoteName" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmoteUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmoteUsageEvent" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "emoteName" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmoteUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmoteUsage_channelProviderId_emoteName_idx" ON "EmoteUsage"("channelProviderId", "emoteName");

-- CreateIndex
CREATE UNIQUE INDEX "EmoteUsage_channelProviderId_emoteName_key" ON "EmoteUsage"("channelProviderId", "emoteName");

-- CreateIndex
CREATE INDEX "EmoteUsageEvent_channelProviderId_emoteName_usedAt_idx" ON "EmoteUsageEvent"("channelProviderId", "emoteName", "usedAt");
