-- CreateEnum
CREATE TYPE "TrackedEventKind" AS ENUM ('NEW_SOLVE', 'RESUBMISSION');

-- CreateTable
CREATE TABLE "TrackedEvent" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "difficulty" TEXT,
    "language" TEXT,
    "submissionId" TEXT NOT NULL,
    "kind" "TrackedEventKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReportRun" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedEvent_submissionId_key" ON "TrackedEvent"("submissionId");

-- CreateIndex
CREATE INDEX "TrackedEvent_discordUserId_idx" ON "TrackedEvent"("discordUserId");

-- CreateIndex
CREATE INDEX "TrackedEvent_occurredAt_idx" ON "TrackedEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "TrackedEvent_kind_idx" ON "TrackedEvent"("kind");

-- CreateIndex
CREATE INDEX "TrackedEvent_problemSlug_idx" ON "TrackedEvent"("problemSlug");

-- CreateIndex
CREATE INDEX "WeeklyReportRun_guildId_idx" ON "WeeklyReportRun"("guildId");

-- CreateIndex
CREATE INDEX "WeeklyReportRun_weekStart_idx" ON "WeeklyReportRun"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportRun_guildId_weekStart_key" ON "WeeklyReportRun"("guildId", "weekStart");

-- AddForeignKey
ALTER TABLE "TrackedEvent" ADD CONSTRAINT "TrackedEvent_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE;
