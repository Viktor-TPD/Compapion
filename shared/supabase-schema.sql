-- Compapion schema
-- TBC Classic challenge tracker

create table if not exists characters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  realm       text,
  class       text,
  discord_id  text unique,
  level_cap   int not null default 22,
  last_sync   timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists professions (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references characters(id) on delete cascade,
  name          text not null,
  skill         int not null default 0,
  max_skill     int not null default 375,
  updated_at    timestamptz not null default now(),
  unique(character_id, name)
);

create table if not exists gear_slots (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references characters(id) on delete cascade,
  slot          int not null,           -- WoW inventory slot id (1-19)
  slot_name     text not null,          -- "Head", "Neck", etc.
  item_id       int,
  item_name     text,
  item_link     text,                   -- full WoW item link string
  icon          text,                   -- icon name for zamimg CDN
  crafter_name  text,                   -- extracted from crafted item link, null if not crafted
  updated_at    timestamptz not null default now(),
  unique(character_id, slot)
);

create table if not exists boss_kills (
  id            uuid primary key default gen_random_uuid(),
  boss_name     text not null,
  zone          text,
  killed_at     timestamptz not null default now(),
  party_members text[] not null default '{}'  -- character names present at kill
);

-- Which recipes/skills each character knows and considers relevant
create table if not exists recipe_relevance (
  id            uuid primary key default gen_random_uuid(),
  character_id  uuid not null references characters(id) on delete cascade,
  profession    text not null,
  recipe_name   text not null,
  relevant      boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique(character_id, recipe_name)
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references characters(id) on delete cascade,
  crafter_id      uuid not null references characters(id) on delete cascade,
  recipe_name     text not null,
  quantity        int not null default 1,
  status          text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'fulfilled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Admin table — SUPERADMIN_ID from .env is never stored here
create table if not exists admins (
  discord_id  text primary key,
  added_at    timestamptz not null default now()
);

-- Seed data
insert into characters (name, realm, discord_id, level_cap)
  values ('Pebbie', 'Thunderstrike', '233866875283570688', 22)
  on conflict (discord_id) do nothing;

insert into professions (character_id, name, skill, max_skill)
  select id, 'Cooking',        20, 375 from characters where name = 'Pebbie'
  on conflict (character_id, name) do nothing;
insert into professions (character_id, name, skill, max_skill)
  select id, 'Jewelcrafting',  30, 375 from characters where name = 'Pebbie'
  on conflict (character_id, name) do nothing;
insert into professions (character_id, name, skill, max_skill)
  select id, 'Mining',         25, 375 from characters where name = 'Pebbie'
  on conflict (character_id, name) do nothing;

insert into recipe_relevance (character_id, profession, recipe_name, relevant)
  select id, 'Cooking',       'Charred Wolf Meat',    true from characters where name = 'Pebbie'
  on conflict (character_id, recipe_name) do nothing;
insert into recipe_relevance (character_id, profession, recipe_name, relevant)
  select id, 'Jewelcrafting', 'Delicate Copper Wire', true from characters where name = 'Pebbie'
  on conflict (character_id, recipe_name) do nothing;

insert into admins (discord_id) values ('233866875283570688')
  on conflict (discord_id) do nothing;
