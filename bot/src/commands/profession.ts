import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getAllCharacters, getCharacterByName, getProfessions } from "../db";

export const data = new SlashCommandBuilder()
  .setName("profession")
  .setDescription("Show professions for a player or all players")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name or * for all").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  const player = interaction.options.getString("player", true);

  if (player === "*") {
    const chars = await getAllCharacters();
    if (!chars.length) return interaction.editReply("No characters found.");
    const lines: string[] = [];
    for (const c of chars) {
      const profs = await getProfessions(c.id);
      const profStr = profs.length
        ? profs.map((p) => `${p.name} (${p.skill})`).join(", ")
        : "None";
      lines.push(`**${c.name}**: ${profStr}`);
    }
    return interaction.editReply(lines.join("\n"));
  }

  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
  const profs = await getProfessions(char.id);
  if (!profs.length) return interaction.editReply(`${char.name} has no professions on record.`);
  const profStr = profs.map((p) => `${p.name} (${p.skill}/${p.max_skill})`).join(", ");
  return interaction.editReply(`**${char.name}**: ${profStr}`);
}
