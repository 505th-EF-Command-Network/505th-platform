/**
 * 505th Command Network — desktop app (Electron). Its own code; talks to the others like Cortana does:
 *   - Website: /api/hub/* with the app token (same access rules as the Terminal, checked on the server)
 *   - 505th Net: listens on Ably "505th-live" (website + Cortana send "this changed" topics)
 * Step H1: sign-in + 505th Net. Dashboard, messages, alerts, tray and installer come next.
 */
import { app, BrowserWindow, ipcMain, powerMonitor, session, shell, type IpcMainInvokeEvent } from "electron";
import { statSync, statfsSync } from "node:fs";
import { join } from "node:path";
import { release } from "node:os";
import { PROTOCOL, createAuth, type AuthState } from "./auth";
import { createNotifier, type NotifyOpts, type Toast } from "./notify";
import { createUpdater } from "./updater";
import { createTrayMenu, type TrayInfo, type TrayNet } from "./tray-menu";
import { createRealtime, type RealtimeState } from "./realtime";

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId("com.505th.commandnetwork");

// cn505:// links (sign-in) open this app. In development Electron needs the script path too.
if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.cwd(), process.argv[1])]);
else app.setAsDefaultProtocolClient(PROTOCOL);

let win: BrowserWindow | null = null;
let quitting = false;
/** App settings pushed by the window (My Settings) — only the bits the main process needs. */
const cfg = { closeToTray: true };
const startHidden = process.argv.includes("--hidden");
const notifier = createNotifier({
  getWin: () => win,
  onAction: (id, action) => { send("notify:action", { id, action }); if (action === "open" || action === "reply" || action === "view") { win?.show(); win?.focus(); } },
  onQuit: () => { quitting = true; app.quit(); },
  onTrayMenu: (at) => { trayMenu.open(at); void refreshTrayNet(); },
});
const showWin = () => { if (!win) return; win.show(); if (win.isMinimized()) win.restore(); win.focus(); };
// Tray menu: Network Status count is fetched when the menu opens (shown from the last fetch).
let trayNet: TrayNet = null;
async function refreshTrayNet() {
  if (auth.getState().status !== "signed-in") return;
  const r = (await call("/api/hub/network").catch(() => null)) as { monitors?: { status: string }[] } | null;
  const ms = r?.monitors?.filter((m) => m.status !== "paused");
  if (ms) trayNet = { total: ms.length, up: ms.filter((m) => m.status === "up" || m.status === "slow").length, down: ms.filter((m) => m.status === "down" || m.status === "stale").length };
}
const trayMenu = createTrayMenu({
  live: () => realtime.getState().state === "live",
  version: () => app.getVersion(),
  net: () => trayNet,
  logo: () => notifier.logoUrl(),
  onAction: (a) => {
    if (a === "quit") { quitting = true; app.quit(); return; }
    if (a === "update") { showWin(); void updater.check(true); return; }
    if (a === "dnd" || a === "startup") { send("tray:toggle", a); return; }
    showWin();
    if (a.startsWith("page/")) send("tray:page", a.slice(5));
  },
});
const send = (ch: string, v: unknown) => win?.webContents.send(ch, v);
const fromMain = (e: IpcMainInvokeEvent) => !!win && e.sender === win.webContents;

