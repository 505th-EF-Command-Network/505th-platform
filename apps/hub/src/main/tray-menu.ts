import { BrowserWindow, screen, type Rectangle } from "electron";

/**
 * Tray right-click menu (approved mock 2026-11-12). Windows' grey menu can't be styled, so this is a small frameless window
 * in the Hub style that opens above the tray icon. No JavaScript in it: each row is a link (cn-tray://action) that main catches.
 * Keyboard: ↑ ↓ move, Enter picks, Esc closes. Clicking anywhere else closes it.
 */
export type TrayInfo = { name: string; role: string; msgs: number; tickets: number; dnd: boolean; startup: boolean };
export type TrayNet = { up: number; total: number; down: number } | null;
type Deps = { live: () => boolean; version: () => string; net: () => TrayNet; logo: () => string; onAction: (a: string) => void };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ROLE: Record<string, string> = { commander: "Commander", developer: "Developer", officer: "Officer", staff_nco: "Staff NCO", nco: "NCO", recruiter: "Recruiter" };
const W = 300;

export function createTrayMenu(d: Deps) {
  let win: BrowserWindow | null = null;
  let info: TrayInfo | null = null;

  const html = () => {
    const live = d.live(), n = d.net(), i = info;
    const badge = (x: number) => (x > 0 ? `<span class="bd">${x > 99 ? "99+" : x}</span>` : "");
    const sw = (on: boolean) => `<span class="sw${on ? "" : " off"}" aria-hidden="true"></span><span class="sr">${on ? "on" : "off"}</span>`;
    const netTxt = !n ? "" : n.down ? `<span class="k" style="color:#ff4d4d">${n.down} DOWN</span>` : `<span class="k" style="color:#22e07a">${n.up}/${n.total} UP</span>`;
    const row = (a: string, icon: string, label: string, right = "", cls = "") => `<a class="it ${cls}" href="cn-tray://${a}" role="menuitem"><i aria-hidden="true">${icon}</i><span>${label}</span>${right}</a>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:transparent;overflow:hidden;font:13px "Segoe UI",Arial,sans-serif;color:#d6dde6;user-select:none}
.m{position:absolute;inset:0;background:#0d141c;border:1px solid #00d9ff40;border-radius:6px;overflow:hidden;animation:in .12s ease-out}@keyframes in{from{transform:translateY(6px);opacity:0}}@media(prefers-reduced-motion:reduce){.m{animation:none}}
.hd{display:flex;gap:10px;align-items:center;padding:12px 14px;background:linear-gradient(90deg,#00d9ff14,transparent);border-bottom:1px solid #00d9ff26}
.hd img,.lg{width:34px;height:34px;border-radius:50%;border:1px solid #00d9ff66;background:#070a0f}.hd b{display:block;font-weight:700;font-size:14px;letter-spacing:2px;color:#fff}.hd small{font-size:10.5px;letter-spacing:1.5px}
.who{padding:8px 14px;font-size:11.5px;color:#9aa7b4;border-bottom:1px solid #ffffff0d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.who b{color:#fff;font-weight:600}
.sec{padding:5px 0;border-bottom:1px solid #ffffff0d}
.it{display:flex;align-items:center;gap:10px;padding:7px 14px;color:inherit;text-decoration:none;outline:0}.it:hover,.it:focus{background:#00d9ff1f}.it:focus{box-shadow:inset 3px 0 #00D9FF}
.it i{width:18px;text-align:center;font-style:normal;color:#00D9FF}.it span{flex:1}
.bd{flex:none!important;background:#ff4d4d;color:#fff;font-size:10px;font-weight:700;padding:0 6px;border-radius:8px}.k{flex:none!important;font-size:10px;color:#4b5765;letter-spacing:1px}
.sw{flex:none!important;width:28px;height:15px;border-radius:8px;background:#22e07a;position:relative}.sw:after{content:"";position:absolute;right:2px;top:2px;width:11px;height:11px;border-radius:50%;background:#000}
.sw.off{background:#2a3540}.sw.off:after{left:2px;right:auto;background:#7d8a99}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.q{color:#ff8080}.q i{color:#ff4d4d}.ft{padding:6px 14px;font-size:10px;color:#4b5765;letter-spacing:1px;display:flex;justify-content:space-between;background:#070a0f}</style></head>
<body><div class="m" role="menu" aria-label="505th Command Network">
<div class="hd">${d.logo() ? `<img src="${d.logo()}" alt="">` : '<div class="lg"></div>'}<div><b>505TH COMMAND NETWORK</b><small style="color:${live ? "#22e07a" : "#f59e0b"}">● ${live ? "HUB LIVE · OPERATIONAL" : i ? "HUB · RECONNECTING" : "NOT SIGNED IN"}</small></div></div>
${i ? `<div class="who">Signed in as <b>${esc(i.name)}</b> · ${esc(ROLE[i.role] ?? i.role)}</div>` : ""}
<div class="sec">${row("open", "⌂", "Open Command Network")}${i ? row("page/panel-msg2", "✉", "Messages", badge(i.msgs)) + row("page/panel-tickets", "🎫", "Tickets", badge(i.tickets)) + row("page/panel-network", "◉", "Network Status", netTxt) : ""}</div>
${i ? `<div class="sec">${row("dnd", "🔕", "Do Not Disturb", sw(i.dnd))}${row("startup", "⏻", "Start with Windows", sw(i.startup))}</div>
<div class="sec">${row("update", "↻", "Check for updates")}${row("page/my-settings", "⚙", "Settings")}</div>` : ""}
<div class="sec" style="border:0">${row("quit", "✕", "Quit Hub", "", "q")}</div>
<div class="ft"><span>v${esc(d.version())}</span><span>© 505th EF · RCD</span></div></div></body></html>`;
  };
  const height = () => (info ? 404 : 210);

  function close() { if (win && !win.isDestroyed()) win.close(); win = null; }

  function open(at: Rectangle) {
    close();
    const h = height(), wa = screen.getDisplayMatching(at).workArea;
    const x = Math.min(Math.max(wa.x + 4, Math.round(at.x + at.width / 2 - W / 2)), wa.x + wa.width - W - 4);
    const y = at.y > wa.y + wa.height / 2 ? Math.max(wa.y + 4, wa.y + wa.height - h - 6) : wa.y + 6; // taskbar at the bottom (usual) or top
    const w = new BrowserWindow({ x, y, width: W, height: h, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
      skipTaskbar: true, alwaysOnTop: true, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
    win = w;
    w.setAlwaysOnTop(true, "pop-up-menu");
    w.webContents.on("will-navigate", (e, url) => {
      e.preventDefault();
      if (!url.startsWith("cn-tray://")) return;
      const a = url.replace(/^cn-tray:\/\//, "").replace(/\/$/, "");
      close();
      d.onAction(a);
    });
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // ↑ ↓ move between rows (as Tab / Shift+Tab), Esc closes.
    w.webContents.on("before-input-event", (e, k) => {
      if (k.type !== "keyDown") return;
      if (k.key === "Escape") { e.preventDefault(); close(); }
      else if (k.key === "ArrowDown" || k.key === "ArrowUp") { e.preventDefault(); w.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab", modifiers: k.key === "ArrowUp" ? ["shift"] : [] }); }
    });
    w.on("blur", () => close());
    w.once("ready-to-show", () => { w.show(); w.focus(); w.webContents.sendInputEvent({ type: "keyDown", keyCode: "Tab" }); });
    void w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html()));
  }

  return { open, close, setInfo: (i: TrayInfo | null) => { info = i; } };
}
