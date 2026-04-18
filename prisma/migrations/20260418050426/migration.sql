-- AddForeignKey
ALTER TABLE "ChatMail" ADD CONSTRAINT "ChatMail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMail" ADD CONSTRAINT "ChatMail_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("providerId") ON DELETE CASCADE ON UPDATE CASCADE;
