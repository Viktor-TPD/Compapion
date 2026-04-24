import "dotenv/config";
import { Client, GatewayIntentBits, Collection, Events, Interaction } from "discord.js";
import { publishOverview } from "./overview";
import { handleButton } from "./button-handler";

// ─── Load commands ───────────────────────────────────────────────────────────

import * as professionCmd from "./commands/profession";
import * as gearCmd from "./commands/gear";
import * as skillsCmd from "./commands/skills";
import * as progressCmd from "./commands/progress";
import * as progressionCmd from "./commands/progression";
import * as statusCmd from "./commands/status";
import * as whocancraftCmd from "./commands/whocancraft";
import * as candoCmd from "./commands/cando";
import * as orderCmd from "./commands/order";
import * as ordersCmd from "./commands/orders";
import * as skillRelevantCmd from "./commands/skill-relevant";
import * as helpCmd from "./commands/help";
import * as metaCmd from "./commands/meta";

const allCommands = [
  professionCmd,
  gearCmd,
  skillsCmd,
  progressCmd,
  progressionCmd,
  statusCmd,
  whocancraftCmd,
  candoCmd,
  orderCmd,
  ordersCmd,
  skillRelevantCmd,
  helpCmd,
  metaCmd,
];

const commands = new Collection<string, typeof allCommands[number]>();
for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

// ─── Client ──────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Compapion bot ready: ${c.user.tag}`);
  await publishOverview(c);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const msg = { content: "Something went wrong. Try again later.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => null);
      } else {
        await interaction.reply(msg).catch(() => null);
      }
    }
  } else if (interaction.isButton()) {
    await handleButton(interaction).catch((err) => {
      console.error("Button handler error:", err);
    });
  }
});

// Custom event: triggered by /meta sync
client.on("compapion_sync" as any, () => {
  publishOverview(client).catch(console.error);
});

client.login(process.env.DISCORD_TOKEN);
