import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ButtonInteraction,
} from "discord.js";
import { getCharacterByName, getCharacterByDiscordId, supabase } from "../db";

export const data = new SlashCommandBuilder()
  .setName("order")
  .setDescription("Request a crafted item from another player")
  .addStringOption((o) =>
    o.setName("crafter").setDescription("Character name of the crafter").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("item").setDescription("e.g. '2x Light Armor Kit'").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const crafterName = interaction.options.getString("crafter", true);
  const itemStr = interaction.options.getString("item", true);

  // Parse quantity and recipe name
  const match = itemStr.match(/^(\d+)[xX]?\s+(.+)$/) ?? itemStr.match(/^(.+)$/);
  const quantity = match?.[1] && /^\d+$/.test(match[1]) ? parseInt(match[1]) : 1;
  const recipeName = match ? (quantity > 1 ? match[2] : match[1]) : itemStr;

  // Resolve requester character
  const requester = await getCharacterByDiscordId(interaction.user.id);
  if (!requester) {
    return interaction.editReply("You're not linked to a character. Ask an admin to run `/meta add-player`.");
  }

  // Resolve crafter character
  const crafter = await getCharacterByName(crafterName);
  if (!crafter) return interaction.editReply(`Character \`${crafterName}\` not found.`);
  if (crafter.id === requester.id) return interaction.editReply("You can't order from yourself.");

  // Check crafter knows the recipe and has it flagged relevant
  const { data: recipe } = await supabase
    .from("recipe_relevance")
    .select("*")
    .eq("character_id", crafter.id)
    .ilike("recipe_name", `%${recipeName}%`)
    .eq("relevant", true)
    .maybeSingle();

  if (!recipe) {
    return interaction.editReply(
      `**${crafter.name}** doesn't have a relevant skill matching \`${recipeName}\`.`
    );
  }

  if (!crafter.discord_id) {
    return interaction.editReply(`**${crafter.name}** has no linked Discord account — can't DM them.`);
  }

  // Create order record
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      requester_id: requester.id,
      crafter_id: crafter.id,
      recipe_name: recipe.recipe_name,
      quantity,
      status: "pending",
    })
    .select()
    .single();

  if (error) return interaction.editReply(`Failed to create order: ${error.message}`);

  // DM the crafter
  const crafterUser = await interaction.client.users.fetch(crafter.discord_id).catch(() => null);
  if (!crafterUser) {
    await supabase.from("orders").update({ status: "declined" }).eq("id", order.id);
    return interaction.editReply("Couldn't reach the crafter's Discord account.");
  }

  const acceptBtn = new ButtonBuilder()
    .setCustomId(`order_accept_${order.id}`)
    .setLabel("Accept")
    .setStyle(ButtonStyle.Success);

  const declineBtn = new ButtonBuilder()
    .setCustomId(`order_decline_${order.id}`)
    .setLabel("Decline")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);

  try {
    await crafterUser.send({
      content: `**${requester.name}** is requesting **${quantity}x ${recipe.recipe_name}** from you!`,
      components: [row],
    });
  } catch {
    await supabase.from("orders").update({ status: "declined" }).eq("id", order.id);
    return interaction.editReply(`Couldn't DM **${crafter.name}** — they may have DMs disabled.`);
  }

  return interaction.editReply(
    `Order sent! Waiting for **${crafter.name}** to accept or decline.`
  );
}
