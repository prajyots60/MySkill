-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailymotionConnected" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailymotionInfo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailymotionUserId" TEXT NOT NULL,
    "username" TEXT,
    "screenname" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "profilePictureUrl" TEXT,
    "scope" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailymotionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailymotionInfo_userId_key" ON "DailymotionInfo"("userId");

-- CreateIndex
CREATE INDEX "DailymotionInfo_userId_idx" ON "DailymotionInfo"("userId");

-- AddForeignKey
ALTER TABLE "DailymotionInfo" ADD CONSTRAINT "DailymotionInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
