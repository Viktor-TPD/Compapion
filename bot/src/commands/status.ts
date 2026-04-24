import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getCharacterByName, getProfessions, getRelevantRecipes, supabase } from "../db";
import bosses from "../../../shared/bosses.json";

function nextBoss(cap: number) {
  return bosses
    .filter((b) => b.unlocks_cap > cap)
    .sort((a, b) => a.unlocks_cap - b.unlocks_cap)[0] ?? null;
}

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Full profile card for a player")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player", true);
  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);

  const [profs, recipes] = await Promise.all([
    getProfessions(char.id),
    getRelevantRecipes(char.id),
  ]);

  // Open orders count
  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .or(`requester_id.eq.${char.id},crafter_id.eq.${char.id}`)
    .in("status", ["pending", "accepted"]);

  const next = nextBoss(char.level_cap);
  const embed = new EmbedBuilder()
    .setTitle(`${char.name}${char.class ? ` (${char.class})` : ""}`)
    .setColor(0xe94560)
    .addFields(
      { name: "Level Cap", value: String(char.level_cap), inline: true },
      { name: "Next Boss", value: next ? `${next.name} → ${next.unlocks_cap}` : "Max", inline: true },
      {
        name: "Professions",
        value: profs.length ? profs.map((p) => `${p.name} ${p.skill}/${p.max_skill}`).join("\n") : "None",
        inline: false,
      },
      {
        name: "Relevant Skills",
        value: recipes.length ? recipes.map((r) => r.recipe_name).join(", ") : "None",
        inline: false,
      },
      { name: "Open Orders", value: String(orderCount ?? 0), inline: true }
    );

  if (char.last_sync) {
    const mins = Math.floor((Date.now() - new Date(char.last_sync).getTime()) / 60000);
    embed.setFooter({ text: `Last sync: ${mins < 1 ? "just now" : `${mins}m ago`}` });
  }

  return interaction.editReply({ embeds: [embed] });
}
