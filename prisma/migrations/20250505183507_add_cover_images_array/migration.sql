/*
  Warnings:

  - You are about to drop the column `coverImage` on the `CreatorProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CreatorProfile" DROP COLUMN "coverImage",
ADD COLUMN     "coverImages" TEXT[];
