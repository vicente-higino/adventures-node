-- CreateEnum
CREATE TYPE "EmoteProvider" AS ENUM ('Twitch', 'BTTV', 'FFZ', 'SevenTV');

-- AlterTable
ALTER TABLE "EmoteUsageEventV2" ADD COLUMN     "emoteId" TEXT,
ADD COLUMN     "provider" "EmoteProvider";
