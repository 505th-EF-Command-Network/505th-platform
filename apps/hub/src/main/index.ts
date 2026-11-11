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
ipcMain.handle("hub:attendance", (e) => (fromMain(e) ? call("/api/hub/attendance") : null));
ipcMain.handle("hub:attendance-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:events", (e) => (fromMain(e) ? call("/api/hub/events") : null));
ipcMain.handle("hub:events-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:aars", (e) => (fromMain(e) ? call("/api/hub/aars") : null));
ipcMain.handle("hub:aars-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/aars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
/** Image upload (AAR screenshots): the website signs it, the file goes straight to Cloudinary. Images only, max 10 MB. */
ipcMain.handle("hub:upload", async (e, folder: unknown, name: unknown, type: unknown, bytes: unknown) => {
  if (!fromMain(e) || !["505th_aar", "505th_gallery", "505th_projects"].includes(String(folder)) || typeof type !== "string" || !/^image\/(png|jpeg|webp|gif)$/.test(type) || !(bytes instanceof Uint8Array) || bytes.byteLength > 10 * 1024 * 1024) return { error: "Images only (PNG, JPG, WEBP, GIF), up to 10 MB." };
  const s = (await call("/api/hub/upload-sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) })) as Record<string, unknown>;
  if (s.error) return { error: String(s.error) };
  try {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(bytes)], { type }), String(name || "image").slice(0, 100));
    fd.append("api_key", String(s.apiKey)); fd.append("timestamp", String(s.timestamp)); fd.append("folder", String(s.folder)); fd.append("signature", String(s.signature));
    const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(String(s.cloudName))}/image/upload`, { method: "POST", body: fd, signal: AbortSignal.timeout(60_000) });
    const j = (await r.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
    return r.ok && j.secure_url ? { url: j.secure_url } : { error: j.error?.message ?? `Upload failed (${r.status})` };
  } catch (err) {
    return { error: (err as Error).message };
  }
});
ipcMain.handle("hub:bct", (e) => (fromMain(e) ? call("/api/hub/bct") : null));
ipcMain.handle("hub:bct-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/bct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:overview", (e) => (fromMain(e) ? call("/api/hub/overview") : null));
ipcMain.handle("hub:prefs", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:alerts-read", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:rsvp", (e, eventId: unknown, key: unknown) => {
  if (!fromMain(e) || typeof eventId !== "string" || typeof key !== "string") return { error: "Not allowed." };
  return call("/api/hub/rsvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, key }) });
});
for (const [ch, path] of [["history", "/api/hub/history"], ["media", "/api/hub/media"], ["oob", "/api/hub/oob"], ["recruit", "/api/hub/recruit"], ["tickets", "/api/hub/tickets"], ["send", "/api/hub/send"], ["projects", "/api/hub/projects"]] as const) {
  ipcMain.handle(`hub:${ch}`, (e) => (fromMain(e) ? call(path) : null));
  ipcMain.handle(`hub:${ch}-action`, (e, body: unknown) => {
    if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
    return call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  });
}
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
