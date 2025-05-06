-- CreateTable
CREATE TABLE "CourseResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "sectionId" TEXT,
    "lectureId" TEXT,
    "createdById" TEXT NOT NULL,
    "storageType" TEXT NOT NULL DEFAULT 'supabase',
    "gdriveId" TEXT,
    "gdriveFolderId" TEXT,
    "folderPath" TEXT,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseResource_courseId_idx" ON "CourseResource"("courseId");

-- CreateIndex
CREATE INDEX "CourseResource_sectionId_idx" ON "CourseResource"("sectionId");

-- CreateIndex
CREATE INDEX "CourseResource_lectureId_idx" ON "CourseResource"("lectureId");

-- CreateIndex
CREATE INDEX "CourseResource_createdById_idx" ON "CourseResource"("createdById");

-- CreateIndex
CREATE INDEX "CourseResource_storageType_idx" ON "CourseResource"("storageType");

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
