import { Prisma } from "@prisma/client";
import { SlashCommandBuilder } from "discord.js";
import { getOrCreateGuildConfig, initializeTracking } from "../../leetcode/polling.js";
import { logger } from "../../utils/logger.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("track")
  .setDescription("Link your Discord account to a LeetCode username.")
  .addStringOption((option) =>
    option
      .setName("leetcode_username")
      .setDescription("The LeetCode username to track.")
      .setRequired(true)
  );

export const execute: CommandExecute = async (interaction, context) => {
  const leetcodeUsername = interaction.options.getString("leetcode_username", true).trim();

  await interaction.deferReply({ ephemeral: true });

  try {
    const [seedResult, guildConfig] = await Promise.all([
      initializeTracking({
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.username,
        leetcodeUsername
      }),
      getOrCreateGuildConfig(context.config)
    ]);

    await interaction.editReply(
      `Tracking ${seedResult.user.leetcodeUsername}. I'll post future new solves in <#${guildConfig.postChannelId}>. Seeded ${seedResult.solvedProblemCount} known solved problems.`
    );
  } catch (error) {
    logger.error("Failed to initialize LeetCode tracking", error, {
      discordUserId: interaction.user.id,
      leetcodeUsername
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await interaction.editReply("That LeetCode username is already linked to another Discord user.");
      return;
    }

    await interaction.editReply("I could not start tracking that LeetCode username. Please try again later.");
  }
};
