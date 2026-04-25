-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "leetcodeUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvedProblem" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "difficulty" TEXT,
    "firstSolvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeenSubmission" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "problemSlug" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "language" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeenSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "postChannelId" TEXT NOT NULL,
    "pollIntervalMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_leetcodeUsername_key" ON "User"("leetcodeUsername");

-- CreateIndex
CREATE INDEX "User_leetcodeUsername_idx" ON "User"("leetcodeUsername");

-- CreateIndex
CREATE INDEX "SolvedProblem_discordUserId_idx" ON "SolvedProblem"("discordUserId");

-- CreateIndex
CREATE INDEX "SolvedProblem_problemSlug_idx" ON "SolvedProblem"("problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SolvedProblem_discordUserId_problemSlug_key" ON "SolvedProblem"("discordUserId", "problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SeenSubmission_submissionId_key" ON "SeenSubmission"("submissionId");

-- CreateIndex
CREATE INDEX "SeenSubmission_discordUserId_idx" ON "SeenSubmission"("discordUserId");

-- CreateIndex
CREATE INDEX "SeenSubmission_submittedAt_idx" ON "SeenSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "SeenSubmission_problemSlug_idx" ON "SeenSubmission"("problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- AddForeignKey
ALTER TABLE "SolvedProblem" ADD CONSTRAINT "SolvedProblem_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeenSubmission" ADD CONSTRAINT "SeenSubmission_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User"("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE;
