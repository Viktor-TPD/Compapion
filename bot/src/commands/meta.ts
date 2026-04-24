import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Guild,
} from "discord.js";
import { isAdmin, supabase, getAllCharacters } from "../db";

export const data = new SlashCommandBuilder()
  .setName("meta")
  .setDescription("Admin commands for managing players and the bot")
  .addSubcommand((s) =>
    s.setName("add-player")
      .setDescription("Link a Discord user to a WoW character")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
      .addStringOption((o) => o.setName("character").setDescription("WoW character name").setRequired(true))
      .addStringOption((o) => o.setName("class").setDescription("WoW class").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("remove-player")
      .setDescription("Remove a player from the group")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("list-players")
      .setDescription("List all linked players")
  )
  .addSubcommand((s) =>
    s.setName("set-realm")
      .setDescription("Update a character's realm")
      .addStringOption((o) => o.setName("character").setDescription("Character name").setRequired(true))
      .addStringOption((o) => o.setName("realm").setDescription("Realm name").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("set-class")
      .setDescription("Update a player's WoW class")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
      .addStringOption((o) => o.setName("class").setDescription("WoW class").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("add-admin")
      .setDescription("Grant admin access")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("remove-admin")
      .setDescription("Revoke admin access")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
  )
  .addSubcommand((s) => s.setName("list-admins").setDescription("List current admins"))
  .addSubcommand((s) =>
    s.setName("kill-orders")
      .setDescription("Delete active orders")
      .addStringOption((o) => o.setName("player").setDescription("Character name (omit for all)").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("complete-order")
      .setDescription("Force-complete an order")
      .addStringOption((o) => o.setName("order-id").setDescription("Order UUID").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("reset-character")
      .setDescription("Wipe a character's data")
      .addStringOption((o) => o.setName("character").setDescription("Character name").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("set-cap")
      .setDescription("Manually override a character's level cap")
      .addStringOption((o) => o.setName("character").setDescription("Character name").setRequired(true))
      .addIntegerOption((o) => o.setName("cap").setDescription("New cap").setRequired(true))
  )
  .addSubcommand((s) => s.setName("sync").setDescription("Force refresh the pinned channel message"))
  .addSubcommand((s) =>
    s.setName("announce")
      .setDescription("Post an announcement to the group channel")
      .addStringOption((o) => o.setName("message").setDescription("Announcement text").setRequired(true))
  );

async function ensureClassRole(guild: Guild, className: string) {
  let role = guild.roles.cache.find((r) => r.name.toLowerCase() === className.toLowerCase());
  if (!role) {
    role = await guild.roles.create({ name: className, reason: "Compapion class role" });
  }
  return role;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!(await isAdmin(interaction.user.id))) {
    return interaction.editReply("You don't have permission to use meta commands.");
  }

  const sub = interaction.options.getSubcommand();

  // ── add-player ───────────────────────────────────────────────────────────
  if (sub === "add-player") {
    const user = interaction.options.getUser("user", true);
    const charName = interaction.options.getString("character", true);
    const className = interaction.options.getString("class", true);

    const { error } = await supabase.from("characters").upsert(
      { name: charName, class: className, discord_id: user.id },
      { onConflict: "name" }
    );
    if (error) return interaction.editReply(`DB error: ${error.message}`);

    if (interaction.guild) {
      const role = await ensureClassRole(interaction.guild, className);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      await member?.roles.add(role).catch(() => null);
    }

    return interaction.editReply(`Linked **${user.username}** → **${charName}** (${className}).`);
  }

  // ── remove-player ────────────────────────────────────────────────────────
  if (sub === "remove-player") {
    const user = interaction.options.getUser("user", true);
    const { data: char } = await supabase
      .from("characters")
      .select("id, class")
      .eq("discord_id", user.id)
      .maybeSingle();

    if (!char) return interaction.editReply("That user has no linked character.");

    await supabase.from("characters").delete().eq("id", char.id);

    if (interaction.guild && char.class) {
      const role = interaction.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === char.class!.toLowerCase()
      );
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (role && member) await member.roles.remove(role).catch(() => null);
    }

    return interaction.editReply(`Removed **${user.username}** from the group.`);
  }

  // ── list-players ─────────────────────────────────────────────────────────
  if (sub === "list-players") {
    const chars = await getAllCharacters();
    if (!chars.length) return interaction.editReply("No linked players.");
    const lines = chars.map((c) => `**${c.name}** (${c.class ?? "?"}) — <@${c.discord_id ?? "?"}>`);
    return interaction.editReply(lines.join("\n"));
  }

  // ── set-realm ────────────────────────────────────────────────────────────
  if (sub === "set-realm") {
    const charName = interaction.options.getString("character", true);
    const realm = interaction.options.getString("realm", true);
    const { error } = await supabase.from("characters").update({ realm }).ilike("name", charName);
    return interaction.editReply(error ? `Error: ${error.message}` : `Realm updated for **${charName}**.`);
  }

  // ── set-class ────────────────────────────────────────────────────────────
  if (sub === "set-class") {
    const user = interaction.options.getUser("user", true);
    const className = interaction.options.getString("class", true);
    const { error } = await supabase.from("characters").update({ class: className }).eq("discord_id", user.id);
    return interaction.editReply(error ? `Error: ${error.message}` : `Class updated for **${user.username}**.`);
  }

  // ── add-admin ────────────────────────────────────────────────────────────
  if (sub === "add-admin") {
    const user = interaction.options.getUser("user", true);
    await supabase.from("admins").upsert({ discord_id: user.id }, { onConflict: "discord_id" });
    return interaction.editReply(`**${user.username}** is now an admin.`);
  }

  // ── remove-admin ─────────────────────────────────────────────────────────
  if (sub === "remove-admin") {
    const user = interaction.options.getUser("user", true);
    if (user.id === process.env.SUPERADMIN_ID) {
      return interaction.editReply("The superadmin cannot be removed.");
    }
    await supabase.from("admins").delete().eq("discord_id", user.id);
    return interaction.editReply(`**${user.username}** is no longer an admin.`);
  }

  // ── list-admins ──────────────────────────────────────────────────────────
  if (sub === "list-admins") {
    const { data: admins } = await supabase.from("admins").select("discord_id");
    const lines = (admins ?? []).map((a) => `<@${a.discord_id}>`);
    lines.push(`<@${process.env.SUPERADMIN_ID}> _(superadmin)_`);
    return interaction.editReply(`Admins: ${lines.join(", ")}`);
  }

  // ── kill-orders ──────────────────────────────────────────────────────────
  if (sub === "kill-orders") {
    const player = interaction.options.getString("player");
    let q = supabase.from("orders").delete().in("status", ["pending", "accepted"]);
    if (player) {
      const { data: char } = await supabase.from("characters").select("id").ilike("name", player).maybeSingle();
      if (!char) return interaction.editReply(`Character \`${player}\` not found.`);
      q = q.or(`requester_id.eq.${char.id},crafter_id.eq.${char.id}`) as any;
    }
    await q;
    return interaction.editReply(`Orders cleared${player ? ` for **${player}**` : ""}.`);
  }

  // ── complete-order ───────────────────────────────────────────────────────
  if (sub === "complete-order") {
    const orderId = interaction.options.getString("order-id", true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "fulfilled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return interaction.editReply(error ? `Error: ${error.message}` : `Order ${orderId} marked fulfilled.`);
  }

  // ── reset-character ──────────────────────────────────────────────────────
  if (sub === "reset-character") {
    const charName = interaction.options.getString("character", true);
    const { data: char } = await supabase.from("characters").select("id").ilike("name", charName).maybeSingle();
    if (!char) return interaction.editReply(`Character \`${charName}\` not found.`);
    await Promise.all([
      supabase.from("professions").delete().eq("character_id", char.id),
      supabase.from("gear_slots").delete().eq("character_id", char.id),
      supabase.from("recipe_relevance").delete().eq("character_id", char.id),
      supabase.from("orders").delete().or(`requester_id.eq.${char.id},crafter_id.eq.${char.id}`),
    ]);
    await supabase.from("characters").update({ level_cap: 22, last_sync: null }).eq("id", char.id);
    return interaction.editReply(`**${charName}** has been reset.`);
  }

  // ── set-cap ──────────────────────────────────────────────────────────────
  if (sub === "set-cap") {
    const charName = interaction.options.getString("character", true);
    const cap = interaction.options.getInteger("cap", true);
    const { error } = await supabase.from("characters").update({ level_cap: cap }).ilike("name", charName);
    return interaction.editReply(error ? `Error: ${error.message}` : `Level cap for **${charName}** set to ${cap}.`);
  }

  // ── sync ─────────────────────────────────────────────────────────────────
  if (sub === "sync") {
    // The pinned message update is handled by the overview publisher — trigger it here
    interaction.client.emit("compapion_sync");
    return interaction.editReply("Sync triggered.");
  }

  // ── announce ─────────────────────────────────────────────────────────────
  if (sub === "announce") {
    const message = interaction.options.getString("message", true);
    const guildId = process.env.GUILD_ID;
    const channelId = process.env.GROUP_CHANNEL_ID;
    if (!guildId || !channelId) return interaction.editReply("GROUP_CHANNEL_ID not set in env.");
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return interaction.editReply("Couldn't find the group channel.");
    await channel.send(`📢 **Announcement**\n${message}`);
    return interaction.editReply("Announcement posted.");
  }

  return interaction.editReply("Unknown subcommand.");
}
