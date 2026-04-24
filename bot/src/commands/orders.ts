import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { getCharacterByName, getCharacterByDiscordId, supabase } from "../db";

export const data = new SlashCommandBuilder()
  .setName("orders")
  .setDescription("Show active orders")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name (omit for all)").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player");

  let query = supabase
    .from("orders")
    .select("*, requester:requester_id(name), crafter:crafter_id(name)")
    .in("status", ["pending", "accepted"]);

  if (player) {
    const char = await getCharacterByName(player);
    if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
    query = query.or(`requester_id.eq.${char.id},crafter_id.eq.${char.id}`);
  }

  const { data: orders } = await query.order("created_at", { ascending: false });

  if (!orders?.length) {
    return interaction.editReply(player ? `No active orders for **${player}**.` : "No active orders.");
  }

  const lines = (orders as any[]).map((o) => {
    const req = o.requester?.name ?? "?";
    const cra = o.crafter?.name ?? "?";
    return `[${o.status.toUpperCase()}] **${req}** → **${cra}**: ${o.quantity}x ${o.recipe_name}`;
  });

  return interaction.editReply(lines.join("\n"));
}
