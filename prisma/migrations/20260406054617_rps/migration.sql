-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoundWinner" AS ENUM ('PLAYER_A', 'PLAYER_B', 'DRAW');

-- CreateEnum
CREATE TYPE "RpsMove" AS ENUM ('ROCK', 'PAPER', 'SCISSORS');

-- CreateTable
CREATE TABLE "Match" (
    "id" BIGSERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "playerA" TEXT NOT NULL,
    "playerB" TEXT NOT NULL,
    "wager" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "winner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" BIGSERIAL NOT NULL,
    "matchId" BIGINT NOT NULL,
    "roundNum" INTEGER NOT NULL,
    "winner" "RoundWinner",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" BIGSERIAL NOT NULL,
    "roundId" BIGINT NOT NULL,
    "player" TEXT NOT NULL,
    "move" "RpsMove" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_playerA_idx" ON "Match"("playerA");

-- CreateIndex
CREATE INDEX "Match_playerB_idx" ON "Match"("playerB");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Round_matchId_roundNum_key" ON "Round"("matchId", "roundNum");

-- CreateIndex
CREATE UNIQUE INDEX "Move_roundId_player_key" ON "Move"("roundId", "player");

CREATE UNIQUE INDEX one_active_match_player_a
ON "Match" ("playerA")
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX one_active_match_player_b
ON "Match" ("playerB")
WHERE status = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
