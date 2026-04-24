// Manages the single pinned "spreadsheet" message in the group channel.
// Called on startup, on every sync event, and via /meta sync.

import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getAllCharacters, getProfessions, getRelevantRecipes, supabase } from "./db";
import bosses from "../../shared/bosses.json";

function nextBoss(cap: number) {
  return bosses.filter((b) => b.unlocks_cap > cap).sort((a, b) => a.unlocks_cap - b.unlocks_cap)[0] ?? null;
}

export async function buildOverviewEmbed(): Promise<EmbedBuilder> {
  const chars = await getAllCharacters();

  const embed = new EmbedBuilder()
    .setTitle("Compapion — Crafted Gear Challenge")
    .setColor(0x0f3460);

  if (!chars.length) {
    embed.setDescription("No characters linked yet. Ask an admin to run `/meta add-player`.");
    return embed;
  }

  const rows: string[] = [];
  for (const c of chars) {
    const profs = await getProfessions(c.id);
    const next = nextBoss(c.level_cap);
    const profStr = profs.length ? profs.map((p) => `${p.name} ${p.skill}`).join(", ") : "—";
    const nextStr = next ? `→ ${next.name}` : "Max";
    rows.push(`**${c.name}** (cap ${c.level_cap} ${nextStr})\n  ${profStr}`);
  }

  embed.setDescription(rows.join("\n\n"));

  const mins = 0;
  embed.setFooter({ text: `Last updated: just now` });

  return embed;
}

let pinnedMessageId: string | null = null;

export async function publishOverview(client: Client) {
  const channelId = process.env.GROUP_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const textChannel = channel as TextChannel;
  const embed = await buildOverviewEmbed();

  if (pinnedMessageId) {
    const msg = await textChannel.messages.fetch(pinnedMessageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      return;
    }
  }

  // First time: send and pin
  const msg = await textChannel.send({ embeds: [embed] });
  pinnedMessageId = msg.id;
  await msg.pin().catch(() => null);
}
