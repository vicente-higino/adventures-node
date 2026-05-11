-- CreateEnum
CREATE TYPE "RedeemableType" AS ENUM ('START_ADVENTURE_MULTIPLIER', 'START_LEGENDARY_EVENT');

-- CreateTable
CREATE TABLE "Redeemable" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RedeemableType" NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redeemable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRedeemable" (
    "id" SERIAL NOT NULL,
    "channelProviderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemableId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRedeemable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Redeemable_code_key" ON "Redeemable"("code");

-- CreateIndex
CREATE INDEX "UserRedeemable_channelProviderId_userId_idx" ON "UserRedeemable"("channelProviderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRedeemable_channelProviderId_userId_redeemableId_key" ON "UserRedeemable"("channelProviderId", "userId", "redeemableId");

-- AddForeignKey
ALTER TABLE "UserRedeemable" ADD CONSTRAINT "UserRedeemable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRedeemable" ADD CONSTRAINT "UserRedeemable_redeemableId_fkey" FOREIGN KEY ("redeemableId") REFERENCES "Redeemable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
