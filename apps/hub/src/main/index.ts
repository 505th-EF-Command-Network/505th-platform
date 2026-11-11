/**
 * 505th Command Network — desktop app (Electron). Its own code; talks to the others like Cortana does:
 *   - Website: /api/hub/* with the app token (same access rules as the Terminal, checked on the server)
 *   - 505th Net: listens on Ably "505th-live" (website + Cortana send "this changed" topics)
 * Step H1: sign-in + 505th Net. Dashboard, messages, alerts, tray and installer come next.
 */
import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { PROTOCOL, createAuth, type AuthState } from "./auth";
import { createRealtime, type RealtimeState } from "./realtime";

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("com.505th.commandnetwork");

// cn505:// links (sign-in) open this app. In development Electron needs the script path too.
if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.cwd(), process.argv[1])]);
else app.setAsDefaultProtocolClient(PROTOCOL);

let win: BrowserWindow | null = null;
const send = (ch: string, v: unknown) => win?.webContents.send(ch, v);
const fromMain = (e: IpcMainInvokeEvent) => !!win && e.sender === win.webContents;

const realtime = createRealtime({
  api: (p, i) => auth.api(p, i),
  onTopic: (t) => send("net:topic", t),
  onState: (s: RealtimeState, why) => send("net:state", { state: s, reason: why }),
});
const auth = createAuth((s: AuthState) => {
  send("auth:state", s);
  if (s.status === "signed-in") realtime.start();
  if (s.status === "signed-out") realtime.stop();
});

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1100, minHeight: 680,
    show: false, backgroundColor: "#080b10", title: "505th Command Network",
    icon: join(app.getAppPath(), "assets/logo.png"), autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // The window only shows the app's own screens. Any link opens in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));
  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  else void win.loadFile(join(__dirname, "../renderer/index.html"));
}

const deepLinkFrom = (argv: string[]) => argv.find((a) => a.startsWith(`${PROTOCOL}://`));
app.on("second-instance", (_e, argv) => {
  const link = deepLinkFrom(argv);
  if (link) void auth.handleDeepLink(link);
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
});

// ───────── window ↔ main (only our own window may call) ─────────
ipcMain.handle("auth:get", (e) => (fromMain(e) ? auth.getState() : null));
ipcMain.handle("auth:login", (e) => { if (fromMain(e)) auth.login(); });
ipcMain.handle("auth:cancel", (e) => { if (fromMain(e)) auth.cancel(); });
ipcMain.handle("auth:logout", (e) => (fromMain(e) ? auth.logout() : undefined));
ipcMain.handle("auth:retry", (e) => (fromMain(e) ? auth.refresh() : undefined));
ipcMain.handle("net:get", (e) => (fromMain(e) ? realtime.getState() : null));
ipcMain.handle("app:info", (e) => (fromMain(e) ? { version: app.getVersion(), packaged: app.isPackaged } : null));

/** Website API calls the screens may make. Fixed list — the window can't call any other path. */
async function call(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const r = await auth.api(path, init);
    const b = await r.json().catch(() => ({}));
    return r.ok ? b : { error: (b as { error?: string }).error ?? `Website error ${r.status}` };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
ipcMain.handle("hub:summary", (e) => (fromMain(e) ? call("/api/hub/summary") : null));
ipcMain.handle("hub:members", (e) => (fromMain(e) ? call("/api/hub/members") : null));
ipcMain.handle("hub:member", (e, id: unknown) => (fromMain(e) && typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? call(`/api/hub/members/${id}`) : { error: "Invalid member." }));
ipcMain.handle("hub:member-action", (e, id: unknown, body: unknown) => {
  if (!fromMain(e) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call(`/api/hub/members/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:roster", (e) => (fromMain(e) ? call("/api/hub/roster") : null));
ipcMain.handle("hub:roster-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/roster", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:set-status", (e, s: unknown) => {
  if (!fromMain(e) || !s || typeof s !== "object") return { error: "Not allowed." };
  const { state, note, untilISO } = s as Record<string, unknown>;
  return call("/api/hub/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, note, untilISO }) });
});


app.whenReady().then(() => {
  createWindow();
  auth.start();
  const link = deepLinkFrom(process.argv);
  if (link) void auth.handleDeepLink(link);
  // Fallback when the 505th Net is down: re-check every 2 minutes.
  setInterval(() => { if (auth.getState().status === "signed-in" && realtime.getState().state !== "live") void auth.refresh(); }, 120_000);
});

app.on("window-all-closed", () => app.quit());
