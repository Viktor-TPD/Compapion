import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("compapion", {
  getState:    () => ipcRenderer.invoke("get-state"),
  getConfig:   () => ipcRenderer.invoke("get-config"),
  manualSync:  () => ipcRenderer.invoke("manual-sync"),
  pickWowDir:  () => ipcRenderer.invoke("pick-wow-dir"),
  saveConfig:  (cfg: unknown) => ipcRenderer.invoke("save-config", cfg),
  onState:     (cb: (state: unknown) => void) => ipcRenderer.on("state-update", (_e, s) => cb(s)),
  onConfig:    (cb: (cfg: unknown) => void) => ipcRenderer.on("config-update", (_e, c) => cb(c)),
});
