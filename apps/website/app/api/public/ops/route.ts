import { NextResponse } from "next/server";
import { TerminalDoc, connectDb } from "@505th/db";

/**
 * PUBLIC — homepage "LIVE NOW / NEXT OPERATIONS" banner.
 * Only public details: title, type, times. No sign-up numbers, names or IDs.
 * Cached 30 s.
 */
export const dynamic = "force-dynamic";
const TYPE: Record<string, string> = { main_op: "MAIN OP", patrol: "PATROL", training: "TRAINING", fun_op: "FUN OP" };

type Ev = {
  title?: string; startAtISO?: string; endAtISO?: string; status?: string; attendanceEventId?: string | null;
};
let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 30_000) return json(cache.body);
  await connectDb();
  const now = Date.now();
  const soon = new Date(now + 14 * 864e5).toISOString();
  const docs = await TerminalDoc.find(
    { parent: "community_events", "data.status": { $ne: "cancelled" }, "data.endAtISO": { $gt: new Date(now).toISOString() }, "data.startAtISO": { $lt: soon } },
    { "data.title": 1, "data.startAtISO": 1, "data.endAtISO": 1, "data.status": 1, "data.attendanceEventId": 1, "data.opType": 1 },
  ).lean();
  const evs = docs.map((d) => (d as any).data as Ev).filter((e) => e.title && e.startAtISO && e.endAtISO);
  const typeIds = [...new Set(evs.map((e) => e.attendanceEventId).filter(Boolean))] as string[];
  const types = new Map(
    (await TerminalDoc.find({ _id: { $in: typeIds.map((id) => `attendance_events/${id}`) } }, { docId: 1, "data.type": 1 }).lean()).map((d) => [String(d.docId), (d as any).data?.type]),
  );
  const out = evs
    .map((e) => {
      const t = (e as any).opType || (e.attendanceEventId ? types.get(e.attendanceEventId) : null);
      return { title: String(e.title).slice(0, 100), type: TYPE[t as string] ?? "OPERATION", typeKey: (t as string) ?? "other", startAtISO: e.startAtISO!, endAtISO: e.endAtISO! };
    })
    .sort((a, b) => a.startAtISO.localeCompare(b.startAtISO));
  const live = out.find((e) => Date.parse(e.startAtISO) <= now && Date.parse(e.endAtISO) > now) ?? null;
  const next = out.filter((e) => Date.parse(e.startAtISO) > now).slice(0, 3);
  const body = { live, next, at: new Date(now).toISOString() };
  cache = { at: now, body };
  return json(body);
}
const json = (b: unknown) => NextResponse.json(b, { headers: { "Cache-Control": "public, max-age=30" } });
