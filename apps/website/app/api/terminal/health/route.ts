import { NextResponse } from "next/server";
import { TerminalDoc, connectDb } from "@505th/db";
import { can } from "@/lib/terminal/access";
import { FsError, getActor } from "@/lib/terminal/fs";

/**
 * GET /api/terminal/health — Network Status (access "net").
 * Checks the database (ping + size), reads Cortana's heartbeat, says if instant updates are set up,
 * and keeps an incident list (net_incidents): opened when something goes down / slow, closed when it recovers.
 * No secrets or connection details are returned.
 */
export const dynamic = "force-dynamic";
const STALE_MS = 45_000; // Cortana beats every 10 s
const SLOW_PING = 250;
let lastCheck = 0;

async function incident(key: string, bad: boolean, what: string, level: "down" | "slow") {
  const open = await TerminalDoc.findOne({ parent: "net_incidents", "data.key": key, "data.endedAtISO": null }, { _id: 1 }).lean();
  const now = new Date();
  if (bad && !open) {
    const id = `${key}-${now.getTime()}`;
    await TerminalDoc.create({ _id: `net_incidents/${id}`, parent: "net_incidents", docId: id, createTime: now, updateTime: now, data: { key, what, level, startedAtISO: now.toISOString(), endedAtISO: null } });
  } else if (!bad && open) {
    await TerminalDoc.updateOne({ _id: open._id }, { $set: { "data.endedAtISO": now.toISOString(), updateTime: now } });
  }
}

export async function GET() {
  let actor;
  try {
    actor = await getActor();
  } catch (e) {
    const code = e instanceof FsError ? e.code : "internal";
    return NextResponse.json({ error: code }, { status: code === "unauthenticated" ? 401 : 403 });
  }
  if (!can(actor.role, actor.access, "net")) return NextResponse.json({ error: "permission-denied" }, { status: 403 });

  const out: Record<string, unknown> = { at: new Date().toISOString() };
  let dbOk = false;
  try {
    const m = await connectDb();
    const t = Date.now();
    await m.connection.db!.admin().command({ ping: 1 });
    const ms = Date.now() - t;
    const st = await m.connection.db!.stats().catch(() => null);
    out.db = { ok: true, ms, dataMb: st ? Math.round((st.dataSize / 1048576) * 10) / 10 : null, storageMb: st ? Math.round(((st.storageSize + (st.indexSize ?? 0)) / 1048576) * 10) / 10 : null };
    dbOk = true;
  } catch {
    out.db = { ok: false };
  }
  out.ably = { configured: (process.env.ABLY_API_KEY || "").includes(":") };
  if (dbOk) {
    const bs = (await TerminalDoc.findById("bot_status/cortana", { data: 1 }).lean())?.data as Record<string, any> | undefined;
    const age = bs?.lastHeartbeatISO ? Date.now() - Date.parse(bs.lastHeartbeatISO) : Infinity;
    const online = bs?.online !== false && age < STALE_MS;
    out.cortana = { online, heartbeatAgeSec: Number.isFinite(age) ? Math.round(age / 1000) : null };
    // Incidents (at most every 15 s, whoever has the page open).
    if (Date.now() - lastCheck > 15_000) {
      lastCheck = Date.now();
      await incident("cortana-down", !online, "Cortana offline", "down").catch(() => {});
      await incident("discord-slow", online && (bs?.pingMs ?? 0) > SLOW_PING, `Discord ping over ${SLOW_PING} ms`, "slow").catch(() => {});
      await incident("db-slow", (out.db as any).ms > 500, "Database slow (over 500 ms)", "slow").catch(() => {});
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
