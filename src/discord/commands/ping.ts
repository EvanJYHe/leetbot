import { SlashCommandBuilder } from "discord.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder().setName("ping").setDescription("Check whether the bot is alive.");

export const execute: CommandExecute = async (interaction) => {
  await interaction.reply({ content: "Pong", ephemeral: true });
};
