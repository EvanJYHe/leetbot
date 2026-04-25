import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import { getLastSeenSubmission, getOrCreateGuildConfig } from "../../leetcode/polling.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show your LeetCode tracking status.");

export const execute: CommandExecute = async (interaction, context) => {
  await interaction.deferReply({ ephemeral: true });

  const user = await prisma.user.findUnique({
    where: { discordUserId: interaction.user.id }
  });

  if (!user) {
    await interaction.editReply("You are not tracking a LeetCode username yet. Run `/track <leetcode_username>` first.");
    return;
  }

  const [knownSolvedCount, lastSeenSubmission, guildConfig] = await Promise.all([
    prisma.solvedProblem.count({ where: { discordUserId: interaction.user.id } }),
    getLastSeenSubmission(interaction.user.id),
    getOrCreateGuildConfig(context.config)
  ]);

  const lastSeenText = lastSeenSubmission
    ? `${lastSeenSubmission.problemTitle} (${lastSeenSubmission.language ?? "Unknown"}) at ${lastSeenSubmission.submittedAt.toISOString()}`
    : "None";

  await interaction.editReply(
    [
      `Discord user: ${interaction.user.username}`,
      `LeetCode username: ${user.leetcodeUsername}`,
      `Known solved problems: ${knownSolvedCount}`,
      `Last seen submission: ${lastSeenText}`,
      `Polling interval: ${guildConfig.pollIntervalMinutes} minute(s)`,
      `Posting channel: <#${guildConfig.postChannelId}>`
    ].join("\n")
  );
};
