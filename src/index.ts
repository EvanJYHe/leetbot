import { loadConfig } from "./config.js";
import { createDiscordClient } from "./discord/client.js";
import { registerCommands } from "./discord/registerCommands.js";
import { prisma } from "./db/prisma.js";
import { getOrCreateGuildConfig, startPolling } from "./leetcode/polling.js";
import { startWeeklyReportScheduler } from "./reports/scheduler.js";
import { logger } from "./utils/logger.js";

const config = loadConfig();
const client = createDiscordClient(config);

async function shutdown(): Promise<void> {
  logger.info("Shutting down");
  await client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

async function main(): Promise<void> {
  if (config.autoDeployCommands) {
    await registerCommands(config);
  }

  await getOrCreateGuildConfig(config);
  await client.login(config.discordToken);
  startPolling(client, config);
  startWeeklyReportScheduler(client, config);
}

main().catch(async (error: unknown) => {
  logger.error("Bot startup failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
