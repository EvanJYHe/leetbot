import "dotenv/config";

export interface AppConfig {
  discordToken: string;
  discordClientId: string;
  discordGuildId: string;
  discordChannelId: string;
  databaseUrl: string;
  leetcodePollIntervalMinutes: number;
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

export function loadConfig(): AppConfig {
  return {
    discordToken: requiredEnv("DISCORD_TOKEN"),
    discordClientId: requiredEnv("DISCORD_CLIENT_ID"),
    discordGuildId: requiredEnv("DISCORD_GUILD_ID"),
    discordChannelId: requiredEnv("DISCORD_CHANNEL_ID"),
    databaseUrl: requiredEnv("DATABASE_URL"),
    leetcodePollIntervalMinutes: parsePollInterval(process.env.LEETCODE_POLL_INTERVAL_MINUTES)
  };
}
