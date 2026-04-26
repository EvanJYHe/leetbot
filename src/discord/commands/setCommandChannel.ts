import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("set-command-channel")
  .setDescription("Set the channel where bot commands should be used.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel for bot commands.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  );

export const execute: CommandExecute = async (interaction, context) => {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need Manage Server permission to set the command channel.", ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  await prisma.guildConfig.upsert({
    where: { guildId: context.config.discordGuildId },
    create: {
      guildId: context.config.discordGuildId,
      postChannelId: context.config.discordChannelId,
      commandChannelId: channel.id,
      pollIntervalMinutes: context.config.leetcodePollIntervalMinutes
    },
    update: {
      commandChannelId: channel.id
    }
  });

  await interaction.reply({
    content: `Bot commands should now be used in <#${channel.id}>. LeetCode posts will still go to the configured posting channel.`,
    ephemeral: true
  });
};
