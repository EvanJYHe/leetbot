import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import { processTrackedUser } from "../../leetcode/polling.js";
import { logger } from "../../utils/logger.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("sync")
  .setDescription("Immediately check your LeetCode account for new solves.");

export const execute: CommandExecute = async (interaction, context) => {
  await interaction.deferReply({ ephemeral: true });

  const user = await prisma.user.findUnique({
    where: { discordUserId: interaction.user.id }
  });

  if (!user) {
    await interaction.editReply("You are not tracking a LeetCode username yet. Run `/track <leetcode_username>` first.");
    return;
  }

  try {
    const result = await processTrackedUser({
      user,
      client: context.client,
      config: context.config,
      shouldPost: true
    });

    if (result.postedCount === 0) {
      await interaction.editReply("No new solves found.");
      return;
    }

    await interaction.editReply(`Posted ${result.postedCount} new solve(s).`);
  } catch (error) {
    logger.error("Manual LeetCode sync failed", error, {
      discordUserId: interaction.user.id
    });
    await interaction.editReply("Sync failed. The bot is still running; please try again later.");
  }
};
