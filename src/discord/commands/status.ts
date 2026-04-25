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
  const seenSubmissionCount = await prisma.seenSubmission.count({
    where: { discordUserId: interaction.user.id }
  });
  const authenticatedLeetCodeUsername = process.env.LEETCODE_USERNAME?.trim().toLowerCase();
  const trackingUsesAuthenticatedHistory =
    Boolean(process.env.LEETCODE_SESSION && process.env.LEETCODE_CSRF_TOKEN) &&
    authenticatedLeetCodeUsername === user.leetcodeUsername.toLowerCase();

  const lastSeenText = lastSeenSubmission
    ? `${lastSeenSubmission.problemTitle} (${lastSeenSubmission.language ?? "Unknown"}) at ${lastSeenSubmission.submittedAt.toISOString()}`
    : "None";

  await interaction.editReply(
    [
      `Discord user: ${interaction.user.username}`,
      `LeetCode username: ${user.leetcodeUsername}`,
      `Known solved problems: ${knownSolvedCount}`,
      `Seen accepted submissions: ${seenSubmissionCount}`,
      `Last seen submission: ${lastSeenText}`,
      `History mode: ${trackingUsesAuthenticatedHistory ? "authenticated full-history seed" : "public recent-submissions seed"}`,
      `Polling interval: ${guildConfig.pollIntervalMinutes} minute(s)`,
      `Posting channel: <#${guildConfig.postChannelId}>`,
      "Use `/sync` to check recent accepted submissions immediately."
    ].join("\n")
  );
};
