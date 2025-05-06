-- CreateTable
CREATE TABLE "DriveFolderPath" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "DriveFolderPath_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveFolderPath_path_key" ON "DriveFolderPath"("path");

-- CreateIndex
CREATE INDEX "DriveFolderPath_path_idx" ON "DriveFolderPath"("path");

-- CreateIndex
CREATE INDEX "DriveFolderPath_folderId_idx" ON "DriveFolderPath"("folderId");

-- CreateIndex
CREATE INDEX "DriveFolderPath_createdById_idx" ON "DriveFolderPath"("createdById");

-- AddForeignKey
ALTER TABLE "DriveFolderPath" ADD CONSTRAINT "DriveFolderPath_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
