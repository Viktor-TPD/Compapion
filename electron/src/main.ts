import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { SavedVarsWatcher } from "./watcher";
import type { WatcherState } from "./watcher";

// ─── Config persistence ──────────────────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

interface Config {
  wowDir: string | null;
  accountName: string | null;
  realmName: string | null;
  characterName: string | null;
}

function loadConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { wowDir: null, accountName: null, realmName: null, characterName: null };
  }
}

function saveConfig(cfg: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function buildLuaPath(cfg: Config): string | null {
  if (!cfg.wowDir || !cfg.accountName || !cfg.realmName || !cfg.characterName) return null;
  return path.join(
    cfg.wowDir,
    "WTF",
    "Account",
    cfg.accountName,
    cfg.realmName,
    cfg.characterName,
    "SavedVariables",
    "Compapion.lua"
  );
}

// ─── Tray icon helpers ───────────────────────────────────────────────────────

const ICON_DIR = path.join(__dirname, "..", "assets");

function getTrayIcon(status: WatcherState["status"]): Electron.NativeImage {
  const name = status === "ok" ? "tray-green" : status === "error" ? "tray-red" : "tray-yellow";
  const file = path.join(ICON_DIR, `${name}.png`);
  if (fs.existsSync(file)) return nativeImage.createFromPath(file);
  // Fallback: empty 16x16
  return nativeImage.createEmpty();
}

// ─── Main window ────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(state: WatcherState, config: Config): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 420,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, "..", "ui", "index.html"));

  win.on("blur", () => {
    win.hide();
  });

  return win;
}

// ─── App bootstrap ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const config = loadConfig();
  let watcher: SavedVarsWatcher | null = null;
  let tray: Tray;
  let state: WatcherState = { status: "idle", lastSync: null, lastError: null };

  function onStateChange(newState: WatcherState) {
    state = newState;
    tray.setImage(getTrayIcon(state.status));
    if (mainWindow?.isVisible()) {
      mainWindow.webContents.send("state-update", state);
    }
  }

  function startWatcher() {
    const luaPath = buildLuaPath(config);
    if (!luaPath) return;
    watcher?.stop();
    watcher = new SavedVarsWatcher(onStateChange);
    watcher.start(luaPath);
  }

  tray = new Tray(getTrayIcon("idle"));
  tray.setToolTip("Compapion");

  tray.on("click", () => {
    if (!mainWindow) {
      mainWindow = createWindow(state, config);
      mainWindow.on("closed", () => { mainWindow = null; });
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      const { x, y, width } = tray.getBounds();
      mainWindow.setPosition(Math.round(x - 320 / 2 + width / 2), Math.round(y - 420));
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
    watcher = new SavedVarsWatcher(onStateChange);
    watcher.start(luaPath);
    return { ok: true };
  });

  ipcMain.handle("pick-wow-dir", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;

    config.wowDir = result.filePaths[0];

    // Try to auto-detect account/realm/character from WTF directory
    const wtfPath = path.join(config.wowDir, "WTF", "Account");
    if (fs.existsSync(wtfPath)) {
      const accounts = fs.readdirSync(wtfPath).filter((n) => !n.startsWith("."));
      if (accounts.length === 1) {
        config.accountName = accounts[0];
        const realmPath = path.join(wtfPath, accounts[0]);
        const realms = fs.readdirSync(realmPath).filter((n) => !n.startsWith(".") && n !== "SavedVariables");
        if (realms.length === 1) {
          config.realmName = realms[0];
          const charPath = path.join(realmPath, realms[0]);
          const chars = fs.readdirSync(charPath).filter((n) => !n.startsWith("."));
          if (chars.length === 1) config.characterName = chars[0];
        }
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

  app.on("window-all-closed", (e: Event) => e.preventDefault());
});
