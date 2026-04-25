import * as fs from "fs";
import * as crypto from "crypto";
import chokidar from "chokidar";
import { parseSavedVars } from "./lua-parser";
import { syncToSupabase } from "./supabase-sync";

type SyncStatus = "idle" | "syncing" | "ok" | "error";

export interface RecipeSyncEntry {
  profession: string;
  count: number;
  syncedAt: number; // unix seconds from Lua's time()
}

export interface WatcherState {
  status: SyncStatus;
  lastSync: Date | null;
  lastError: string | null;
  lastSyncDetail: string | null;
  recipeSync: RecipeSyncEntry[];
}

export class SavedVarsWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHash: string | null = null;
  private state: WatcherState = { status: "idle", lastSync: null, lastError: null, lastSyncDetail: null, recipeSync: [] };
  private onStateChange: (state: WatcherState) => void;
  onSynced: ((charName: string, professions: { name: string; skill: number }[]) => void) | null = null;

  constructor(onStateChange: (state: WatcherState) => void) {
    this.onStateChange = onStateChange;
  }

  start(luaFilePath: string) {
    this.watcher = chokidar.watch(luaFilePath, {
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher.on("change", () => this.onFileChanged(luaFilePath));
    this.watcher.on("add", () => this.onFileChanged(luaFilePath));

    // Heartbeat: re-sync every 10 minutes regardless of file changes
    this.heartbeatTimer = setInterval(() => {
      this.onFileChanged(luaFilePath);
    }, 10 * 60 * 1000);

    // Initial sync
    this.onFileChanged(luaFilePath);
  }

  stop() {
    this.watcher?.close();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
  }

  getState(): WatcherState {
    return { ...this.state };
  }

  private async onFileChanged(filePath: string) {
    let contents: string;
    try {
      contents = fs.readFileSync(filePath, "utf-8");
    } catch {
      this.setState({ status: "error", lastError: "Cannot read SavedVariables file" });
      return;
    }

    const hash = crypto.createHash("sha256").update(contents).digest("hex");
    if (hash === this.lastHash) return; // No change
    this.lastHash = hash;

    this.setState({ status: "syncing", lastError: null });

    const data = parseSavedVars(contents);
    if (!data) {
      this.setState({ status: "error", lastError: "Failed to parse SavedVariables" });
      return;
    }

    try {
      await syncToSupabase(data);
      const detail = data.character?.name
        ? `${data.character.name} — ${(data.professions ?? []).map((p) => `${p.name}: ${p.skill}`).join(", ") || "no professions"}`
        : null;
      const recipeSync: RecipeSyncEntry[] = Object.entries(data.known_recipes ?? {}).map(
        ([profession, entry]) => ({
          profession,
          count: entry.recipes?.length ?? 0,
          syncedAt: entry.synced_at,
        })
      );
      this.setState({ status: "ok", lastSync: new Date(), lastError: null, lastSyncDetail: detail, recipeSync });
      if (this.onSynced && data.character?.name && data.professions?.length) {
        this.onSynced(data.character.name, data.professions);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (typeof err === "object" ? JSON.stringify(err) : String(err));
      this.setState({ status: "error", lastError: msg });
    }
  }

  private setState(partial: Partial<WatcherState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange(this.state);
  }
}
