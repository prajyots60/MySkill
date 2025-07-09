-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'HIDDEN');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUsages" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token");

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
