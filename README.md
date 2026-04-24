# Compapion

A Classic WoW TBC challenge tracker for friend groups playing with one rule: **only wear gear you or a friend crafted**.

Compapion syncs your professions, equipped gear, and boss kills to a shared Discord bot so your whole group can see who can craft what, request items from each other, and track the progression gating that unlocks higher level caps.

```
WoW → SavedVariables .lua → Compapion.exe → Supabase → Discord Bot
```

## How it works

1. Install the **WoW addon** — it writes your professions, gear, and boss kills to a SavedVariables file on every skillup, gear change, boss kill, and logout.
2. Install the **Compapion desktop app** — it watches that file and syncs changes to Supabase automatically. Lives in your system tray.
3. The **Discord bot** reads Supabase and answers slash commands from your group channel or DMs.

## Boss Progression

Level caps unlock by killing specific bosses with your group:

| Boss | Dungeon | Unlocks cap |
|---|---|---|
| Edwin VanCleef | The Deadmines | 22 |
| Charlga Razorflank | Razorfen Kraul | 29 |
| Arcanist Doan | Scarlet Monastery – Library | 37 |
| Archaedas | Uldaman | 42 |
| Chief Ukorz Sandscalp | Zul'Farrak | 48 |
| Shade of Eranikus | Sunken Temple | 52 |
| Baron Rivendare | Stratholme | 60 |

## Monorepo structure

```
compapion/
├── addon/          WoW Lua addon
├── electron/       Desktop tray app (.exe)
├── bot/            Discord.js bot (TypeScript)
└── shared/         bosses.json, items.json, supabase-schema.sql
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### 1. Supabase

Run `shared/supabase-schema.sql` in your Supabase SQL editor. It creates all tables and seeds the initial data.

### 2. Environment

```bash
cp .env.example .env
```

Fill in your values:

```
DISCORD_TOKEN=
DISCORD_APP_ID=
GUILD_ID=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPERADMIN_ID=       # your Discord user ID — never stored in DB
GROUP_CHANNEL_ID=    # channel where the bot posts the pinned overview
```

### 3. Discord bot

```bash
cd bot
npm install
npm run register    # registers slash commands to your guild (instant)
npm run dev         # or npm start after npm run build
```

### 4. Electron app

```bash
cd electron
npm install
npm run build
npm run dist        # produces a .exe in electron/dist/
```

Distribute the `.exe` to your friends. On first launch it will ask for their WoW installation directory.

### 5. WoW addon

Copy the `addon/` folder into your WoW addons directory:

```
World of Warcraft/_classic_tbc_/Interface/AddOns/Compapion/
```

Enable it in-game and you're done.

## Discord commands

| Command | Description |
|---|---|
| `/profession <name\|*>` | Show professions for a player or everyone |
| `/gear <name\|*>` | Show equipped gear with crafter info |
| `/skills <name\|*> [all]` | Show relevant recipes (add `all` for everything) |
| `/progress <name>` | Current level cap and next boss to kill |
| `/progression` | All players grouped by cap |
| `/status <name>` | Full profile card |
| `/whocancraft <recipe>` | Who knows a recipe and is accepting orders |
| `/cando <name> <recipe>` | Can a specific player craft it? |
| `/order <crafter> <qty recipe>` | Request a craft — DMs the crafter with Accept/Decline |
| `/orders [player]` | View active orders |
| `/skill relevant <recipe>` | Toggle a recipe on/off for order routing |
| `/help` | Full command reference |

Admin commands are under `/meta` (add/remove players, manage admins, force-sync, announce, etc).

All commands work in DMs with the bot.

## License

MIT
