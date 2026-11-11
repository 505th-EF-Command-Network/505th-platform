import "server-only";

/**
 * 505th Command Network app (Hub) authentication — same design as the RCD Hub.
 * The app sends "Authorization: Bearer cn5h_…" on every /api/hub/* call.
 * Only the SHA-256 of that token is stored (hub_sessions). The member is re-read on every call,
 * so rank / role / status changes and Terminal clearance apply at once; losing clearance = signed out.
 */
import { hubAllowed } from "@/lib/hub/access-list";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { HubSession, Member, TerminalDoc, clearanceOf, connectDb, memberDisplayName, type MemberStatus, type Role } from "@505th/db";
import { decideAccess } from "@/lib/auth/session";
import { withGrants, type CmdGrant } from "@/lib/terminal/access";
import { loadRoleDefaults } from "@/lib/terminal/role-defaults";

export const TOKEN_PREFIX = "cn5h_";
const TOKEN_RE = /^Bearer (cn5h_[A-Za-z0-9_-]{43})$/;
/** Signed out after 30 days without use. */
export const IDLE_MS = 30 * 24 * 60 * 60 * 1000;
/** How often lastUsedAt is refreshed — also drives "on the Hub" in Staff on Duty, so keep it short. */
const TOUCH_EVERY_MS = 60 * 1000;

export const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const idleExpiry = (from = new Date()) => new Date(from.getTime() + IDLE_MS);

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge (constant-time). */
export function pkceMatches(verifier: string, challenge: string): boolean {
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** PC name the app sends — same characters only. */
export const cleanDevice = (v: unknown) => String(v ?? "").replace(/[^\w .-]/g, "").trim().slice(0, 64) || "Windows PC";

export type HubActor = {
  sessionId: string;
  deviceName: string;
  /** Terminal uid (users/{uid}) — same as the website's getActor(). */
  uid: string;
  memberId: string;
  discordId: string;
  displayName: string;
  role: Role;
  access: Record<string, unknown>;
};

/**
 * Who is calling this /api/hub route? null unless the token is valid, not revoked or expired,
 * and the member still has Command Terminal clearance. A valid call renews the 30-day idle expiry.
 */
export async function getHubActor(req: Request): Promise<HubActor | null> {
  await connection();
  const m0 = TOKEN_RE.exec(req.headers.get("authorization") ?? "");
  if (!m0) return null;
  await connectDb();
  const now = new Date();
  const s = await HubSession.findOne({ tokenHash: sha256Hex(m0[1]!), revokedAt: { $exists: false }, expiresAt: { $gt: now } }).lean();
  if (!s?.member) return null;
  const m = await Member.findById(s.member).lean();
  if (!m) return null;
  const access = decideAccess(!!s.inGuild, {
    id: String(m._id), displayName: memberDisplayName(m), operatorId: "", rankAbbrev: "",
    role: m.role as Role, roleLabel: "", status: m.status as MemberStatus, clearance: clearanceOf(m.role),
  });
  if (access.result !== "GRANTED") return null;
  const appVersion = (req.headers.get("x-cn-app") ?? "").replace(/[^\w.-]/g, "").slice(0, 20);
  const os = (req.headers.get("x-cn-os") ?? "").replace(/[^\w .()-]/g, "").slice(0, 40);
  const sx = s as { appVersion?: string; os?: string };
  if (!s.lastUsedAt || now.getTime() - new Date(s.lastUsedAt).getTime() > TOUCH_EVERY_MS || (appVersion && appVersion !== sx.appVersion) || (os && os !== sx.os)) {
    await HubSession.updateOne({ _id: s._id }, { $set: { lastUsedAt: now, expiresAt: idleExpiry(now), ...(appVersion ? { appVersion } : {}), ...(os ? { os } : {}) } });
  }
  await loadRoleDefaults();
  const uid = m.legacyId || String(m._id);
  // Hub Access (release v0.1): only people the Commander gave access to (Commander / Developer always). Revoked = refused at once.
  if (!(await hubAllowed(uid, String(m.role ?? "")))) return null;
  const td = await TerminalDoc.findById(`users/${uid}`, { "data.access": 1, "data.cmdGrant": 1 }).lean();
  const d = td?.data as { access?: unknown; cmdGrant?: CmdGrant } | undefined;
  return {
    sessionId: String(s._id),
    deviceName: s.deviceName ?? "Windows PC",
    uid,
    memberId: String(m._id),
    discordId: s.discordId ?? "",
    displayName: memberDisplayName(m),
    role: m.role as Role,
    access: withGrants(d?.access, d?.cmdGrant),
  };
}

/** Best-effort caller IP for rate limiting (Vercel sets x-forwarded-for). */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

/** JSON that is never cached. */
export const hubJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Tiny in-memory rate limiter (per server instance). */
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return true;
  list.push(now);
  hits.set(key, list);
  return false;
}

/** Write to the Terminal Audit Log (same format as the website's server routes). */
export async function hubAudit(who: { uid: string; name: string; role: string }, action: string, details: string) {
  const now = new Date();
  const id = Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
  await TerminalDoc.create({
    _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "security", action, details, uid: who.uid, by: who.name, role: who.role, source: "hub", createdAt: now, createdAtISO: now.toISOString() },
  }).catch(() => {});
}
