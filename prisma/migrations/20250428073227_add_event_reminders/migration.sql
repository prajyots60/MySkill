-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReminder_userId_idx" ON "EventReminder"("userId");

-- CreateIndex
CREATE INDEX "EventReminder_lectureId_idx" ON "EventReminder"("lectureId");

-- CreateIndex
CREATE INDEX "EventReminder_reminderSent_idx" ON "EventReminder"("reminderSent");

-- CreateIndex
CREATE UNIQUE INDEX "EventReminder_userId_lectureId_key" ON "EventReminder"("userId", "lectureId");

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
