import { BrowserWindow, Notification, Tray, type Rectangle, app, globalShortcut, nativeImage, screen, type NativeImage } from "electron";
import { join } from "node:path";

/**
 * H3 desktop notifications + tray (approved mock 2026-11-11). Visual first — sound is played by the window and is OFF by default.
 *   - Pop-up card: small 505th-style window, bottom right, above other apps, never steals focus. Closes after 8 s.
 *   - Taskbar flash: the Hub button flashes amber until you open the Hub.
 *   - Screen-edge flash (urgent only): a click-through amber border round the screen, 4 blinks.
 *   - Tray icon: unread count in the tooltip + a red dot on the taskbar button.
 * Card buttons are plain links the main process catches (cn-toast://…) — the card has no Node, no preload, no script.
 */
export type Toast = { id: string; title: string; body: string; icon?: string; color?: string; actions?: { id: string; label: string }[]; urgent?: boolean };
/** style/color/safe/until/stay come from Accessibility → Visual alerts. */
export type NotifyOpts = { popup: boolean; taskbar: boolean; edge: boolean; windows?: boolean; test?: boolean;
  style?: "edge" | "tint" | "badge"; color?: string; safe?: boolean; until?: boolean; stay?: boolean };
type Hooks = { getWin: () => BrowserWindow | null; onAction: (toastId: string, action: string) => void; onQuit: () => void; onTrayMenu: (at: Rectangle) => void };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const W = 380, GAP = 10;

