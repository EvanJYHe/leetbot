import type { Client } from "discord.js";
import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { postDailyFailurePing, postWeeklyReport } from "./weekly.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function isScheduledReportWindow(config: AppConfig, now = new Date()): boolean {
  return now.getUTCDay() === config.weeklyReportDay && now.getUTCHours() === config.weeklyReportHourUtc;
}

function isScheduledDailyFailureWindow(config: AppConfig, now = new Date()): boolean {
  return now.getUTCHours() === config.weeklyReportHourUtc;
}

async function maybePostWeeklyReport(client: Client, config: AppConfig): Promise<void> {
  if (!isScheduledReportWindow(config)) {
    return;
  }

  try {
    await postWeeklyReport(client, config);
  } catch (error) {
    logger.error("Failed to post weekly LeetCode report", error, {
      guildId: config.discordGuildId
    });
  }
}

async function maybePostDailyFailurePing(client: Client, config: AppConfig): Promise<void> {
  if (!isScheduledDailyFailureWindow(config)) {
    return;
  }

  try {
    await postDailyFailurePing(client, config);
  } catch (error) {
    logger.error("Failed to post daily LeetCode failure ping", error, {
      guildId: config.discordGuildId
    });
  }
}

export function startWeeklyReportScheduler(client: Client, config: AppConfig): NodeJS.Timeout {
  void maybePostWeeklyReport(client, config);
  void maybePostDailyFailurePing(client, config);

  return setInterval(() => {
    void maybePostWeeklyReport(client, config);
    void maybePostDailyFailurePing(client, config);
  }, CHECK_INTERVAL_MS);
}
