import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getAllCharacters, getCharacterByName, getGear } from "../db";

const ICON_BASE = "https://wow.zamimg.com/images/wow/icons/large";

export const data = new SlashCommandBuilder()
  .setName("gear")
  .setDescription("Show equipped gear for a player or all players")
  .addStringOption((o) =>
    o.setName("player").setDescription("Character name or * for all").setRequired(true)
  );

async function gearEmbed(charName: string, charId: string) {
  const gear = await getGear(charId);
  if (!gear.length) return null;

  const embed = new EmbedBuilder()
    .setTitle(`${charName}'s Gear`)
    .setColor(0xe94560);

  const rows = gear.map((g) => {
    const crafted = g.crafter_name ? ` _(crafted by ${g.crafter_name})_` : "";
    const icon = g.icon ? `[🖼](${ICON_BASE}/${g.icon}.jpg)` : "";
    return `**${g.slot_name}**: ${g.item_name}${crafted} ${icon}`.trim();
  });

  embed.setDescription(rows.join("\n"));
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const player = interaction.options.getString("player", true);

  if (player === "*") {
    const chars = await getAllCharacters();
    if (!chars.length) return interaction.editReply("No characters found.");
    const embeds = [];
    for (const c of chars) {
      const e = await gearEmbed(c.name, c.id);
      if (e) embeds.push(e);
      if (embeds.length === 10) break; // Discord limit
    }
    if (!embeds.length) return interaction.editReply("No gear data found.");
    return interaction.editReply({ embeds });
  }

  const char = await getCharacterByName(player);
  if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
  const embed = await gearEmbed(char.name, char.id);
  if (!embed) return interaction.editReply(`${char.name} has no gear on record.`);
  return interaction.editReply({ embeds: [embed] });
}
