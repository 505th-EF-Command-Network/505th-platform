import { NextResponse } from "next/server";
import { HubSession, Member } from "@505th/db";
import { FsError, getActor } from "@/lib/terminal/fs";
import { staffUsage } from "@/lib/hub/staff-usage";

export const dynamic = "force-dynamic";
const json = (b: unknown, s = 200) => NextResponse.json(b, { status: s, headers: { "Cache-Control": "private, no-store" } });

/** Staff Online v2: time on the Hub + Terminal this week, days on, 7-day bars, last seen (from Cortana's staff_usage log). Terminal staff only. */
export async function GET() {
  try { await getActor(); } catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : c === "internal" ? 503 : 403); }
  const live = await HubSession.find({ revokedAt: { $exists: false }, lastUsedAt: { $gt: new Date(Date.now() - 3 * 60_000) } }, { member: 1 }).lean();
  const mem = live.length ? await Member.find({ _id: { $in: live.map((s) => s.member) } }, { legacyId: 1 }).lean() : [];
  return json({ usage: await staffUsage(), hub: mem.map((m) => String(m.legacyId || m._id)) });
}
