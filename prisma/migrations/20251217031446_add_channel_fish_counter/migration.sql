-- CreateTable
CREATE TABLE "ChannelFishCount" (
    "channelProviderId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelFishCount_pkey" PRIMARY KEY ("channelProviderId")
);

INSERT INTO "ChannelFishCount" ("channelProviderId", "total", "updatedAt")
SELECT
  "channelProviderId",
  COUNT(*) AS total,
  now()
FROM "Fish"
GROUP BY "channelProviderId"
ON CONFLICT ("channelProviderId")
DO UPDATE
SET
  "total" = EXCLUDED."total",
  "updatedAt" = now();
