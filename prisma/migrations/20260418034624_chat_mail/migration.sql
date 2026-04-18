-- CreateTable
CREATE TABLE "ChatMail" (
    "id" BIGSERIAL NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ChatMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX chat_mail_pending_idx ON "ChatMail" ("recipientId", "channelId") WHERE "deliveredAt" IS NULL;