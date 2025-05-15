-- CreateTable
CREATE TABLE "DailymotionCredentials" (
    "id" TEXT NOT NULL,
    "dailymotionInfoId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailymotionCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserServiceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserServiceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailymotionCredentials_dailymotionInfoId_key" ON "DailymotionCredentials"("dailymotionInfoId");

-- CreateIndex
CREATE INDEX "DailymotionCredentials_dailymotionInfoId_idx" ON "DailymotionCredentials"("dailymotionInfoId");

-- CreateIndex
CREATE INDEX "UserServiceConnection_userId_idx" ON "UserServiceConnection"("userId");

-- CreateIndex
CREATE INDEX "UserServiceConnection_service_idx" ON "UserServiceConnection"("service");

-- CreateIndex
CREATE UNIQUE INDEX "UserServiceConnection_userId_service_key" ON "UserServiceConnection"("userId", "service");

-- AddForeignKey
ALTER TABLE "DailymotionCredentials" ADD CONSTRAINT "DailymotionCredentials_dailymotionInfoId_fkey" FOREIGN KEY ("dailymotionInfoId") REFERENCES "DailymotionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserServiceConnection" ADD CONSTRAINT "UserServiceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
