-- AlterEnum
ALTER TYPE "VideoSource" ADD VALUE 'WASABI';

-- AlterTable
ALTER TABLE "Lecture" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "secureMetadata" JSONB;
