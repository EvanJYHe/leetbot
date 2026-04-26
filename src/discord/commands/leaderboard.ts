import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { formatBreakdown, getReportSummary } from "../../reports/analytics.js";
import { getPeriodRange, parseReportPeriod } from "../../reports/periods.js";
import type { CommandExecute } from "../types.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top LeetCode solvers.")
  .addStringOption((option) =>
    option
      .setName("period")
      .setDescription("The time period to rank.")
      .addChoices(
        { name: "Week", value: "week" },
        { name: "Month", value: "month" },
        { name: "All time", value: "all_time" }
      )
      .setRequired(false)
  );

export const execute: CommandExecute = async (interaction) => {
  await interaction.deferReply();

  const period = getPeriodRange(parseReportPeriod(interaction.options.getString("period")));
  const summary = await getReportSummary(period);
  const topUsers = summary.users.slice(0, 10);

  const description = topUsers.length
    ? topUsers
        .map(
          (user, index) =>
            `${index + 1}. ${user.discordUsername} - ${user.newSolves} new, ${user.resubmissions} old, ${user.score} pts`
        )
        .join("\n")
    : "No tracked LeetCode activity for this period yet.";

  const embed = new EmbedBuilder()
    .setTitle(`LeetCode Leaderboard - ${period.label}`)
    .setDescription(description)
    .addFields(
      { name: "New solves", value: String(summary.totalNewSolves), inline: true },
      { name: "Resubmissions", value: String(summary.totalResubmissions), inline: true },
      { name: "Accepted submissions", value: String(summary.totalAcceptedSubmissions), inline: true },
      { name: "Difficulty", value: formatBreakdown(summary.difficultyBreakdown) }
    )
    .setFooter({ text: "Points: Easy 1, Medium 2, Hard 3" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
};
