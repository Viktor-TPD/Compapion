import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    }
    return (_supabase as any)[prop];
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Character {
  id: string;
  name: string;
  realm: string | null;
  class: string | null;
  discord_id: string | null;
  level_cap: number;
  last_sync: string | null;
}

export interface Profession {
  id: string;
  character_id: string;
  name: string;
  skill: number;
  max_skill: number;
}

export interface GearSlot {
  id: string;
  character_id: string;
  slot: number;
  slot_name: string;
  item_name: string;
  item_link: string;
  icon: string | null;
  crafter_name: string | null;
}

export interface RecipeRelevance {
  id: string;
  character_id: string;
  profession: string;
  recipe_name: string;
  relevant: boolean;
}

export interface Order {
  id: string;
  requester_id: string;
  crafter_id: string;
  recipe_name: string;
  quantity: number;
  status: "pending" | "accepted" | "declined" | "fulfilled";
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function getCharacterByName(name: string): Promise<Character | null> {
  const { data } = await supabase
    .from("characters")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  return data;
}

export async function getCharacterByDiscordId(discordId: string): Promise<Character | null> {
  const { data } = await supabase
    .from("characters")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();
  return data;
}

export async function getAllCharacters(): Promise<Character[]> {
  const { data } = await supabase.from("characters").select("*");
  return data ?? [];
}

export async function getProfessions(characterId: string): Promise<Profession[]> {
  const { data } = await supabase
    .from("professions")
    .select("*")
    .eq("character_id", characterId);
  return data ?? [];
}

export async function getGear(characterId: string): Promise<GearSlot[]> {
  const { data } = await supabase
    .from("gear_slots")
    .select("*")
    .eq("character_id", characterId)
    .order("slot");
  return data ?? [];
}

export async function getRelevantRecipes(characterId: string): Promise<RecipeRelevance[]> {
  const { data } = await supabase
    .from("recipe_relevance")
    .select("*")
    .eq("character_id", characterId)
    .eq("relevant", true);
  return data ?? [];
}

export async function getAllRecipes(characterId: string): Promise<RecipeRelevance[]> {
  const { data } = await supabase
    .from("recipe_relevance")
    .select("*")
    .eq("character_id", characterId);
  return data ?? [];
}

export async function isAdmin(discordId: string): Promise<boolean> {
  if (discordId === process.env.SUPERADMIN_ID) return true;
  const { data } = await supabase
    .from("admins")
    .select("discord_id")
    .eq("discord_id", discordId)
    .maybeSingle();
  return !!data;
}
