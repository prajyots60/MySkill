/*
  Warnings:

  - You are about to drop the column `driveConnected` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `driveConnectedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `driveEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `driveQuota` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "driveConnected",
DROP COLUMN "driveConnectedAt",
DROP COLUMN "driveEmail",
DROP COLUMN "driveQuota",
ADD COLUMN     "gdriveConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gdriveConnectedAt" TIMESTAMP(3),
ADD COLUMN     "gdriveEmail" TEXT,
ADD COLUMN     "gdriveName" TEXT,
ADD COLUMN     "gdriveProfileImage" TEXT;
