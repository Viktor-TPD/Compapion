import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getAllCharacters, supabase } from "../db";

export const data = new SlashCommandBuilder()
  .setName("whocancraft")
  .setDescription("Find who knows a recipe and is accepting orders")
  .addStringOption((o) =>
    o.setName("recipe").setDescription("Recipe name").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const recipe = interaction.options.getString("recipe", true);

  const { data: rows } = await supabase
    .from("recipe_relevance")
    .select("character_id, profession, relevant")
    .ilike("recipe_name", `%${recipe}%`)
    .eq("relevant", true);

  if (!rows?.length) {
    return interaction.editReply(`No one has **${recipe}** flagged as a relevant skill.`);
  }

  const chars = await getAllCharacters();
  const charMap = Object.fromEntries(chars.map((c) => [c.id, c]));

  const lines = rows.map((r) => {
    const c = charMap[r.character_id];
    return c ? `**${c.name}** (${r.profession}) — accepting orders` : null;
  }).filter(Boolean);

  return interaction.editReply(
    lines.length ? `Who can craft **${recipe}**:\n${lines.join("\n")}` : `No one found.`
  );
}
