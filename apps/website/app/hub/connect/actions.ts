"use server";

import { HubAuthCode, Member, connectDb } from "@505th/db";
import { getViewer } from "@/lib/auth/session";
import { hubAudit, limited, randomToken, sha256Hex } from "@/lib/hub/auth";
import { parseConnect, type ConnectParams } from "./params";

export type AllowResult = { ok: true; url: string } | { ok: false; error: string };
const CODE_TTL_MS = 5 * 60 * 1000;

/**
 * "Allow" pressed: make a one-time code (5 minutes) and return the cn505:// link that hands it to the app.
 * Only the app holding the PKCE verifier can swap the code for a token.
 */
export async function allowHub(raw: ConnectParams): Promise<AllowResult> {
  const p = parseConnect(raw as unknown as Record<string, unknown>);
  if (!p) return { ok: false, error: "This sign-in link is invalid. Start again from the Command Network app." };
  const v = await getViewer();
  if (!v || v.terminal.result !== "GRANTED" || !v.member) return { ok: false, error: "You are not signed in, or you don't have Command Terminal access." };
  if (limited(`hub-allow:${v.discordId}`, 10, 15 * 60 * 1000)) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." };

  await connectDb();
  const code = randomToken();
  await HubAuthCode.create({
    codeHash: sha256Hex(code), challenge: p.challenge, member: v.member.id, discordId: v.discordId,
    deviceName: p.device, inGuild: v.inGuild, expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  const m = await Member.findById(v.member.id, { legacyId: 1 }).lean();
  await hubAudit({ uid: m?.legacyId || v.member.id, name: v.member.displayName, role: v.member.role }, "APP SIGN-IN ALLOWED", `Command Network app on "${p.device}"`);
  return { ok: true, url: `cn505://auth?${new URLSearchParams({ code, state: p.state }).toString()}` };
}
