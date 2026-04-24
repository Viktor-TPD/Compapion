import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getAllCharacters, getCharacterByName, supabase } from "../db";
import bosses from "../../../shared/bosses.json";

function nextBoss(currentCap: number) {
  return bosses
    .filter((b) => b.unlocks_cap > currentCap)
    .sort((a, b) => a.unlocks_cap - b.unlocks_cap)[0] ?? null;
}

async function formatProgress(charName: string, cap: number): Promise<string> {
  const next = nextBoss(cap);
  const nextStr = next
    ? `Next: kill **${next.name}** (${next.zone}) → cap ${next.unlocks_cap}`
    : "Max cap reached!";
  return `**${charName}**: Level cap ${cap}. ${nextStr}`;
}

export const data = new SlashCommandBuilder()
  .setName("progress")
  .setDescription("Show level cap progress for a player")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player", true);
  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
  return interaction.editReply(await formatProgress(char.name, char.level_cap));
}
