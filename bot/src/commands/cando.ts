import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getCharacterByName, supabase } from "../db";

export const data = new SlashCommandBuilder()
  .setName("cando")
  .setDescription("Check if a player knows a specific recipe")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("recipe").setDescription("Recipe name").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player", true);
  const recipe = interaction.options.getString("recipe", true);

  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);

  const { data: row } = await supabase
    .from("recipe_relevance")
    .select("*")
    .eq("character_id", char.id)
    .ilike("recipe_name", `%${recipe}%`)
    .maybeSingle();

  if (!row) return interaction.editReply(`**${char.name}** doesn't know \`${recipe}\`.`);

  const relevance = row.relevant ? "and has it flagged as relevant" : "but it's marked irrelevant (won't take orders)";
  return interaction.editReply(`**${char.name}** knows **${row.recipe_name}** ${relevance}.`);
}
