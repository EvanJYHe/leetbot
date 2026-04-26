import { TrackedEventKind, type TrackedEvent, type User } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { PeriodRange } from "./periods.js";

type EventWithUser = TrackedEvent & { user: Pick<User, "discordUsername"> };

export interface UserReportSummary {
  discordUserId: string;
  discordUsername: string;
  newSolves: number;
  resubmissions: number;
  acceptedSubmissions: number;
  score: number;
  difficultyBreakdown: Record<string, number>;
  languageBreakdown: Record<string, number>;
  latestEvent: EventWithUser | null;
}

export interface ReportSummary {
  period: PeriodRange;
  users: UserReportSummary[];
  totalNewSolves: number;
  totalResubmissions: number;
  totalAcceptedSubmissions: number;
  difficultyBreakdown: Record<string, number>;
  languageBreakdown: Record<string, number>;
}

const difficultyScore: Record<string, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3
};

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function scoreForDifficulty(difficulty: string | null): number {
  return difficultyScore[difficulty ?? ""] ?? 1;
}

function createEmptyUserSummary(event: EventWithUser): UserReportSummary {
  return {
    discordUserId: event.discordUserId,
    discordUsername: event.user.discordUsername,
    newSolves: 0,
    resubmissions: 0,
    acceptedSubmissions: 0,
    score: 0,
    difficultyBreakdown: {},
    languageBreakdown: {},
    latestEvent: null
  };
}

export async function getReportEvents(period: PeriodRange, discordUserId?: string): Promise<EventWithUser[]> {
  return prisma.trackedEvent.findMany({
    where: {
      ...(discordUserId ? { discordUserId } : {}),
      ...(period.start
        ? {
            occurredAt: {
              gte: period.start,
              lt: period.end
            }
          }
        : {})
    },
    include: {
      user: {
        select: {
          discordUsername: true
        }
      }
    },
    orderBy: {
      occurredAt: "desc"
    }
  });
}

export function summarizeEvents(period: PeriodRange, events: EventWithUser[]): ReportSummary {
  const summariesByUser = new Map<string, UserReportSummary>();
  const difficultyBreakdown: Record<string, number> = {};
  const languageBreakdown: Record<string, number> = {};

  for (const event of events) {
    const summary = summariesByUser.get(event.discordUserId) ?? createEmptyUserSummary(event);
    summariesByUser.set(event.discordUserId, summary);

    summary.acceptedSubmissions += 1;

    if (event.kind === TrackedEventKind.NEW_SOLVE) {
      summary.newSolves += 1;
      summary.score += scoreForDifficulty(event.difficulty);
    } else {
      summary.resubmissions += 1;
    }

    increment(summary.difficultyBreakdown, event.difficulty ?? "Unknown");
    increment(difficultyBreakdown, event.difficulty ?? "Unknown");

    if (event.language) {
      increment(summary.languageBreakdown, event.language);
      increment(languageBreakdown, event.language);
    }

    if (!summary.latestEvent || event.occurredAt > summary.latestEvent.occurredAt) {
      summary.latestEvent = event;
    }
  }

  const users = [...summariesByUser.values()].sort((left, right) => {
    if (right.newSolves !== left.newSolves) {
      return right.newSolves - left.newSolves;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.resubmissions - left.resubmissions;
  });

  return {
    period,
    users,
    totalNewSolves: users.reduce((sum, user) => sum + user.newSolves, 0),
    totalResubmissions: users.reduce((sum, user) => sum + user.resubmissions, 0),
    totalAcceptedSubmissions: users.reduce((sum, user) => sum + user.acceptedSubmissions, 0),
    difficultyBreakdown,
    languageBreakdown
  };
}

export async function getReportSummary(period: PeriodRange, discordUserId?: string): Promise<ReportSummary> {
  const events = await getReportEvents(period, discordUserId);
  return summarizeEvents(period, events);
}

export function formatBreakdown(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown).sort((left, right) => right[1] - left[1]);

  if (entries.length === 0) {
    return "None";
  }

  return entries.map(([label, count]) => `${label}: ${count}`).join(", ");
}
