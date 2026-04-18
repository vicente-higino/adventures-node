/*
  Warnings:

  - A unique constraint covering the columns `[mailCode]` on the table `ChatMail` will be added. If there are existing duplicate values, this will fail.
  - The required column `mailCode` was added to the `ChatMail` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "ChatMail" ADD COLUMN     "mailCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChatMail_mailCode_key" ON "ChatMail"("mailCode");
