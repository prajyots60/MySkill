-- CreateTable
CREATE TABLE "DevToolsViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "warningCount" INTEGER NOT NULL DEFAULT 1,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevToolsViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevToolsViolation_userId_idx" ON "DevToolsViolation"("userId");

-- CreateIndex
CREATE INDEX "DevToolsViolation_contentId_idx" ON "DevToolsViolation"("contentId");

-- CreateIndex
CREATE INDEX "DevToolsViolation_isBanned_idx" ON "DevToolsViolation"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "DevToolsViolation_userId_contentId_key" ON "DevToolsViolation"("userId", "contentId");

-- AddForeignKey
ALTER TABLE "DevToolsViolation" ADD CONSTRAINT "DevToolsViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevToolsViolation" ADD CONSTRAINT "DevToolsViolation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
