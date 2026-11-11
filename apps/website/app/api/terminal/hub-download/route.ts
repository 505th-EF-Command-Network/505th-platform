import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { TerminalDoc } from "@505th/db";
import { FsError, getActor } from "@/lib/terminal/fs";
import { hubAllowed } from "@/lib/hub/access-list";
import { downloadUrl, latestRelease } from "@/lib/hub/release";

export const dynamic = "force-dynamic";
/**
 * GET /api/terminal/hub-download → the Hub installer, only for people on Hub Access (Commander / Developer always).
 * Redirects to a short-lived signed GitHub link — the repo and token stay hidden. Every download goes in the Audit Log.
 */
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  let a;
  try { a = await getActor(); } catch (e) { const c = e instanceof FsError ? e.code : "internal"; return json({ error: c }, c === "unauthenticated" ? 401 : 403); }
  if (!(await hubAllowed(a.uid, a.role))) return json({ error: "You don't have Hub access. Ask the Commander from the Terminal dashboard." }, 403);
  const rel = await latestRelease();
  if (!rel) return json({ error: "No release yet." }, 404);
  const url = await downloadUrl(rel);
  if (!url) return json({ error: "Download link unavailable — try again in a minute." }, 502);
  const id = Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join(""), now = new Date();
  await TerminalDoc.create({ _id: `audit_logs/${id}`, parent: "audit_logs", docId: id, createTime: now, updateTime: now,
    data: { section: "security", action: "HUB DOWNLOADED", details: `v${rel.version} (${rel.file})`, uid: a.uid, by: a.displayName, role: a.role, source: "terminal", createdAt: now, createdAtISO: now.toISOString() } }).catch(() => {});
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
