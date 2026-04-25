import { EmbedBuilder } from "discord.js";
import type { LeetCodeSubmission } from "../leetcode/types.js";

const difficultyEmoji: Record<string, string> = {
  Easy: "🟢",
  Medium: "🟡",
  Hard: "🔴"
};

export function createSolveEmbed(params: {
  discordUsername: string;
  submission: LeetCodeSubmission;
  difficulty: string | null;
}): EmbedBuilder {
  const { discordUsername, submission, difficulty } = params;
  const difficultyLabel = difficulty ? `${difficultyEmoji[difficulty] ?? ""} ${difficulty}`.trim() : "Unknown";

  return new EmbedBuilder()
    .setTitle(`✅ New solve: ${submission.problemTitle}`)
    .setURL(`https://leetcode.com/problems/${submission.problemSlug}/`)
    .addFields(
      { name: "User", value: discordUsername, inline: true },
      { name: "Difficulty", value: difficultyLabel, inline: true },
      { name: "Language", value: submission.language ?? "Unknown", inline: true },
      {
        name: "LeetCode",
        value: `https://leetcode.com/problems/${submission.problemSlug}/`
      }
    )
    .setFooter({ text: "LeetCode Tracker" })
    .setTimestamp(submission.submittedAt);
}
