import { EmbedBuilder, type Client, type GuildTextBasedChannel } from "discord.js";
import type { AppConfig } from "../config.js";
import { prisma } from "../db/prisma.js";
import { getOrCreateGuildConfig } from "../leetcode/polling.js";
import { logger } from "../utils/logger.js";
import { formatBreakdown, getReportSummary } from "./analytics.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyWindow {
  weekStart: Date;
  weekEnd: Date;
}

export interface DailyFailureWindow {
  dayStart: Date;
  dayEnd: Date;
}

export function getWeeklyWindow(config: AppConfig, now = new Date()): WeeklyWindow {
  const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), config.weeklyReportHourUtc));
  const daysSinceReportDay = (weekEnd.getUTCDay() - config.weeklyReportDay + 7) % 7;
  weekEnd.setUTCDate(weekEnd.getUTCDate() - daysSinceReportDay);

  if (weekEnd > now) {
    weekEnd.setUTCDate(weekEnd.getUTCDate() - 7);
  }

  return {
    weekStart: new Date(weekEnd.getTime() - WEEK_MS),
    weekEnd
  };
}

export function getDailyFailureWindow(config: AppConfig, now = new Date()): DailyFailureWindow {
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), config.weeklyReportHourUtc));

  if (dayEnd > now) {
    dayEnd.setUTCDate(dayEnd.getUTCDate() - 1);
  }

  return {
    dayStart: new Date(dayEnd.getTime() - DAY_MS),
    dayEnd
  };
}

async function getPostChannel(client: Client, config: AppConfig): Promise<GuildTextBasedChannel | null> {
  const guildConfig = await getOrCreateGuildConfig(config);
  const guild = await client.guilds.fetch(config.discordGuildId);
  const channel = await guild.channels.fetch(guildConfig.postChannelId);

  if (!channel?.isTextBased()) {
    logger.warn("Weekly report channel is not text-based", {
      channelId: guildConfig.postChannelId
    });
    return null;
  }

  return channel as GuildTextBasedChannel;
}

async function getFailureChannel(client: Client, config: AppConfig): Promise<GuildTextBasedChannel | null> {
  const guildConfig = await getOrCreateGuildConfig(config);

  if (!guildConfig.failureChannelId) {
    return null;
  }

  const guild = await client.guilds.fetch(config.discordGuildId);
  const channel = await guild.channels.fetch(guildConfig.failureChannelId);

  if (!channel?.isTextBased()) {
    logger.warn("Weekly failure channel is not text-based", {
      channelId: guildConfig.failureChannelId
    });
    return null;
  }

  return channel as GuildTextBasedChannel;
}

async function getUsersWithoutActivity(window: { dayStart?: Date; weekStart?: Date; dayEnd?: Date; weekEnd?: Date }) {
  const start = window.dayStart ?? window.weekStart;
  const end = window.dayEnd ?? window.weekEnd;

  if (!start || !end) {
    throw new Error("Missing activity window bounds");
  }

  const [trackedUsers, activeEvents] = await Promise.all([
    prisma.user.findMany({
      orderBy: {
        discordUsername: "asc"
      }
    }),
    prisma.trackedEvent.findMany({
      where: {
        occurredAt: {
          gte: start,
          lt: end
        }
      },
      select: {
        discordUserId: true
      },
      distinct: ["discordUserId"]
    })
  ]);
  const activeDiscordUserIds = new Set(activeEvents.map((event) => event.discordUserId));

  return trackedUsers.filter((user) => !activeDiscordUserIds.has(user.discordUserId));
}

