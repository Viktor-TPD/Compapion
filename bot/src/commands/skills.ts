import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getAllCharacters, getCharacterByName, getRelevantRecipes, getAllRecipes } from "../db";

export const data = new SlashCommandBuilder()
  .setName("skills")
  .setDescription("Show known recipes for a player")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name or * for all").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("filter").setDescription("Pass 'all' to show non-relevant skills too").setRequired(false)
  );

async function formatSkills(charName: string, charId: string, showAll: boolean): Promise<string> {
  const recipes = showAll ? await getAllRecipes(charId) : await getRelevantRecipes(charId);
  if (!recipes.length) return `${charName}: no ${showAll ? "" : "relevant "}skills on record.`;
  const grouped: Record<string, string[]> = {};
  for (const r of recipes) {
    if (!grouped[r.profession]) grouped[r.profession] = [];
    grouped[r.profession].push(r.recipe_name + (r.relevant ? "" : " _(hidden)_"));
  }
  const lines = [`**${charName}**:`];
  for (const [prof, names] of Object.entries(grouped)) {
    lines.push(`  _${prof}_: ${names.join(", ")}`);
  }
  return lines.join("\n");
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player", true);
  const showAll = interaction.options.getString("filter") === "all";

  if (player === "*") {
    const chars = await getAllCharacters();
    if (!chars.length) return interaction.editReply("No characters found.");
    const parts: string[] = [];
    for (const c of chars) {
      parts.push(await formatSkills(c.name, c.id, showAll));
    }
    return interaction.editReply(parts.join("\n\n"));
  }

  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
  return interaction.editReply(await formatSkills(char.name, char.id, showAll));
}
