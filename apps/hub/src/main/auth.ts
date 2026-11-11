import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { app, safeStorage, shell } from "electron";

/*
 * Command Network app sign-in (same design as the RCD Hub).
 *  1. login(): make a PKCE verifier + state, open the website's /hub/connect page in the normal browser.
 *  2. The website sends back cn505://auth?code=…&state=… (Windows passes it to this app).
 *  3. handleDeepLink(): check the state, swap code + verifier for a token at /api/hub/token.
 *  4. The token is encrypted with Windows (DPAPI, safeStorage) and saved in the app's data folder.
 * The token stays in this main process. The window never sees it.
 */

export const SITE_ORIGIN = "https://www.505expeditionaryforce.com";
export const PROTOCOL = "cn505";
const TOKEN_RE = /^cn5h_[A-Za-z0-9_-]{43}$/;
const PENDING_TTL_MS = 10 * 60 * 1000;

export type AppUser = { uid: string; name: string; role: string; deviceName: string; discordUsername: string; platoon: string; access: Record<string, boolean> };
export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "waiting" }
  | { status: "signed-in"; user: AppUser }
  | { status: "offline"; error: string };

/** Development only: point the app at your local website with CN_SITE=http://localhost:3000 */
export function siteOrigin(): string {
  const o = process.env["CN_SITE"];
  if (!app.isPackaged && o && /^http:\/\/localhost:\d+$/.test(o)) return o;
  return SITE_ORIGIN;
}
const deviceName = () => hostname().replace(/[^\w .-]/g, "").trim().slice(0, 64) || "Windows PC";
const b64url = (b: Buffer) => b.toString("base64url");

export function createAuth(onChange: (s: AuthState) => void) {
  const tokenFile = join(app.getPath("userData"), "cn-session.bin");
  let state: AuthState = { status: "loading" };
  let token: string | null = null;
  let pending: { verifier: string; state: string; at: number } | null = null;
  const set = (s: AuthState) => { state = s; onChange(s); };

  function saveToken(v: string | null) {
    token = v;
    try {
      if (!v) { if (existsSync(tokenFile)) rmSync(tokenFile); }
      else if (safeStorage.isEncryptionAvailable()) writeFileSync(tokenFile, safeStorage.encryptString(v), { mode: 0o600 });
      // No encryption available → kept in memory only (sign in again next start).
    } catch { /* disk error — the in-memory token still works */ }
  }
  function loadToken(): string | null {
    try {
      if (!existsSync(tokenFile) || !safeStorage.isEncryptionAvailable()) return null;
      const v = safeStorage.decryptString(readFileSync(tokenFile));
      return TOKEN_RE.test(v) ? v : null;
    } catch { return null; }
  }

  /** Calls the website API with the app token. 401 = signed out (revoked / lost access). */
  async function api(path: string, init: RequestInit = {}): Promise<Response> {
    if (!token) throw new Error("Not signed in");
    const res = await fetch(`${siteOrigin()}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      saveToken(null);
      set({ status: "signed-out", error: "Your app sign-in has ended. Please sign in again." });
    }
    return res;
  }

  async function refresh(): Promise<void> {
    if (!token) return set({ status: "signed-out" });
    try {
      const res = await api("/api/hub/me");
      if (res.ok) set({ status: "signed-in", user: (await res.json()) as AppUser });
      else if (res.status !== 401) set({ status: "offline", error: `The website replied with an error (${res.status}).` });
    } catch {
      set({ status: "offline", error: "Can't reach 505expeditionaryforce.com. Check your internet connection." });
    }
  }

  function login(): void {
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    pending = { verifier, state: b64url(randomBytes(24)), at: Date.now() };
    const q = new URLSearchParams({ challenge, state: pending.state, device: deviceName() });
    void shell.openExternal(`${siteOrigin()}/hub/connect?${q.toString()}`);
    set({ status: "waiting" });
  }
  function cancel(): void { pending = null; set({ status: "signed-out" }); }

  /** Handles cn505://auth?code=…&state=… from Windows. Anything unexpected is ignored. */
  async function handleDeepLink(link: string): Promise<void> {
    let url: URL;
    try { url = new URL(link); } catch { return; }
    if (url.protocol !== `${PROTOCOL}:` || url.hostname !== "auth") return;
    const code = url.searchParams.get("code") ?? "", st = url.searchParams.get("state") ?? "";
    // Not started from this app (or too old) → refuse. Stops someone sending you a link.
    if (!pending || Date.now() - pending.at > PENDING_TTL_MS || st !== pending.state) {
      if (state.status === "waiting") set({ status: "signed-out", error: "That sign-in link didn't match. Please try again." });
      return;
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return;
    const { verifier } = pending;
    pending = null;
    try {
      const res = await fetch(`${siteOrigin()}/api/hub/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ code, verifier }),
        signal: AbortSignal.timeout(15_000),
      });
      const b = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || typeof b.token !== "string" || !TOKEN_RE.test(b.token)) return set({ status: "signed-out", error: b.error ?? "Sign-in failed. Please try again." });
      saveToken(b.token);
      await refresh();
    } catch {
      set({ status: "signed-out", error: "Can't reach 505expeditionaryforce.com. Check your internet connection." });
    }
  }

  async function logout(): Promise<void> {
    if (token) await fetch(`${siteOrigin()}/api/hub/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }).catch(() => {});
    saveToken(null);
    set({ status: "signed-out" });
  }

  function start(): void {
    token = loadToken();
    void refresh();
  }

  return { start, login, cancel, logout, refresh, handleDeepLink, api, getState: () => state, hasToken: () => !!token };
}
