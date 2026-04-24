// Run once to register slash commands as guild-specific (instant propagation during dev).
// Switch to REST global registration only when shipping.
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import { REST, Routes } from "discord.js";

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

const commandData = [
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
].map((c) => c.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  const guildId = process.env.GUILD_ID;
  if (!guildId) throw new Error("GUILD_ID not set in .env");
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_APP_ID!, guildId),
    { body: commandData }
  );
  console.log(`Registered ${commandData.length} guild commands.`);
})();
