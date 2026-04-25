import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
  clipboard,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { SavedVarsWatcher } from "./watcher";
import type { WatcherState } from "./watcher";

// ─── App logger ──────────────────────────────────────────────────────────────

const LOG_PATH = path.join(app.getPath("userData"), "compapion.log");
const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2MB

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    // Rotate if too large
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_PATH, LOG_PATH + ".old");
    }
    fs.appendFileSync(LOG_PATH, line);
  } catch { /* ignore logging errors */ }
}

// ─── Config persistence ──────────────────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

interface Config {
  wowDir: string | null;
  accountName: string | null;
  pinned?: boolean;
}

function loadConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { wowDir: null, accountName: null };
  }
}

function saveConfig(cfg: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function buildLuaPath(cfg: Config): string | null {
  if (!cfg.wowDir || !cfg.accountName) return null;
  return path.join(
    cfg.wowDir,
    "WTF",
    "Account",
    cfg.accountName,
    "SavedVariables",
    "Compapion.lua"
  );
}

// ─── Tray icon helpers ───────────────────────────────────────────────────────

const ICON_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked", "assets")
  : path.join(app.getAppPath(), "assets");

const ADDON_SRC = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar.unpacked", "addon")
  : path.join(app.getAppPath(), "addon");

function getTrayIcon(_status: WatcherState["status"]): Electron.NativeImage {
  for (const name of ["tray.png", "icon.png"]) {
    const file = path.join(ICON_DIR, name);
    if (fs.existsSync(file)) return nativeImage.createFromPath(file);
  }
  return nativeImage.createEmpty();
}

// ─── Main window ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(state: WatcherState, config: Config): BrowserWindow {
  const iconFile = path.join(ICON_DIR, "icon.png");
  const win = new BrowserWindow({
    width: 320,
    height: 520,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(app.getAppPath(), "ui", "index.html"));

  win.on("blur", () => {
    if (!config.pinned) win.hide();
  });

  return win;
}

// ─── App bootstrap ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const config = loadConfig();
  let watcher: SavedVarsWatcher | null = null;
  let tray: Tray;
  let state: WatcherState = { status: "idle", lastSync: null, lastError: null, lastSyncDetail: null, recipeSync: [] };

  function onStateChange(newState: WatcherState) {
    state = newState;
    tray.setImage(getTrayIcon(state.status));
    const errDetail = state.lastError
      ? " — " + (typeof state.lastError === "object" ? JSON.stringify(state.lastError) : state.lastError)
      : "";
    log(`Status: ${state.status}${errDetail}`);
    if (mainWindow?.isVisible()) {
      mainWindow.webContents.send("state-update", state);
    }
  }

  function startWatcher() {
    const luaPath = buildLuaPath(config);
    if (!luaPath) return;
    watcher?.stop();
    watcher = new SavedVarsWatcher(onStateChange);
    watcher.onSynced = (charName, professions) => {
      const profStr = professions.map((p) => `${p.name}: ${p.skill}`).join(" | ");
      tray.displayBalloon?.({
        title: `Compapion — ${charName} synced`,
        content: profStr || "Session saved.",
        iconType: "info",
      });
    };
    watcher.start(luaPath);
  }

  tray = new Tray(getTrayIcon("idle"));
  tray.setToolTip("Compapion");

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Compapion", enabled: false },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]));

  tray.on("click", () => {
    if (!mainWindow) {
      mainWindow = createWindow(state, config);
      mainWindow.on("closed", () => { mainWindow = null; });
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      const { x, y, width } = tray.getBounds();
      mainWindow.setPosition(Math.round(x - 320 / 2 + width / 2), Math.round(y - 520));
      mainWindow.show();
      mainWindow.webContents.send("state-update", state);
      mainWindow.webContents.send("config-update", config);
    }
  });

  // ─── IPC handlers ───────────────────────────────────────────────────────

  ipcMain.handle("get-state", () => state);
  ipcMain.handle("get-config", () => config);

  ipcMain.handle("manual-sync", async () => {
    const luaPath = buildLuaPath(config);
    if (!luaPath) return { error: "WoW directory not configured" };
    watcher?.stop();
    startWatcher();
    return { ok: true };
  });

  ipcMain.handle("pick-wow-dir", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;

    config.wowDir = result.filePaths[0];

    // Auto-detect account name from WTF directory
    const wtfPath = path.join(config.wowDir, "WTF", "Account");
    if (fs.existsSync(wtfPath)) {
      const accounts = fs.readdirSync(wtfPath).filter((n) => !n.startsWith(".") && n !== "SavedVariables");
      if (accounts.length === 1) {
        config.accountName = accounts[0];
      }
    }

    saveConfig(config);
    startWatcher();
    return config;
  });

  ipcMain.handle("save-config", (_e, newConfig: Partial<Config>) => {
    Object.assign(config, newConfig);
    saveConfig(config);
    startWatcher();
    return config;
  });

  ipcMain.handle("install-addon", () => {
    if (!config.wowDir) return { error: "Set your WoW directory first." };
    const dest = path.join(config.wowDir, "Interface", "AddOns", "Compapion");
    try {
      fs.mkdirSync(dest, { recursive: true });
      for (const file of ["Compapion.lua", "Compapion.toc"]) {
        fs.copyFileSync(path.join(ADDON_SRC, file), path.join(dest, file));
      }
      log(`Addon installed to ${dest}`);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Addon install failed: ${msg}`);
      return { error: msg };
    }
  });

  ipcMain.handle("copy-logs", () => {
    try {
      const contents = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf-8") : "No logs yet.";
      clipboard.writeText(contents);
      return { ok: true };
    } catch {
      return { error: "Could not read log file." };
    }
  });

  log("Compapion started");

  // First launch — prompt for WoW dir if not set
  if (!config.wowDir) {
    tray.displayBalloon?.({
      title: "Compapion",
      content: "Click the tray icon to set your WoW directory.",
      iconType: "info",
    });
  } else {
    startWatcher();
  }

  app.on("window-all-closed", () => { /* keep alive as tray app */ });
});
