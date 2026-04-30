-- CreateTable
CREATE TABLE "DailyFailurePingRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "dayStart" TIMESTAMP(3) NOT NULL,
    "dayEnd" TIMESTAMP(3) NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyFailurePingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyFailurePingRun_guildId_idx" ON "DailyFailurePingRun"("guildId");

-- CreateIndex
CREATE INDEX "DailyFailurePingRun_dayStart_idx" ON "DailyFailurePingRun"("dayStart");

-- CreateIndex
CREATE UNIQUE INDEX "DailyFailurePingRun_guildId_dayStart_key" ON "DailyFailurePingRun"("guildId", "dayStart");