export function createNotifier(h: Hooks) {
  const cards: { win: BrowserWindow; h: number; timer: NodeJS.Timeout | null }[] = [];
  let tray: Tray | null = null;
  let logo: NativeImage | null = null;
  let logoData = "";
  let unread = 0;

  const getLogo = () => {
    if (!logo) {
      logo = nativeImage.createFromPath(join(app.getAppPath(), "assets/logo.png"));
      logoData = logo.isEmpty() ? "" : logo.resize({ width: 44, height: 44 }).toDataURL();
    }
    return logo;
  };
  const place = () => {
    const wa = screen.getPrimaryDisplay().workArea;
    let y = wa.y + wa.height - GAP;
    for (const c of [...cards].reverse()) { y -= c.h; if (!c.win.isDestroyed()) c.win.setBounds({ x: wa.x + wa.width - W - GAP, y, width: W, height: c.h }); y -= GAP; }
  };
  const close = (win: BrowserWindow) => {
    const i = cards.findIndex((c) => c.win === win);
    if (i >= 0) { if (cards[i]!.timer) clearTimeout(cards[i]!.timer!); cards.splice(i, 1); }
    if (!win.isDestroyed()) win.close();
    place();
  };

  function card(t: Toast, stay = false) {
    getLogo();
    while (cards.length >= 3) close(cards[0]!.win);
    const c = t.color && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#00d9ff";
    const acts = (t.actions ?? []).slice(0, 3);
    const hgt = acts.length ? 150 : 112;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:transparent;overflow:hidden;font:13px "Segoe UI",Arial,sans-serif;color:#dbe7ee;user-select:none}
.c{position:absolute;inset:0;background:#0b0f15;border:1px solid ${c};box-shadow:inset 0 0 24px ${c}22;animation:in .25s ease-out}@keyframes in{from{transform:translateX(40px);opacity:0}}
@media(prefers-reduced-motion:reduce){.c{animation:none}}
.c:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,${c},transparent)}
.h{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:1px solid #00d9ff1a;font:600 10px "Segoe UI";letter-spacing:2.5px;color:#7d8a99}.h img{width:18px;height:18px}
.h a{margin-left:auto;width:22px;height:22px;display:grid;place-items:center;border:1px solid #00d9ff33;color:#c6d0da;text-decoration:none;font-size:13px;letter-spacing:0}.h a:hover{color:#fff;border-color:#ff4d4d;background:#ff4d4d33}
.b{display:flex;gap:10px;padding:10px 12px;cursor:pointer;text-decoration:none;color:inherit}.i{width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;font-size:20px;color:${c}}
.t{font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m{color:#aeb9c4;font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.a{display:flex;gap:6px;padding:0 12px 10px 56px}.a a{border:1px solid #00d9ff40;padding:3px 10px;font-size:10.5px;letter-spacing:1.5px;color:#fff;text-decoration:none}.a a:hover{background:#00d9ff1a;border-color:${c}}</style></head>
<body><div class="c" role="alert"><div class="h">${logoData ? `<img src="${logoData}" alt="">` : ""}505TH COMMAND NETWORK<a href="cn-toast://close" aria-label="Close">✕</a></div>
<a class="b" href="cn-toast://open"><div class="i">${esc(t.icon || "🔔")}</div><div style="min-width:0"><div class="t">${esc(t.title)}</div><div class="m">${esc(t.body)}</div></div></a>
${acts.length ? `<div class="a">${acts.map((a) => `<a href="cn-toast://${esc(a.id)}">${esc(a.label)}</a>`).join("")}</div>` : ""}</div></body></html>`;
    const win = new BrowserWindow({ width: W, height: hgt, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    win.setAlwaysOnTop(true, "screen-saver");
    const act = (url: string) => { const a = url.replace(/^cn-toast:\/\//, "").replace(/\/$/, ""); if (a !== "close") h.onAction(t.id, a); close(win); };
    win.webContents.on("will-navigate", (e, url) => { e.preventDefault(); if (url.startsWith("cn-toast://")) act(url); });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.once("ready-to-show", () => win.showInactive());
    void win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    cards.push({ win, h: hgt, timer: stay ? null : setTimeout(() => close(win), t.urgent ? 15_000 : 8_000) });
    place();
  }

  /** Visual alert round the screen, click-through: border (edge), colour wash (tint) or a corner dot (badge).
   *  safe = no blinking (slow fade). until = stays until you move the mouse (max 60 s). */
  function edge(o: NotifyOpts) {
    const col = o.color && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : "#f59e0b";
    const look = o.style === "tint" ? `background:${col}33` : o.style === "badge" ? `inset:auto 24px auto auto;top:24px;width:46px;height:46px;border-radius:50%;background:${col};box-shadow:0 0 30px ${col}` : `border:8px solid ${col};box-shadow:inset 0 0 40px ${col}88`;
    const anim = o.safe ? "animation:s 2.4s ease-in-out both" : o.until ? "animation:f 1s infinite both" : "animation:f .5s 4 both";
    const d = screen.getPrimaryDisplay().bounds;
    const win = new BrowserWindow({ ...d, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, hasShadow: false,
      webPreferences: { sandbox: true, javascript: false } });
    win.setIgnoreMouseEvents(true);
    win.setAlwaysOnTop(true, "screen-saver");
    const html = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}
div{position:fixed;inset:0;${look};${anim}}@keyframes f{0%,100%{opacity:0}50%{opacity:1}}@keyframes s{0%,100%{opacity:0}30%,70%{opacity:1}}
@media(prefers-reduced-motion:reduce){div{animation:none;opacity:1}}</style></head><body><div></div></body></html>`;
    win.once("ready-to-show", () => win.showInactive());
    void win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    if (!o.until) { setTimeout(() => !win.isDestroyed() && win.close(), 2400); return; }
    // Until noticed: close when the mouse moves (or after 60 s).
    const start = screen.getCursorScreenPoint(), t0 = Date.now();
    const iv = setInterval(() => {
      const p = screen.getCursorScreenPoint();
      if (win.isDestroyed() || Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 40 || Date.now() - t0 > 60_000) { clearInterval(iv); if (!win.isDestroyed()) win.close(); }
    }, 300);
  }

  /** Windows notification (Action Center). Click → open the Hub. Works in the installed app (needs the Start-menu shortcut). */
  function windowsToast(t: Toast) {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: t.title, body: t.body, icon: getLogo().isEmpty() ? undefined : getLogo(), silent: true, timeoutType: t.urgent ? "never" : "default" });
    n.on("click", () => { const w = h.getWin(); if (w) { w.show(); if (w.isMinimized()) w.restore(); w.focus(); } h.onAction(t.id, "open"); });
    n.show();
  }

  function show(t: Toast, o: NotifyOpts) {
    const w = h.getWin();
    // A TEST always shows, even while you're looking at the Hub (real alerts don't, so they don't interrupt you).
    const looking = !o.test && !!w && w.isVisible() && w.isFocused();
    if (o.popup && !looking) card(t, o.stay === true);
    if (o.windows && !looking) windowsToast(t);
    if (o.edge && (t.urgent || o.test) && !looking) edge(o);
    if (o.taskbar && w) {
      if (!looking && !w.isFocused()) w.flashFrame(true);
      // Windows only flashes a window that isn't in front — for a test, flash once you switch away (within 5 s).
      else if (o.test) { const on = () => { w.flashFrame(true); w.off("blur", on); }; w.on("blur", on); setTimeout(() => w.off("blur", on), 5000); }
    }
    return;
  }

  function setUnread(n: number) {
    unread = Math.max(0, n | 0);
    tray?.setToolTip(unread ? `505th Command Network — ${unread} unread` : "505th Command Network");
    const w = h.getWin();
    if (!w) return;
    if (unread) {
      const dot = nativeImage.createFromDataURL("data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#ff4d4d" stroke="#fff" stroke-width="1.5"/></svg>`).toString("base64"));
      w.setOverlayIcon(dot.isEmpty() ? null : dot, `${unread} unread`);
    } else w.setOverlayIcon(null, "");
  }

  function startTray() {
    if (tray) return;
    const img = getLogo();
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img.resize({ width: 16, height: 16 }));
    const showWin = () => { const w = h.getWin(); if (w) { w.show(); if (w.isMinimized()) w.restore(); w.focus(); } };
    // Right-click → the 505th-style tray menu (tray-menu.ts).
    tray.on("right-click", () => tray && h.onTrayMenu(tray.getBounds()));
    tray.on("click", showWin);
    setUnread(unread);
  }

  let toggleKey = "";
  /** Show / hide the Hub from anywhere (My Shortcuts → "Show / hide the Hub"). */
  function setToggleKey(k: string) {
    const acc = k.replace(/^Ctrl\+/, "CommandOrControl+").replace(/\+Ctrl\+/, "+CommandOrControl+");
    if (acc === toggleKey) return;
    if (toggleKey) globalShortcut.unregister(toggleKey);
    toggleKey = "";
    if (!/\+/.test(acc)) return; // a single key would block typing everywhere
    try {
      if (globalShortcut.register(acc, () => { const w = h.getWin(); if (!w) return; if (w.isVisible() && w.isFocused()) w.hide(); else { w.show(); w.focus(); } })) toggleKey = acc;
    } catch { /* taken by another app */ }
  }

  return { show, setUnread, logoUrl: () => { getLogo(); return logoData; }, startTray, setToggleKey, stop: () => { globalShortcut.unregisterAll(); tray?.destroy(); tray = null; cards.forEach((c) => !c.win.isDestroyed() && c.win.close()); } };
}
