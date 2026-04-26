import { REST, Routes } from "discord.js";
import { type AppConfig, loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { commands } from "./commands/index.js";

export async function registerCommands(config: AppConfig = loadConfig()): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const commandPayload = commands.map((command) => command.data.toJSON());

  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), {
    body: commandPayload
  });

  logger.info("Registered guild slash commands", {
    guildId: config.discordGuildId,
    commandCount: commandPayload.length
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  registerCommands().catch((error: unknown) => {
    logger.error("Failed to register slash commands", error);
    process.exit(1);
  });
}
