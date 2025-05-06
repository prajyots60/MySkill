/*
  Warnings:

  - You are about to drop the `CourseResource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DriveFolderPath` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourseResource" DROP CONSTRAINT "CourseResource_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CourseResource" DROP CONSTRAINT "CourseResource_createdById_fkey";

-- DropForeignKey
ALTER TABLE "CourseResource" DROP CONSTRAINT "CourseResource_lectureId_fkey";

-- DropForeignKey
ALTER TABLE "CourseResource" DROP CONSTRAINT "CourseResource_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "DriveFolderPath" DROP CONSTRAINT "DriveFolderPath_createdById_fkey";

-- DropTable
DROP TABLE "CourseResource";

-- DropTable
DROP TABLE "DriveFolderPath";

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT,
    "lectureId" TEXT,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_courseId_idx" ON "Resource"("courseId");

-- CreateIndex
CREATE INDEX "Resource_sectionId_idx" ON "Resource"("sectionId");

-- CreateIndex
CREATE INDEX "Resource_lectureId_idx" ON "Resource"("lectureId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
