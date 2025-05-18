-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('imperial', 'metric');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('Trash', 'Common', 'Uncommon', 'Fine', 'Rare', 'Epic', 'Legendary');

-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('Pending', 'Accepted', 'Declined', 'Completed');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "providerId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'metric',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "buyin" INTEGER NOT NULL DEFAULT 0,
    "adventureId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adventure" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payoutRate" DOUBLE PRECISION NOT NULL DEFAULT 1.3,

    CONSTRAINT "Adventure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fish" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "weight" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "value" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "Fish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "totalWagers" INTEGER NOT NULL DEFAULT 0,
    "totalWinnings" INTEGER NOT NULL DEFAULT 0,
    "duelsPlayed" INTEGER NOT NULL DEFAULT 0,
    "duelsWon" INTEGER NOT NULL DEFAULT 0,
    "duelsWagered" INTEGER NOT NULL DEFAULT 0,
    "duelsWonAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fishFines" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishStats" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "trashFishCount" INTEGER NOT NULL DEFAULT 0,
    "commonFishCount" INTEGER NOT NULL DEFAULT 0,
    "uncommonFishCount" INTEGER NOT NULL DEFAULT 0,
    "fineFishCount" INTEGER NOT NULL DEFAULT 0,
    "rareFishCount" INTEGER NOT NULL DEFAULT 0,
    "epicFishCount" INTEGER NOT NULL DEFAULT 0,
    "legendaryFishCount" INTEGER NOT NULL DEFAULT 0,
    "fishFines" INTEGER NOT NULL DEFAULT 0,
    "totalSilverWorth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FishStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishRecord" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "fishName" TEXT NOT NULL,
    "largestFishId" INTEGER NOT NULL,
    "smallestFishId" INTEGER NOT NULL,
    "heaviestFishId" INTEGER NOT NULL,
    "lightestFishId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FishRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Duel" (
    "id" SERIAL NOT NULL,
    "challengerId" TEXT NOT NULL,
    "challengedId" TEXT NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "wagerAmount" INTEGER NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_providerId_key" ON "User"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_displayName_key" ON "User"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_channelProviderId_userId_key" ON "Balance"("channelProviderId", "userId");

-- CreateIndex
CREATE INDEX "Adventure_channelProviderId_idx" ON "Adventure"("channelProviderId");

-- CreateIndex
CREATE INDEX "Fish_channelProviderId_userId_idx" ON "Fish"("channelProviderId", "userId");

-- CreateIndex
CREATE INDEX "UserStats_channelProviderId_userId_idx" ON "UserStats"("channelProviderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStats_channelProviderId_userId_key" ON "UserStats"("channelProviderId", "userId");

-- CreateIndex
CREATE INDEX "FishStats_channelProviderId_userId_idx" ON "FishStats"("channelProviderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FishStats_channelProviderId_userId_key" ON "FishStats"("channelProviderId", "userId");

-- CreateIndex
CREATE INDEX "FishRecord_channelProviderId_idx" ON "FishRecord"("channelProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "FishRecord_channelProviderId_fishName_key" ON "FishRecord"("channelProviderId", "fishName");

-- CreateIndex
CREATE INDEX "Duel_channelProviderId_challengerId_challengedId_idx" ON "Duel"("channelProviderId", "challengerId", "challengedId");

-- CreateIndex
CREATE UNIQUE INDEX "Duel_channelProviderId_challengerId_challengedId_key" ON "Duel"("channelProviderId", "challengerId", "challengedId");

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "Adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fish" ADD CONSTRAINT "Fish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishStats" ADD CONSTRAINT "FishStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_largestFishId_fkey" FOREIGN KEY ("largestFishId") REFERENCES "Fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_smallestFishId_fkey" FOREIGN KEY ("smallestFishId") REFERENCES "Fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_heaviestFishId_fkey" FOREIGN KEY ("heaviestFishId") REFERENCES "Fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishRecord" ADD CONSTRAINT "FishRecord_lightestFishId_fkey" FOREIGN KEY ("lightestFishId") REFERENCES "Fish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengedId_fkey" FOREIGN KEY ("challengedId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

