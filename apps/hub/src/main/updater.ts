import { app, type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * R3 UPDATER (release v0.1). Checks the website for a newer Hub in the background — at start-up, then every 4 hours.
 * New version → tells the window (banner + pop-up). "Update now" → download the installer through the website's short-lived link,
 * check its SHA-256, run it silently (/S) and restart into the new version (--force-run). Nothing runs that fails the check.
 * Development (npm run hub): checks and shows the banner, but never installs.
 */
export type UpdateInfo = { available: boolean; latest: string; notes?: string[]; sizeMB?: number; sha256?: string; dateISO?: string; file?: string; url?: string | null };
export type UpdateState =
  | { state: "idle" | "checking"; checkedAt: string | null; latest: string | null }
  | { state: "available"; info: UpdateInfo; checkedAt: string }
  | { state: "downloading"; info: UpdateInfo; percent: number }
  | { state: "installing"; info: UpdateInfo }
  | { state: "error"; message: string; info?: UpdateInfo };
type Hooks = { api: (path: string) => Promise<Response>; send: (ch: string, v: unknown) => void; getWin: () => BrowserWindow | null; signedIn: () => boolean; onQuit: () => void };
const EVERY = 4 * 60 * 60_000;

export function createUpdater(h: Hooks) {
  let st: UpdateState = { state: "idle", checkedAt: null, latest: null };
  let timer: NodeJS.Timeout | undefined;
  const set = (s: UpdateState) => { st = s; h.send("update:state", s); };

  async function check(manual = false): Promise<UpdateState> {
    if (!h.signedIn() || st.state === "downloading" || st.state === "installing") return st;
    const before = st;
    set({ state: "checking", checkedAt: null, latest: null });
    try {
      const r = await h.api(`/api/hub/update?v=${encodeURIComponent(app.getVersion())}`);
      const b = (await r.json().catch(() => ({}))) as UpdateInfo & { error?: string };
      if (!r.ok) throw new Error(b.error ?? `Website error ${r.status}`);
      const now = new Date().toISOString();
      if (b.available) {
        const fresh = before.state !== "available" || before.info.latest !== b.latest;
        set({ state: "available", info: b, checkedAt: now });
        if (fresh) h.send("update:new", b);
      } else set({ state: "idle", checkedAt: now, latest: b.latest });
    } catch (e) {
      set(manual ? { state: "error", message: (e as Error).message } : before.state === "checking" ? { state: "idle", checkedAt: null, latest: null } : before);
    }
    return st;
  }

  async function install() {
    if (st.state !== "available" && !(st.state === "error" && st.info)) return st;
    const info = st.state === "available" ? st.info : (st as { info: UpdateInfo }).info;
    if (!app.isPackaged) { set({ state: "error", message: "Updates install only in the installed app (not npm run hub).", info }); return st; }
    try {
      set({ state: "downloading", info, percent: 0 });
      const r = await h.api(`/api/hub/update?v=${encodeURIComponent(app.getVersion())}&download=1`);
      const b = (await r.json().catch(() => ({}))) as UpdateInfo;
      if (!r.ok || !b.url) throw new Error("Couldn't get the download link — try again.");
      const dl = await fetch(b.url, { signal: AbortSignal.timeout(15 * 60_000) });
      if (!dl.ok || !dl.body) throw new Error(`Download failed (${dl.status}).`);
      const total = Number(dl.headers.get("content-length")) || 0;
      const dir = join(app.getPath("temp"), "505th-update");
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      const file = join(dir, (b.file || "505th-Command-Network-Setup.exe").replace(/[^\w.-]/g, "_"));
      let got = 0, last = 0;
      const src = Readable.fromWeb(dl.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>);
      src.on("data", (c: Buffer) => { got += c.length; const p = total ? Math.floor((got / total) * 100) : 0; if (p !== last) { last = p; set({ state: "downloading", info, percent: p }); } });
      await pipeline(src, createWriteStream(file));
      // Only run what GitHub says it is.
      if (b.sha256) {
        const sum = createHash("sha256").update(await readFile(file)).digest("hex");
        if (sum.toLowerCase() !== b.sha256.toLowerCase()) { await rm(dir, { recursive: true, force: true }); throw new Error("The download didn't pass the safety check — not installed."); }
      }
      set({ state: "installing", info });
      spawn(file, ["/S", "--force-run"], { detached: true, stdio: "ignore", windowsHide: false }).unref();
      setTimeout(() => h.onQuit(), 800);
    } catch (e) {
      set({ state: "error", message: (e as Error).message, info });
    }
    return st;
  }

  function start() {
    clearInterval(timer);
    setTimeout(() => void check(), 20_000); // after the app settles
    timer = setInterval(() => void check(), EVERY);
  }
  return { start, check, install, getState: () => st };
}
