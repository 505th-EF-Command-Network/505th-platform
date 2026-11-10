/**
 * Who may use a Cortana command.
 * Allowed if EITHER:
 *  - their linked website account has the access item (same grid as the Command Terminal), OR
 *  - they have the Cortana Cred role in Discord (CORTANA_CRED_ROLE_ID).
 * Suspended / left members never pass the website check.
 */
import type { GuildMember } from "discord.js";
import { Member, TerminalDoc } from "@505th/db";
import { can, hasTerminal } from "../../website/lib/terminal/access.ts";
import { env } from "./env.ts";

export async function websiteAccess(discordId: string): Promise<{ role: string; access: unknown } | null> {
  const m = await Member.findOne({ discordId }, { legacyId: 1, status: 1, role: 1 }).lean();
  if (!m || ["SUSPENDED", "LEFT_UNIT"].includes(String(m.status))) return null;
  const uid = m.legacyId || String(m._id);
  const d = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
  if (d?.suspended === true) return null;
  return { role: String(d?.role ?? m.role ?? ""), access: d?.access ?? {} };
}

/** key = access item ("send", "modk", …) or null for "any staff with terminal access". */
export async function allowed(member: GuildMember | null, key: string | null): Promise<boolean> {
  if (!member) return false;
  if (env.CORTANA_CRED_ROLE_ID && member.roles.cache.has(env.CORTANA_CRED_ROLE_ID)) return true;
  const w = await websiteAccess(member.id);
  if (!w) return false;
  return key ? can(w.role, w.access, key) : hasTerminal(w.role);
}

/** For website jobs: does the website user who queued it (requestedBy, stamped by the server) have this access item? */
export async function uidAllowed(uid: unknown, key: string): Promise<{ ok: boolean; name: string }> {
  if (typeof uid !== "string" || !uid) return { ok: false, name: "" };
  const d = (await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean())?.data as Record<string, any> | undefined;
  if (!d || d.suspended === true) return { ok: false, name: "" };
  const name = String(d.callsign || d.name || d.displayName || "Staff");
  return { ok: can(String(d.role ?? ""), d.access ?? {}, key), name };
}
