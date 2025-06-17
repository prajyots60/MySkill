/*
  Warnings:

  - A unique constraint covering the columns `[userId,lectureId]` on the table `Bookmark` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "lectureId" TEXT,
ALTER COLUMN "contentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LectureLike" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,

    CONSTRAINT "LectureLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LectureLike_userId_idx" ON "LectureLike"("userId");

-- CreateIndex
CREATE INDEX "LectureLike_lectureId_idx" ON "LectureLike"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "LectureLike_userId_lectureId_key" ON "LectureLike"("userId", "lectureId");

-- CreateIndex
CREATE INDEX "Bookmark_lectureId_idx" ON "Bookmark"("lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_lectureId_key" ON "Bookmark"("userId", "lectureId");

-- CreateIndex
CREATE INDEX "Enrollment_enrolledAt_idx" ON "Enrollment"("enrolledAt");

-- CreateIndex
CREATE INDEX "Enrollment_expiresAt_idx" ON "Enrollment"("expiresAt");

-- CreateIndex
CREATE INDEX "Enrollment_status_idx" ON "Enrollment"("status");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureLike" ADD CONSTRAINT "LectureLike_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LectureLike" ADD CONSTRAINT "LectureLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
