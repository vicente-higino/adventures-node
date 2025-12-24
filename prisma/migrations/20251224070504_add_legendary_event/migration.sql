-- CreateTable
CREATE TABLE "LegendaryEvent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legendaryWeight" INTEGER NOT NULL,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegendaryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegendaryEvent_active_idx" ON "LegendaryEvent"("active");
