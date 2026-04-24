import { createClient } from "@supabase/supabase-js";
import type { CompapionSavedVars } from "./lua-parser";

const SUPABASE_URL = "https://djoohxupjiofjqelydhx.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqb29oeHVwamlvZmpxZWx5ZGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjk0NjQsImV4cCI6MjA5MjYwNTQ2NH0.Zs0onap1IFTK7IuvWiA29KqnfClEmryL2VdE0SkHSyM";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

export async function syncToSupabase(data: CompapionSavedVars): Promise<void> {
  const charName = data.character?.name;
  if (!charName) throw new Error("No character name in saved vars");

  // Upsert character
  const { data: charRow, error: charErr } = await supabase
    .from("characters")
    .upsert(
      {
        name: charName,
        class: data.character.class,
        last_sync: new Date().toISOString(),
      },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (charErr) throw charErr;
  const characterId = charRow.id;

  // Upsert professions
  if (data.professions?.length) {
    const rows = data.professions.map((p) => ({
      character_id: characterId,
      name: p.name,
      skill: p.skill,
      max_skill: p.max_skill,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("professions")
      .upsert(rows, { onConflict: "character_id,name" });
    if (error) throw error;
  }

  // Upsert gear slots
  if (data.gear?.length) {
    const rows = data.gear.map((g) => ({
      character_id: characterId,
      slot: g.slot,
      slot_name: g.slot_name,
      item_link: g.item_link,
      item_name: g.item_name,
      icon: g.icon ?? null,
      crafter_name: g.crafter_name ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("gear_slots")
      .upsert(rows, { onConflict: "character_id,slot" });
    if (error) throw error;
  }

  // Insert new boss kills (avoid duplicates by checking boss_name + character presence)
  if (data.boss_kills?.length) {
    for (const kill of data.boss_kills) {
      const { data: existing } = await supabase
        .from("boss_kills")
        .select("id")
        .eq("boss_name", kill.boss_name)
        .contains("party_members", [charName])
        .maybeSingle();

      if (!existing) {
        await supabase.from("boss_kills").insert({
          boss_name: kill.boss_name,
          killed_at: new Date(kill.killed_at * 1000).toISOString(),
          party_members: kill.party_members,
        });
      }
    }
  }
}
