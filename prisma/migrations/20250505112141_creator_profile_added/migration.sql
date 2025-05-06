/*
  Warnings:

  - You are about to drop the `DevToolsViolation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DevToolsViolation" DROP CONSTRAINT "DevToolsViolation_contentId_fkey";

-- DropForeignKey
ALTER TABLE "DevToolsViolation" DROP CONSTRAINT "DevToolsViolation_userId_fkey";

-- DropTable
DROP TABLE "DevToolsViolation";

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customTitle" TEXT,
    "tagline" TEXT,
    "themeColor" TEXT DEFAULT 'purple',
    "location" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsTeaching" TEXT,
    "education" TEXT,
    "achievements" TEXT,
    "institutionName" TEXT,
    "institutionDescription" TEXT,
    "institutionWebsite" TEXT,
    "coverImage" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "badges" JSONB,
    "milestones" JSONB,
    "testimonials" JSONB,
    "customSections" JSONB,
    "resources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
