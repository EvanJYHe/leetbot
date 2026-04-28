import { Client, Events, GatewayIntentBits } from "discord.js";
import type { AppConfig } from "../config.js";
import { getOrCreateGuildConfig } from "../leetcode/polling.js";
import { logger } from "../utils/logger.js";
import { commandMap } from "./commands/index.js";
import type { BotContext } from "./types.js";

const setupCommandNames = new Set(["set-channel", "set-command-channel", "set-failure-channel"]);

async function commandIsAllowedInChannel(commandName: string, channelId: string, config: AppConfig): Promise<boolean> {
  if (setupCommandNames.has(commandName)) {
    return true;
  }

  const guildConfig = await getOrCreateGuildConfig(config);
  return !guildConfig.commandChannelId || guildConfig.commandChannelId === channelId;
}

export function createDiscordClient(config: AppConfig): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }

    const context: BotContext = { client, config };

    try {
      const isAllowedChannel = await commandIsAllowedInChannel(interaction.commandName, interaction.channelId, config);

      if (!isAllowedChannel) {
        const guildConfig = await getOrCreateGuildConfig(config);
        await interaction.reply({
          content: `Please use bot commands in <#${guildConfig.commandChannelId}>.`,
          ephemeral: true
        });
        return;
      }

      await command.execute(interaction, context);
    } catch (error) {
      logger.error("Discord command failed", error, {
        commandName: interaction.commandName,
        discordUserId: interaction.user.id
      });

      const message = "Something went wrong while running that command.";

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });

  return client;
}
