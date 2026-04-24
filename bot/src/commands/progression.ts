import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getAllCharacters } from "../db";
import bosses from "../../../shared/bosses.json";

function nextBoss(cap: number) {
  return bosses
    .filter((b) => b.unlocks_cap > cap)
    .sort((a, b) => a.unlocks_cap - b.unlocks_cap)[0] ?? null;
}

export const data = new SlashCommandBuilder()
  .setName("progression")
  .setDescription("Show all characters grouped by their current level cap");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const chars = await getAllCharacters();
  if (!chars.length) return interaction.editReply("No characters found.");

  // Group by level_cap
  const groups: Record<number, string[]> = {};
  for (const c of chars) {
    if (!groups[c.level_cap]) groups[c.level_cap] = [];
    groups[c.level_cap].push(c.name);
  }

  const lines: string[] = [];
  for (const [capStr, names] of Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    const cap = Number(capStr);
    const next = nextBoss(cap);
    const nextStr = next ? `Next boss: **${next.name}** → cap ${next.unlocks_cap}` : "Max cap";
    lines.push(`**Cap ${cap}**: ${names.join(", ")} — ${nextStr}`);
  }

  return interaction.editReply(lines.join("\n"));
}
