-- AlterTable
ALTER TABLE "CreatorProfile" ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "resourcesDescription" TEXT,
ADD COLUMN     "showResources" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "themeColor" SET DEFAULT 'default',
ALTER COLUMN "languages" DROP DEFAULT,
ALTER COLUMN "expertise" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "CreatorProfile_userId_idx" ON "CreatorProfile"("userId");
