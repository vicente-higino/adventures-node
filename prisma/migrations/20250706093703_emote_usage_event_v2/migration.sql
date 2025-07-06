-- CreateTable
CREATE TABLE "EmoteUsageEventV2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channelProviderId" TEXT NOT NULL,
    "emoteName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmoteUsageEventV2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmoteUsageEventV2_channelProviderId_emoteName_usedAt_idx" ON "EmoteUsageEventV2"("channelProviderId", "emoteName", "usedAt");
