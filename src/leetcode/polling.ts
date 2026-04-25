import type { User } from "@prisma/client";
import type { Client, GuildTextBasedChannel } from "discord.js";
import type { AppConfig } from "../config.js";
import { prisma } from "../db/prisma.js";
import { createSolveEmbed } from "../utils/embeds.js";
import { logger } from "../utils/logger.js";
import { getAcceptedSubmissions, getProblemDetails, getRecentSubmissions, getUserSolvedProblems } from "./client.js";
import type { LeetCodeSubmission } from "./types.js";

interface TrackingSeedResult {
  user: User;
  solvedProblemCount: number;
  seenSubmissionCount: number;
}

interface ProcessUserResult {
  postedCount: number;
  checkedAcceptedCount: number;
}

type SubmissionDecision =
  | { kind: "duplicate" }
  | { kind: "resubmission" }
  | { kind: "newSolve"; difficulty: string | null };

export async function getOrCreateGuildConfig(config: AppConfig) {
  return prisma.guildConfig.upsert({
    where: { guildId: config.discordGuildId },
    create: {
      guildId: config.discordGuildId,
      postChannelId: config.discordChannelId,
      pollIntervalMinutes: config.leetcodePollIntervalMinutes
    },
    update: {}
  });
}

export async function initializeTracking(params: {
  discordUserId: string;
  discordUsername: string;
  leetcodeUsername: string;
}): Promise<TrackingSeedResult> {
  const [solvedProblems, acceptedSubmissions] = await Promise.all([
    getUserSolvedProblems(params.leetcodeUsername),
    getAcceptedSubmissions(params.leetcodeUsername, 100)
  ]);

  const user = await prisma.user.upsert({
    where: { discordUserId: params.discordUserId },
    create: {
      discordUserId: params.discordUserId,
      discordUsername: params.discordUsername,
      leetcodeUsername: params.leetcodeUsername
    },
    update: {
      discordUsername: params.discordUsername,
      leetcodeUsername: params.leetcodeUsername
    }
  });

  await prisma.solvedProblem.createMany({
    data: solvedProblems.map((problem) => ({
      discordUserId: params.discordUserId,
      problemSlug: problem.problemSlug,
      problemTitle: problem.problemTitle,
      difficulty: problem.difficulty,
      firstSolvedAt: problem.firstSolvedAt
    })),
    skipDuplicates: true
  });

  await prisma.seenSubmission.createMany({
    data: acceptedSubmissions.map((submission) => ({
      submissionId: submission.submissionId,
      discordUserId: params.discordUserId,
      problemSlug: submission.problemSlug,
      problemTitle: submission.problemTitle,
      status: submission.status,
      language: submission.language,
      submittedAt: submission.submittedAt
    })),
    skipDuplicates: true
  });

  return {
    user,
    solvedProblemCount: await prisma.solvedProblem.count({ where: { discordUserId: params.discordUserId } }),
    seenSubmissionCount: await prisma.seenSubmission.count({ where: { discordUserId: params.discordUserId } })
  };
}

async function getPostChannel(client: Client, config: AppConfig): Promise<GuildTextBasedChannel | null> {
  const guildConfig = await getOrCreateGuildConfig(config);
  const guild = await client.guilds.fetch(config.discordGuildId);
  const channel = await guild.channels.fetch(guildConfig.postChannelId);

  if (!channel?.isTextBased()) {
    logger.warn("Configured Discord channel is not text-based", {
      channelId: guildConfig.postChannelId
    });
    return null;
  }

  return channel as GuildTextBasedChannel;
}

async function saveSubmissionDecision(user: User, submission: LeetCodeSubmission): Promise<SubmissionDecision> {
  return prisma.$transaction(async (tx) => {
    const seenSubmission = await tx.seenSubmission.findUnique({
      where: { submissionId: submission.submissionId }
    });

    if (seenSubmission) {
      return { kind: "duplicate" };
    }

    const solvedProblem = await tx.solvedProblem.findUnique({
      where: {
        discordUserId_problemSlug: {
          discordUserId: user.discordUserId,
          problemSlug: submission.problemSlug
        }
      }
    });

    await tx.seenSubmission.create({
      data: {
        submissionId: submission.submissionId,
        discordUserId: user.discordUserId,
        problemSlug: submission.problemSlug,
        problemTitle: submission.problemTitle,
        status: submission.status,
        language: submission.language,
        submittedAt: submission.submittedAt
      }
    });

    if (solvedProblem) {
      return { kind: "resubmission" };
    }

    const problemDetails = await getProblemDetails(submission.problemSlug);
    const difficulty = problemDetails?.difficulty ?? null;

    await tx.solvedProblem.create({
      data: {
        discordUserId: user.discordUserId,
        problemSlug: submission.problemSlug,
        problemTitle: problemDetails?.problemTitle ?? submission.problemTitle,
        difficulty,
        firstSolvedAt: submission.submittedAt
      }
    });

    return { kind: "newSolve", difficulty };
  });
}

export async function processTrackedUser(params: {
  user: User;
  client: Client;
  config: AppConfig;
  shouldPost: boolean;
}): Promise<ProcessUserResult> {
  const acceptedSubmissions = await getAcceptedSubmissions(params.user.leetcodeUsername);
  const sortedAcceptedSubmissions = [...acceptedSubmissions].sort(
    (left, right) => left.submittedAt.getTime() - right.submittedAt.getTime()
  );

  const postChannel = params.shouldPost ? await getPostChannel(params.client, params.config) : null;
  let postedCount = 0;

  for (const submission of sortedAcceptedSubmissions) {
    try {
      const decision = await saveSubmissionDecision(params.user, submission);

      if (decision.kind !== "newSolve") {
        continue;
      }

      if (!postChannel) {
        logger.warn("New solve saved but no post channel was available", {
          discordUserId: params.user.discordUserId,
          problemSlug: submission.problemSlug
        });
        continue;
      }

      await postChannel.send({
        embeds: [
          createSolveEmbed({
            discordUsername: params.user.discordUsername,
            submission,
            difficulty: decision.difficulty
          })
        ]
      });
      postedCount += 1;
    } catch (error) {
      logger.error("Failed to process accepted LeetCode submission", error, {
        discordUserId: params.user.discordUserId,
        submissionId: submission.submissionId
      });
    }
  }

  return {
    postedCount,
    checkedAcceptedCount: sortedAcceptedSubmissions.length
  };
}

export async function pollTrackedUsers(client: Client, config: AppConfig): Promise<void> {
  const trackedUsers = await prisma.user.findMany();

  for (const user of trackedUsers) {
    try {
      await processTrackedUser({ user, client, config, shouldPost: true });
    } catch (error) {
      logger.error("Failed to poll tracked LeetCode user", error, {
        discordUserId: user.discordUserId,
        leetcodeUsername: user.leetcodeUsername
      });
    }
  }
}

export function startPolling(client: Client, config: AppConfig): NodeJS.Timeout {
  const intervalMs = config.leetcodePollIntervalMinutes * 60 * 1000;

  void pollTrackedUsers(client, config);

  return setInterval(() => {
    void pollTrackedUsers(client, config);
  }, intervalMs);
}

export async function getLastSeenSubmission(discordUserId: string) {
  return prisma.seenSubmission.findFirst({
    where: { discordUserId },
    orderBy: { submittedAt: "desc" }
  });
}

export async function refreshRecentSeenSubmissions(username: string): Promise<LeetCodeSubmission[]> {
  return getRecentSubmissions(username);
}
