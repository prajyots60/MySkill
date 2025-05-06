-- AlterTable
ALTER TABLE "User" ADD COLUMN     "driveConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "driveConnectedAt" TIMESTAMP(3),
ADD COLUMN     "driveEmail" TEXT,
ADD COLUMN     "driveQuota" JSONB;
