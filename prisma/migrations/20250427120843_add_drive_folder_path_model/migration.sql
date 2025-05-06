/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `DriveFolderPath` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CourseResource_storageType_idx";

-- DropIndex
DROP INDEX "DriveFolderPath_folderId_idx";

-- DropIndex
DROP INDEX "DriveFolderPath_path_idx";

-- AlterTable
ALTER TABLE "DriveFolderPath" DROP COLUMN "updatedAt";
