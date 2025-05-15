/*
  Warnings:

  - You are about to drop the column `overviewContent` on the `Content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Content" DROP COLUMN "overviewContent",
ADD COLUMN     "richContent" JSONB;
