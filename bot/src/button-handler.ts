// Handles button interactions for the order Accept/Decline/Fulfill flow.

import { ButtonInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { supabase, getCharacterByDiscordId } from "./db";

export async function handleButton(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (customId.startsWith("order_accept_")) {
    const orderId = customId.replace("order_accept_", "");
    await handleAccept(interaction, orderId);
  } else if (customId.startsWith("order_decline_")) {
    const orderId = customId.replace("order_decline_", "");
    await handleDecline(interaction, orderId);
  } else if (customId.startsWith("order_fulfill_")) {
    const orderId = customId.replace("order_fulfill_", "");
    await handleFulfill(interaction, orderId);
  }
}

async function handleAccept(interaction: ButtonInteraction, orderId: string) {
  const { data: order } = await supabase
    .from("orders")
    .select("*, requester:requester_id(name, discord_id), crafter:crafter_id(name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "pending") {
    return interaction.reply({ content: "This order is no longer pending.", ephemeral: true });
  }

  await supabase
    .from("orders")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  await interaction.update({
    content: `✅ You accepted the order for **${order.quantity}x ${order.recipe_name}**. Mark it done when you deliver!`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`order_fulfill_${orderId}`)
          .setLabel("Mark Fulfilled")
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });

  // DM requester
  const requester = order.requester as { name: string; discord_id: string } | null;
  if (requester?.discord_id) {
    const user = await interaction.client.users.fetch(requester.discord_id).catch(() => null);
    await user?.send(`**${(order.crafter as any)?.name}** accepted your order for **${order.quantity}x ${order.recipe_name}**!`).catch(() => null);
  }
}

async function handleDecline(interaction: ButtonInteraction, orderId: string) {
  const { data: order } = await supabase
    .from("orders")
    .select("*, requester:requester_id(name, discord_id), crafter:crafter_id(name)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "pending") {
    return interaction.reply({ content: "This order is no longer pending.", ephemeral: true });
  }

  await supabase
    .from("orders")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  await interaction.update({
    content: `❌ You declined the order for **${order.quantity}x ${order.recipe_name}**.`,
    components: [],
  });

  const requester = order.requester as { name: string; discord_id: string } | null;
  if (requester?.discord_id) {
    const user = await interaction.client.users.fetch(requester.discord_id).catch(() => null);
    await user?.send(`**${(order.crafter as any)?.name}** declined your order for **${order.quantity}x ${order.recipe_name}**.`).catch(() => null);
  }
}

async function handleFulfill(interaction: ButtonInteraction, orderId: string) {
  const { data: order } = await supabase
    .from("orders")
    .select("*, requester:requester_id(name, discord_id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "accepted") {
    return interaction.reply({ content: "Order is not in accepted state.", ephemeral: true });
  }

  await supabase
    .from("orders")
    .update({ status: "fulfilled", updated_at: new Date().toISOString() })
    .eq("id", orderId);

  await interaction.update({
    content: `🎉 Order for **${order.quantity}x ${order.recipe_name}** marked as fulfilled!`,
    components: [],
  });

  const requester = order.requester as { name: string; discord_id: string } | null;
  if (requester?.discord_id) {
    const user = await interaction.client.users.fetch(requester.discord_id).catch(() => null);
    await user?.send(`Your order for **${order.quantity}x ${order.recipe_name}** has been fulfilled! 🎉`).catch(() => null);
  }
}
