import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getCharacterByDiscordId, supabase } from "../db";

export const data = new SlashCommandBuilder()
  .setName("skill")
  .setDescription("Toggle a recipe as relevant or irrelevant for order routing")
  .addSubcommand((sub) =>
    sub
      .setName("relevant")
      .setDescription("Toggle a skill's relevance")
      .addStringOption((o) =>
        o.setName("recipe").setDescription("Recipe name").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const recipe = interaction.options.getString("recipe", true);

  const char = await getCharacterByDiscordId(interaction.user.id);
  if (!char) {
    return interaction.editReply("You're not linked to a character.");
  }

  const { data: row } = await supabase
    .from("recipe_relevance")
    .select("*")
    .eq("character_id", char.id)
    .ilike("recipe_name", `%${recipe}%`)
    .maybeSingle();

  if (!row) {
    return interaction.editReply(`Recipe \`${recipe}\` not found in your known skills.`);
  }

  const newValue = !row.relevant;
  await supabase
    .from("recipe_relevance")
    .update({ relevant: newValue, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  return interaction.editReply(
    `**${row.recipe_name}** is now marked as **${newValue ? "relevant" : "irrelevant"}** for you.`
  );
}
