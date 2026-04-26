import type { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";
import * as leaderboard from "./leaderboard.js";
import * as ping from "./ping.js";
import * as setChannel from "./setChannel.js";
import * as status from "./status.js";
import * as stats from "./stats.js";
import * as sync from "./sync.js";
import * as track from "./track.js";
import type { CommandExecute } from "../types.js";

type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;

export interface CommandDefinition {
  data: CommandData;
  execute: CommandExecute;
}

export const commands: CommandDefinition[] = [ping, track, status, sync, leaderboard, stats, setChannel];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
