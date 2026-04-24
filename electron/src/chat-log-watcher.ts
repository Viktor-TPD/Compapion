import * as fs from "fs";
import * as path from "path";
import chokidar from "chokidar";
import { createClient } from "@supabase/supabase-js";
import type { WatcherState } from "./watcher";

const SYNC_PREFIX = "COMPAPION_SYNC:";

const SUPABASE_URL = "https://djoohxupjiofjqelydhx.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqb29oeHVwamlvZmpxZWx5ZGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjk0NjQsImV4cCI6MjA5MjYwNTQ2NH0.Zs0onap1IFTK7IuvWiA29KqnfClEmryL2VdE0SkHSyM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface DeltaPayload {
  r:    string;          // reason
  n:    string;          // character name
  ts:   number;          // timestamp
  p?:   { name: string; skill: number; max_skill: number }[];  // professions
  bk?:  string;          // boss name (single kill)
  cap?: number;          // new level cap
  gs?:  number[];        // gear slot IDs (just a hint — no full sync needed)
}

function parseSyncLine(line: string): DeltaPayload | null {
  const idx = line.indexOf(SYNC_PREFIX);
  if (idx === -1) return null;
  const json = line.slice(idx + SYNC_PREFIX.length).trim();
  try {
    return JSON.parse(json) as DeltaPayload;
  } catch {
    return null;
  }
}

async function applyDelta(delta: DeltaPayload): Promise<void> {
  const charName = delta.n;
  if (!charName) return;

  // Ensure character row exists
  const { data: charRow, error: charErr } = await supabase
    .from("characters")
    .upsert({ name: charName, last_sync: new Date().toISOString() }, { onConflict: "name" })
    .select("id")
    .single();
  if (charErr) throw charErr;
  const characterId = charRow.id;

  // Upsert professions if present
  if (delta.p?.length) {
    await supabase.from("professions").delete().eq("character_id", characterId);
    const rows = delta.p.map((p) => ({
      character_id: characterId,
      name:         p.name,
      skill:        p.skill,
      max_skill:    p.max_skill,
      updated_at:   new Date().toISOString(),
    }));
    const { error } = await supabase.from("professions").insert(rows);
    if (error) throw error;
  }

  // Insert boss kill if present and not already recorded
  if (delta.bk) {
    const { data: existing } = await supabase
      .from("boss_kills")
      .select("id")
      .eq("boss_name", delta.bk)
      .contains("party_members", [charName])
      .maybeSingle();

    if (!existing) {
      await supabase.from("boss_kills").insert({
        boss_name:     delta.bk,
        killed_at:     new Date(delta.ts * 1000).toISOString(),
        party_members: [charName],
      });
    }
  }
}

export class ChatLogWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private fileOffset = 0;
  private onStateChange: (state: WatcherState) => void;

  constructor(onStateChange: (state: WatcherState) => void) {
    this.onStateChange = onStateChange;
  }

  start(wowDir: string) {
    const logPath = path.join(wowDir, "Logs", "WoWChatLog.txt");

    // Seek to end — only process lines written after we start watching
    if (fs.existsSync(logPath)) {
      this.fileOffset = fs.statSync(logPath).size;
    }

    this.watcher = chokidar.watch(logPath, {
      persistent: true,
      awaitWriteFinish: false,
      disableGlobbing: true,
    });

    this.watcher.on("change", () => this.onLogChanged(logPath));
    this.watcher.on("add",    () => this.onLogChanged(logPath));
  }

  stop() {
    this.watcher?.close();
  }

  private async onLogChanged(logPath: string) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(logPath);
    } catch {
      return;
    }

    if (stat.size < this.fileOffset) this.fileOffset = 0; // file rotated
    if (stat.size === this.fileOffset) return;

    const fd = fs.openSync(logPath, "r");
    const buf = Buffer.alloc(stat.size - this.fileOffset);
    fs.readSync(fd, buf, 0, buf.length, this.fileOffset);
    fs.closeSync(fd);
    this.fileOffset = stat.size;

    const lines = buf.toString("utf-8").split("\n");

    for (const line of lines) {
      const delta = parseSyncLine(line);
      if (!delta?.n) continue;

      this.onStateChange({ status: "syncing", lastSync: null, lastError: null });
      try {
        await applyDelta(delta);
        this.onStateChange({ status: "ok", lastSync: new Date(), lastError: null });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.onStateChange({ status: "error", lastSync: null, lastError: msg });
      }
    }
  }
}
