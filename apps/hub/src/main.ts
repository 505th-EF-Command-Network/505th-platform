/**
 * 505th Command Network — desktop app (Electron).
 * Step 1: main window showing the Command Terminal.
 * Tray, alerts, status, auto-update and app access come in the next steps.
 */
import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";

const TERMINAL_URL = process.env.CN_URL || "https://www.505expeditionaryforce.com/terminal";
const ORIGIN = new URL(TERMINAL_URL).origin;

if (!app.requestSingleInstanceLock()) app.quit();

let main: BrowserWindow | null = null;

function createMain(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    show: false, backgroundColor: "#080b10", title: "505th Command Network",
    icon: join(__dirname, "../assets/logo.png"), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Links to other sites open in the normal browser, not inside the app.
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== ORIGIN) { void shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  w.webContents.on("will-navigate", (e, url) => {
    const o = new URL(url).origin;
    // Discord sign-in goes through discord.com and back.
    if (o !== ORIGIN && o !== "https://discord.com") { e.preventDefault(); void shell.openExternal(url); }
  });
  w.on("closed", () => (main = null));
  void w.loadURL(TERMINAL_URL);
  return w;
}

app.on("second-instance", () => {
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
});

app.whenReady().then(() => {
  main = createMain();
  // No start-up splash (removed 2026-11-11). Show the window as soon as the first page has drawn.
  main.once("ready-to-show", () => main?.show());
});

app.on("window-all-closed", () => app.quit());
