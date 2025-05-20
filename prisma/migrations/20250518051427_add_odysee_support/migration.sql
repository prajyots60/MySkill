-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('YOUTUBE', 'ODYSEE');

-- AlterTable
ALTER TABLE "Lecture" ADD COLUMN     "claimId" TEXT,
ADD COLUMN     "claimName" TEXT,
ADD COLUMN     "videoSource" "VideoSource" DEFAULT 'YOUTUBE';
