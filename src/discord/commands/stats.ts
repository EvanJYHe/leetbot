import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../db/prisma.js";
import { formatBreakdown, getReportSummary } from "../../reports/analytics.js";
import { getPeriodRange, parseReportPeriod } from "../../reports/periods.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Show your LeetCode stats.")
  .addStringOption((option) =>
    option
      .setName("period")
      .setDescription("The time period to show.")
      .addChoices(
        { name: "Week", value: "week" },
        { name: "Month", value: "month" },
        { name: "All time", value: "all_time" }
      )
      .setRequired(false)
  );

export const execute: CommandExecute = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  const user = await prisma.user.findUnique({
    where: { discordUserId: interaction.user.id }
  });

  if (!user) {
    await interaction.editReply("You are not tracking a LeetCode username yet. Run `/track <leetcode_username>` first.");
    return;
  }

  const period = getPeriodRange(parseReportPeriod(interaction.options.getString("period")));
  const summary = await getReportSummary(period, interaction.user.id);
  const stats = summary.users[0];

  if (!stats) {
    await interaction.editReply(`No tracked LeetCode activity for ${period.label.toLowerCase()} yet.`);
    return;
  }

  const latest = stats.latestEvent
    ? `${stats.latestEvent.problemTitle} (${stats.latestEvent.kind === "NEW_SOLVE" ? "new" : "old"})`
    : "None";

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s LeetCode Stats - ${period.label}`)
    .addFields(
      { name: "LeetCode", value: user.leetcodeUsername, inline: true },
      { name: "New solves", value: String(stats.newSolves), inline: true },
      { name: "Resubmissions", value: String(stats.resubmissions), inline: true },
      { name: "Accepted submissions", value: String(stats.acceptedSubmissions), inline: true },
      { name: "Score", value: String(stats.score), inline: true },
      { name: "Latest", value: latest },
      { name: "Difficulty", value: formatBreakdown(stats.difficultyBreakdown) },
      { name: "Languages", value: formatBreakdown(stats.languageBreakdown) }
    )
    .setFooter({ text: "Stats count activity observed by the bot." })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
};
