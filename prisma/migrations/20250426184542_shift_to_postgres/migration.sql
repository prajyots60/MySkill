-- AlterTable
ALTER TABLE "User" ADD COLUMN     "youtubeChannelId" TEXT,
ADD COLUMN     "youtubeChannelName" TEXT,
ADD COLUMN     "youtubeConnectedAt" TIMESTAMP(3),
ADD COLUMN     "youtubeThumbnailUrl" TEXT;
