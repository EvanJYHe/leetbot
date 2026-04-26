import "dotenv/config";

export interface AppConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  discordChannelId: string;
  databaseUrl: string;
  leetcodePollIntervalMinutes: number;
  weeklyReportDay: number;
  weeklyReportHourUtc: number;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePollInterval(value: string | undefined): number {
  const parsed = Number(value ?? "5");

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("LEETCODE_POLL_INTERVAL_MINUTES must be a positive number");
  }

  return parsed;
}

function parseIntegerEnv(name: string, value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? String(fallback));

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    discordToken: requiredEnv("DISCORD_TOKEN"),
    discordClientId: requiredEnv("DISCORD_CLIENT_ID"),
    discordGuildId: requiredEnv("DISCORD_GUILD_ID"),
    discordChannelId: requiredEnv("DISCORD_CHANNEL_ID"),
    databaseUrl: requiredEnv("DATABASE_URL"),
    leetcodePollIntervalMinutes: parsePollInterval(process.env.LEETCODE_POLL_INTERVAL_MINUTES),
    weeklyReportDay: parseIntegerEnv("WEEKLY_REPORT_DAY", process.env.WEEKLY_REPORT_DAY, 0, 0, 6),
    weeklyReportHourUtc: parseIntegerEnv("WEEKLY_REPORT_HOUR_UTC", process.env.WEEKLY_REPORT_HOUR_UTC, 12, 0, 23)
  };
}
