/*
  Warnings:

  - You are about to drop the column `enrolledAt` on the `Enrollment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentId]` on the table `Enrollment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Enrollment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'EXPIRED');

ALTER TABLE "Enrollment"
DROP COLUMN "enrolledAt",
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "paymentId" TEXT,
ADD COLUMN "price" DOUBLE PRECISION,
ADD COLUMN "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_courseId_idx" ON "Payment"("courseId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_paymentId_key" ON "Enrollment"("paymentId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
