import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("set-failure-channel")
  .setDescription("Set the channel for weekly no-submission pings.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel for weekly no-submission pings.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  );

export const execute: CommandExecute = async (interaction, context) => {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need Manage Server permission to set the failure channel.", ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  await prisma.guildConfig.upsert({
    where: { guildId: context.config.discordGuildId },
    create: {
      guildId: context.config.discordGuildId,
      postChannelId: context.config.discordChannelId,
      commandChannelId: context.config.discordCommandChannelId,
      failureChannelId: channel.id,
      pollIntervalMinutes: context.config.leetcodePollIntervalMinutes
    },
    update: {
      failureChannelId: channel.id
    }
  });

  await interaction.reply({
    content: `Weekly no-submission pings will now go to <#${channel.id}>.`,
    ephemeral: true
  });
};