const realtime = createRealtime({
  api: (p, i) => auth.api(p, i),
  onTopic: (t) => send("net:topic", t),
  onState: (s: RealtimeState, why) => send("net:state", { state: s, reason: why }),
});
const updater = createUpdater({
  api: (p) => auth.api(p, { headers: { "X-CN-App": app.getVersion() } }),
  send: (ch, v) => send(ch, v),
  getWin: () => win,
  signedIn: () => auth.getState().status === "signed-in",
  onQuit: () => { quitting = true; app.quit(); },
});
const auth = createAuth((s: AuthState) => {
  send("auth:state", s);
  if (s.status === "signed-in") { realtime.start(); updater.start(); }
  if (s.status === "signed-out") { realtime.stop(); trayMenu.setInfo(null); trayNet = null; }
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
  win.once("ready-to-show", () => { if (!startHidden) win?.show(); });
  win.on("closed", () => (win = null));
  // My Settings → "Close button hides to tray": the Hub keeps running so notifications still come.
  win.on("close", (e) => { if (cfg.closeToTray && !quitting) { e.preventDefault(); win?.hide(); } });
  win.on("focus", () => win?.flashFrame(false));
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
/** Sent with every call so My Devices can show the version + Windows build. */
const CN_HEADERS = { "X-CN-App": app.getVersion(), "X-CN-OS": `Windows ${release()}` };
async function call(path: string, init?: RequestInit): Promise<unknown> {
  try {
    const hd = new Headers(init?.headers);
    for (const [k, v] of Object.entries(CN_HEADERS)) hd.set(k, v);
    init = { ...init, headers: hd };
    // Never hang: give up after 25 s so pages show an error instead of LOADING forever.
    const r = await auth.api(path, { ...init, signal: init?.signal ?? AbortSignal.timeout(25_000) });
    const b = await r.json().catch(() => ({}));
    return r.ok ? b : { error: (b as { error?: string }).error ?? `Website error ${r.status}` };
  } catch (err) {
    return { error: (err as Error).name === "TimeoutError" ? "The website took too long to answer — try again" : (err as Error).message };
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
  const audio = folder === "505th_sounds";
  if (!fromMain(e) || !["505th_aar", "505th_gallery", "505th_projects", "505th_msg", "505th_notes", "505th_sounds"].includes(String(folder)) || typeof type !== "string" || !(audio ? /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg)$/ : /^image\/(png|jpeg|webp|gif)$/).test(type) || !(bytes instanceof Uint8Array) || bytes.byteLength > 10 * 1024 * 1024) return { error: "Images only (PNG, JPG, WEBP, GIF), up to 10 MB." };
  const s = (await call("/api/hub/upload-sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) })) as Record<string, unknown>;
  if (s.error) return { error: String(s.error) };
  try {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(bytes)], { type }), String(name || "image").slice(0, 100));
    fd.append("api_key", String(s.apiKey)); fd.append("timestamp", String(s.timestamp)); fd.append("folder", String(s.folder)); fd.append("signature", String(s.signature));
    const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(String(s.cloudName))}/${audio ? "video" : "image"}/upload`, { method: "POST", body: fd, signal: AbortSignal.timeout(60_000) });
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
for (const [ch, path] of [["history", "/api/hub/history"], ["media", "/api/hub/media"], ["oob", "/api/hub/oob"], ["recruit", "/api/hub/recruit"], ["tickets", "/api/hub/tickets"], ["send", "/api/hub/send"], ["projects", "/api/hub/projects"], ["devices", "/api/hub/devices"], ["hub-access", "/api/hub/hub-access"], ["policy", "/api/hub/policy"], ["notes", "/api/hub/notes"], ["feedback", "/api/hub/feedback"]] as const) {
  ipcMain.handle(`hub:${ch}`, (e) => (fromMain(e) ? call(path) : null));
  ipcMain.handle(`hub:${ch}-action`, (e, body: unknown) => {
    if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
    return call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  });
}
// Network Status: GET can ask one monitor's chart (?mon=id&range=24H).
ipcMain.handle("hub:network", (e, mon: unknown, range: unknown) => {
  if (!fromMain(e)) return null;
  const ok = typeof mon === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(mon) && typeof range === "string" && /^(1H|24H|7D|30D|90D)$/.test(range);
  return call(`/api/hub/network${ok ? `?mon=${mon}&range=${range}` : ""}`);
});
ipcMain.handle("hub:network-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/network", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
// Messages: GET can ask for one chat's messages (?conv=id).
ipcMain.handle("hub:messages", (e, conv: unknown) => (fromMain(e) ? call(`/api/hub/messages${typeof conv === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(conv) ? `?conv=${conv}` : ""}`) : null));
ipcMain.handle("hub:messages-action", (e, body: unknown) => {
  if (!fromMain(e) || !body || typeof body !== "object") return { error: "Not allowed." };
  return call("/api/hub/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
});
ipcMain.handle("hub:set-status", (e, s: unknown) => {
  if (!fromMain(e) || !s || typeof s !== "object") return { error: "Not allowed." };
  const { state, note, untilISO } = s as Record<string, unknown>;
  return call("/api/hub/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, note, untilISO }) });
});

// ───────── H3: settings, notifications, tray ─────────
ipcMain.handle("app:settings", (e, s: unknown) => {
  if (!fromMain(e) || !s || typeof s !== "object") return;
  const v = s as { startup?: unknown; closeToTray?: unknown; zoom?: unknown; toggleKey?: unknown };
  cfg.closeToTray = v.closeToTray !== false;
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: v.startup === true, args: ["--hidden"] });
  const z = Number(v.zoom);
  if (win && z >= 0.8 && z <= 1.4) win.webContents.setZoomFactor(z);
  notifier.setToggleKey(typeof v.toggleKey === "string" ? v.toggleKey : "");
});
ipcMain.handle("notify:show", (e, t: unknown, o: unknown) => {
  if (!fromMain(e) || !t || typeof t !== "object" || !o || typeof o !== "object") return;
  const x = t as Toast, y = o as NotifyOpts;
  notifier.show({ id: String(x.id).slice(0, 80), title: String(x.title).slice(0, 120), body: String(x.body ?? "").slice(0, 300), icon: String(x.icon ?? "").slice(0, 4),
    color: String(x.color ?? ""), urgent: x.urgent === true, actions: Array.isArray(x.actions) ? x.actions.slice(0, 3).map((a) => ({ id: String(a.id).replace(/[^\w-]/g, "").slice(0, 20), label: String(a.label).slice(0, 20) })) : [] },
    { popup: y.popup === true, taskbar: y.taskbar === true, edge: y.edge === true, windows: y.windows === true, test: y.test === true,
      style: y.style === "tint" || y.style === "badge" ? y.style : "edge", color: typeof y.color === "string" ? y.color.slice(0, 7) : undefined, safe: y.safe === true, until: y.until === true, stay: y.stay === true });
});
ipcMain.handle("tray:info", (e, i: unknown) => {
  if (!fromMain(e)) return;
  const v = i as Partial<TrayInfo> | null;
  trayMenu.setInfo(v && typeof v === "object" ? { name: String(v.name ?? "").slice(0, 60), role: String(v.role ?? "").slice(0, 20), msgs: Number(v.msgs) || 0, tickets: Number(v.tickets) || 0, dnd: v.dnd === true, startup: v.startup === true } : null);
});
ipcMain.handle("notify:unread", (e, n: unknown) => { if (fromMain(e)) notifier.setUnread(Number(n) || 0); });
ipcMain.handle("update:get", (e) => (fromMain(e) ? updater.getState() : null));
ipcMain.handle("update:check", (e) => (fromMain(e) ? updater.check(true) : null));
ipcMain.handle("update:install", (e) => (fromMain(e) ? updater.install() : null));
// Settings v2 → About / Backup & Reset / Security.
ipcMain.handle("app:sys", (e) => {
  if (!fromMain(e)) return null;
  let installedISO = "", freeGB = 0;
  try { installedISO = statSync(app.getPath("exe")).birthtime.toISOString(); } catch { /* dev */ }
  try { const f = statfsSync(app.getPath("userData")); freeGB = Math.round((f.bavail * f.bsize) / 1e8) / 10; } catch { /* old Node */ }
  return { version: app.getVersion(), windows: release(), installedISO, upMins: Math.round(process.uptime() / 60), freeGB, idleSecs: powerMonitor.getSystemIdleTime() };
});
ipcMain.handle("app:repair", async (e, what: unknown) => {
  if (!fromMain(e)) return "";
  if (what === "cache") { await session.defaultSession.clearCache(); await session.defaultSession.clearStorageData({ storages: ["cachestorage", "serviceworkers", "shadercache"] }); return "Cache cleared"; }
  if (what === "window" && win) { win.unmaximize(); win.setSize(1400, 860); win.center(); return "Window reset"; }
  if (what === "logs") { await shell.openPath(app.getPath("logs")); return "Logs folder opened"; }
  return "";
});
ipcMain.handle("app:quit", (e) => { if (fromMain(e)) { quitting = true; app.quit(); } });
app.on("before-quit", () => { quitting = true; });
app.on("will-quit", () => notifier.stop());

app.whenReady().then(() => {
  // Hub lock "on sleep": tell the window when the PC locks or sleeps.
  powerMonitor.on("lock-screen", () => send("app:sleep", "lock"));
  powerMonitor.on("suspend", () => send("app:sleep", "suspend"));
  notifier.startTray();
  createWindow();
  auth.start();
  const link = deepLinkFrom(process.argv);
  if (link) void auth.handleDeepLink(link);
  // Fallback when the 505th Net is down: re-check every 2 minutes.
  setInterval(() => { if (auth.getState().status === "signed-in" && realtime.getState().state !== "live") void auth.refresh(); }, 120_000);
});

app.on("window-all-closed", () => app.quit());
