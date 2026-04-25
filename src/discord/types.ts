import type { ChatInputCommandInteraction, Client } from "discord.js";
import type { AppConfig } from "../config.js";

export interface BotContext {
  client: Client;
  config: AppConfig;
}

export type CommandExecute = (
  interaction: ChatInputCommandInteraction,
  context: BotContext
) => Promise<void>;
