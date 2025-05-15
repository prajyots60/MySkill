-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('VIDEO', 'LIVE', 'HYBRID');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "accessDuration" INTEGER,
ADD COLUMN     "courseStatus" "CourseStatus" DEFAULT 'UPCOMING',
ADD COLUMN     "deliveryMode" "DeliveryMode" DEFAULT 'VIDEO',
ADD COLUMN     "languages" TEXT[];
