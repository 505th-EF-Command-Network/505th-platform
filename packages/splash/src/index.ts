/**
 * @505th/splash — reusable Opera-style start-up splash for Electron apps (approved mock 2026-11-11).
 *
 * A borderless, transparent window that shows only the logo:
 *   fade + zoom in → hold → fade + zoom out, then the main window is shown.
 * No sound. Never longer than `durationMs`. The main window loads behind it the whole time.
 *
 * Usage (Electron main process, after app.whenReady()):
 *   const main = new BrowserWindow({ show: false, ... });
 *   main.loadURL(url);
 *   await playSplash({ logoPath: join(__dirname, "../assets/logo.png"), mainWindow: main });
 */
import { BrowserWindow, screen, systemPreferences } from "electron";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

export interface SplashOptions {
  /** PNG / SVG / WebP logo with a transparent background. */
  logoPath: string;
  /** Window to show when the splash ends. It should be created with `show: false`. */
  mainWindow?: BrowserWindow;
  /** Total time, 1500–2000 ms recommended. Default 1800. */
  durationMs?: number;
  /** Logo size in screen pixels (DPI-aware). Default 180. */
  size?: number;
  /** Glow colour behind the logo. Default 505th cyan. Use "transparent" for none. */
  glow?: string;
  /** Wait after the logo has fully faded out before showing the main window. Default 0 (window appears during the fade). */
  gapAfterMs?: number;
  /** Skip the animation (e.g. started with Windows into the tray). */
  skip?: boolean;
}

const MIME: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/** True when Windows / macOS asks apps to reduce animations. */
export function prefersReducedMotion(): boolean {
  try {
    const s = systemPreferences.getAnimationSettings();
    return !s.shouldRenderRichAnimation || s.prefersReducedMotion;
  } catch {
    return false;
  }
}

function pageHtml(logo: string, ms: number, glow: string): string {
  // Phases: 28% fade + zoom in · 44% hold (very slow drift) · 28% fade + zoom out.
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;-webkit-user-select:none;user-select:none;cursor:default}
body{display:grid;place-items:center}
img{width:72%;height:72%;object-fit:contain;opacity:0;transform:scale(.86);will-change:opacity,transform;
  filter:drop-shadow(0 0 22px ${glow}) drop-shadow(0 8px 24px rgba(0,0,0,.55));
  animation:s ${ms}ms cubic-bezier(.22,.61,.36,1) forwards}
@keyframes s{0%{opacity:0;transform:scale(.86)}28%{opacity:1;transform:scale(1)}72%{opacity:1;transform:scale(1.02)}100%{opacity:0;transform:scale(1.08)}}
</style></head><body><img src="${logo}" alt=""></body></html>`;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const readyToShow = (w: BrowserWindow) =>
  new Promise<void>((r) => {
    if (w.isDestroyed() || w.isVisible()) return r();
    w.once("ready-to-show", () => r());
    // Safety net: never leave the user with nothing on screen.
    setTimeout(r, 8000);
  });

/** Plays the splash, then shows `mainWindow`. Resolves when the main window is shown. */
export async function playSplash(o: SplashOptions): Promise<void> {
  const ms = Math.min(4000, Math.max(800, o.durationMs ?? 1800));
  const showMain = async () => {
    const w = o.mainWindow;
    if (!w || w.isDestroyed()) return;
    await readyToShow(w);
    if (!w.isDestroyed() && !w.isVisible()) w.show();
  };
  if (o.skip || prefersReducedMotion()) return showMain();

  let logo: string;
  try {
    logo = `data:${MIME[extname(o.logoPath).toLowerCase()] || "image/png"};base64,${readFileSync(o.logoPath).toString("base64")}`;
  } catch {
    return showMain(); // no logo → no splash, just open the app
  }

  // The window is a little larger than the logo so the zoom-out and glow are not clipped.
  const size = Math.round((o.size ?? 180) / 0.72 * 1.12);
  const { workArea } = screen.getPrimaryDisplay();
  const splash = new BrowserWindow({
    width: size, height: size,
    x: Math.round(workArea.x + (workArea.width - size) / 2),
    y: Math.round(workArea.y + (workArea.height - size) / 2),
    frame: false, transparent: true, backgroundColor: "#00000000", hasShadow: false,
    resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, backgroundThrottling: false },
  });
  splash.setIgnoreMouseEvents(true);

  const loaded = new Promise<void>((r) => { splash.once("ready-to-show", () => r()); setTimeout(r, 1500); });
  await splash.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(pageHtml(logo, ms, o.glow ?? "rgba(0,217,255,.35)"))).catch(() => {});
  await loaded;
  if (splash.isDestroyed()) return showMain();
  splash.showInactive(); // does not steal focus from whatever the user is doing

  const gap = Math.min(5000, Math.max(0, o.gapAfterMs ?? 0));
  if (gap > 0) {
    // Logo finishes fading out, splash closes, then a pause before the main window.
    await wait(ms + 60);
    if (!splash.isDestroyed()) splash.destroy();
    await wait(gap);
    return showMain();
  }
  // Default: main window appears as the logo fades out (last ~14%), then the splash closes.
  await wait(Math.round(ms * 0.86));
  void showMain();
  await wait(ms - Math.round(ms * 0.86) + 60);
  if (!splash.isDestroyed()) splash.destroy();
  await showMain();
}
