import "server-only";

/**
 * Sessions: a random 32-byte token in an HttpOnly cookie. MongoDB stores only
 * its SHA-256 hash, so a database leak cannot be used to sign in.
 */
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  connectDb, Member, Session, clearanceOf, memberDisplayName, operatorId, rankByKey, ROLE_LABEL,
  SIGN_IN_STATUSES, TERMINAL_CLEARANCE, type MemberStatus, type Role,
} from "@505th/db";

const SECURE = process.env.NODE_ENV === "production";
/** __Host- prefix: Secure, Path=/, no Domain — the strongest cookie scoping browsers offer. */
export const SESSION_COOKIE = SECURE ? "__Host-505th_session" : "505th_session";
export const STATE_COOKIE = SECURE ? "__Host-505th_oauth" : "505th_oauth";
const SESSION_DAYS = 7;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export const cookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: SECURE,
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});

export async function createSession(data: {
  member?: import("mongoose").Types.ObjectId | string;
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  inGuild: boolean;
}): Promise<{ token: string; maxAge: number }> {
  await connectDb();
  const token = newToken();
  const maxAge = SESSION_DAYS * 24 * 3600;
  await Session.create({
    ...data,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + maxAge * 1000),
    lastSeenAt: new Date(),
  });
  return { token, maxAge };
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await connectDb();
  await Session.deleteOne({ tokenHash: sha256(token) });
}

export type AccessResult = "GRANTED" | "PENDING" | "DENIED";
export type AccessReason = "NONE" | "NOT_IN_DISCORD" | "NO_RECORD" | "PENDING_APPROVAL" | "LOW_CLEARANCE" | "INACTIVE";

export type Viewer = {
  discordId: string;
  discordUsername: string;
  avatar: string | null;
  inGuild: boolean;
  member: null | {
    id: string;
    displayName: string;
    operatorId: string;
    rankAbbrev: string;
    role: Role;
    roleLabel: string;
    status: MemberStatus;
    clearance: number;
  };
  /** Result of the Command Terminal clearance check. */
  terminal: { result: AccessResult; reason: AccessReason; checks: [boolean, boolean | null, boolean | null] };
};

/** Pure decision used by /boot and every Terminal page. */
export function decideAccess(inGuild: boolean, m: Viewer["member"]): Viewer["terminal"] {
  if (!inGuild) return { result: "DENIED", reason: "NOT_IN_DISCORD", checks: [false, null, null] };
  if (!m) return { result: "DENIED", reason: "NO_RECORD", checks: [true, false, null] };
  if (m.status === "PENDING") return { result: "PENDING", reason: "PENDING_APPROVAL", checks: [true, null, null] };
  if (!SIGN_IN_STATUSES.includes(m.status)) return { result: "DENIED", reason: "INACTIVE", checks: [true, false, null] };
  if (m.clearance < TERMINAL_CLEARANCE) return { result: "DENIED", reason: "LOW_CLEARANCE", checks: [true, true, false] };
  return { result: "GRANTED", reason: "NONE", checks: [true, true, true] };
}

/** The signed-in viewer for this request (cached per request), or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDb();
  const s = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } }).lean();
  if (!s) return null;
  // Re-read the member every request so rank/role/status changes apply at once.
  const m = s.member ? await Member.findById(s.member).lean() : await Member.findOne({ discordId: s.discordId }).lean();
  const member: Viewer["member"] = m
    ? {
        id: String(m._id),
        displayName: memberDisplayName(m),
        operatorId: operatorId(m),
        rankAbbrev: rankByKey(m.rankKey)?.abbrev ?? m.rankRaw ?? "",
        role: m.role as Role,
        roleLabel: ROLE_LABEL[m.role as Role] ?? m.role,
        status: m.status as MemberStatus,
        clearance: clearanceOf(m.role),
      }
    : null;
  return {
    discordId: s.discordId!,
    discordUsername: s.discordUsername ?? "",
    avatar: s.discordAvatar ?? null,
    inGuild: !!s.inGuild,
    member,
    terminal: decideAccess(!!s.inGuild, member),
  };
});