export async function postDailyFailurePing(client: Client, config: AppConfig, now = new Date()): Promise<boolean> {
  const window = getDailyFailureWindow(config, now);
  const existingRun = await prisma.dailyFailurePingRun.findUnique({
    where: {
      guildId_dayStart: {
        guildId: config.discordGuildId,
        dayStart: window.dayStart
      }
    }
  });

  if (existingRun) {
    return false;
  }

  const failureChannel = await getFailureChannel(client, config);

  if (!failureChannel) {
    return false;
  }

  const inactiveUsers = await getUsersWithoutActivity(window);

  if (inactiveUsers.length > 0) {
    const mentions = inactiveUsers.map((user) => `<@${user.discordUserId}>`).join(" ");
    await failureChannel.send({
      content: [
        `Daily LeetCode check-in: ${mentions}`,
        "No accepted LeetCode submissions were tracked for you in the last day."
      ].join("\n"),
      allowedMentions: {
        users: inactiveUsers.map((user) => user.discordUserId)
      }
    });
  }

  await prisma.dailyFailurePingRun.create({
    data: {
      guildId: config.discordGuildId,
      dayStart: window.dayStart,
      dayEnd: window.dayEnd
    }
  });

  logger.info("Processed daily LeetCode failure ping", {
    guildId: config.discordGuildId,
    dayStart: window.dayStart.toISOString(),
    dayEnd: window.dayEnd.toISOString(),
    inactiveUserCount: inactiveUsers.length
  });

  return inactiveUsers.length > 0;
}

export async function buildWeeklyReportEmbeds(config: AppConfig, window = getWeeklyWindow(config)): Promise<EmbedBuilder[]> {
  const summary = await getReportSummary({
    period: "week",
    label: "Weekly recap",
    start: window.weekStart,
    end: window.weekEnd
  });
  const topUsers = summary.users.slice(0, 10);
  const leaderboard = topUsers.length
    ? topUsers
        .map(
          (user, index) =>
            `${index + 1}. ${user.discordUsername} - ${user.newSolves} new, ${user.resubmissions} old, ${user.score} pts`
        )
        .join("\n")
    : "No tracked LeetCode activity this week.";

  const serverEmbed = new EmbedBuilder()
    .setTitle("Weekly LeetCode Recap")
    .setDescription(`${window.weekStart.toISOString()} to ${window.weekEnd.toISOString()}`)
    .addFields(
      { name: "New solves", value: String(summary.totalNewSolves), inline: true },
      { name: "Resubmissions", value: String(summary.totalResubmissions), inline: true },
      { name: "Accepted submissions", value: String(summary.totalAcceptedSubmissions), inline: true },
      { name: "Top 10", value: leaderboard },
      { name: "Difficulty", value: formatBreakdown(summary.difficultyBreakdown) },
      { name: "Languages", value: formatBreakdown(summary.languageBreakdown) }
    )
    .setFooter({ text: "Weekly report" })
    .setTimestamp(window.weekEnd);

  const userLines = summary.users
    .slice(0, 15)
    .map(
      (user) =>
        `${user.discordUsername}: ${user.newSolves} new, ${user.resubmissions} old, ${user.acceptedSubmissions} accepted`
    );

  if (userLines.length === 0) {
    return [serverEmbed];
  }

  const userEmbed = new EmbedBuilder()
    .setTitle("Per-user Summary")
    .setDescription(userLines.join("\n"))
    .setFooter({ text: "Stats count activity observed by the bot." })
    .setTimestamp(window.weekEnd);

  return [serverEmbed, userEmbed];
}

export async function postWeeklyReport(client: Client, config: AppConfig, now = new Date()): Promise<boolean> {
  const window = getWeeklyWindow(config, now);
  const existingRun = await prisma.weeklyReportRun.findUnique({
    where: {
      guildId_weekStart: {
        guildId: config.discordGuildId,
        weekStart: window.weekStart
      }
    }
  });

  if (existingRun) {
    return false;
  }

  const channel = await getPostChannel(client, config);

  if (!channel) {
    return false;
  }

  const embeds = await buildWeeklyReportEmbeds(config, window);
  await channel.send({ embeds });

  await prisma.weeklyReportRun.create({
    data: {
      guildId: config.discordGuildId,
      weekStart: window.weekStart,
      weekEnd: window.weekEnd
    }
  });

  logger.info("Posted weekly LeetCode report", {
    guildId: config.discordGuildId,
    weekStart: window.weekStart.toISOString(),
    weekEnd: window.weekEnd.toISOString()
  });

  return true;
}
