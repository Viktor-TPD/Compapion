import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("How to use Compapion");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("Compapion — Crafted Gear Challenge Tracker")
    .setColor(0xe94560)
    .setDescription(
      "This bot tracks professions, crafted gear, and boss kills for the Classic TBC challenge: *only wear gear you or a friend crafted*.\n\n" +
      "Install the **Compapion.exe** desktop app, point it at your WoW folder, and your data syncs automatically."
    )
    .addFields(
      {
        name: "Player Commands",
        value: [
          "`/profession <name|*>` — show professions",
          "`/gear <name|*>` — show equipped gear",
          "`/skills <name|*> [all]` — show known recipes",
          "`/progress <name>` — level cap and next boss",
          "`/progression` — all players grouped by cap",
          "`/status <name>` — full profile card",
          "`/whocancraft <recipe>` — who knows a recipe",
          "`/cando <name> <recipe>` — can a specific player craft it?",
          "`/order <crafter> <qty recipe>` — request a craft",
          "`/orders [player]` — view active orders",
          "`/skill relevant <recipe>` — toggle a skill on/off for orders",
        ].join("\n"),
      },
      {
        name: "Admin Commands (`/meta ...`)",
        value: [
          "`add-player`, `remove-player`, `list-players`",
          "`set-realm`, `set-class`, `set-cap`",
          "`add-admin`, `remove-admin`, `list-admins`",
          "`kill-orders [player]`, `complete-order`",
          "`reset-character`, `sync`, `announce`",
        ].join("\n"),
      },
      {
        name: "Tips",
        value: "All commands work in DMs with the bot for privacy.\nData is as fresh as the last time the desktop app synced.",
      }
    );

  return interaction.reply({ embeds: [embed], ephemeral: false });
}
