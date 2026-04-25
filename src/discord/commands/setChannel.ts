import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("set-channel")
  .setDescription("Set the channel where LeetCode solves should be posted.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel for solve posts.")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)
  );

export const execute: CommandExecute = async (interaction, context) => {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need Manage Server permission to set the posting channel.", ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  await prisma.guildConfig.upsert({
    where: { guildId: context.config.discordGuildId },
    create: {
      guildId: context.config.discordGuildId,
      postChannelId: channel.id,
      pollIntervalMinutes: context.config.leetcodePollIntervalMinutes
    },
    update: {
      postChannelId: channel.id
    }
  });

  await interaction.reply({
    content: `LeetCode solve posts will now go to <#${channel.id}>.`,
    ephemeral: true
  });
};
