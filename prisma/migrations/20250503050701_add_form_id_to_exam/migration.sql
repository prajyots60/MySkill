/*
  Warnings:

  - You are about to drop the column `formUrl` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `responseSheetId` on the `Exam` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[formId]` on the table `Exam` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "formUrl",
DROP COLUMN "responseSheetId",
ADD COLUMN     "allowReview" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "formId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Exam_formId_key" ON "Exam"("formId");
