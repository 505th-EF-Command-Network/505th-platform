import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const KEY = /^[^.$]{1,200}$/;

/** GET /api/hub/oob → settings/unit_cards (same data as the Terminal's Order of Battle) + members for the picker. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "oob")) return hubJson({ error: "You don't have Order of Battle access." }, 403);
  const [doc, us] = await Promise.all([TerminalDoc.findById("settings/unit_cards", { data: 1 }).lean(), TerminalDoc.find({ parent: "users" }, { docId: 1, "data.firstName": 1, "data.middleName": 1, "data.lastName": 1, "data.callsign": 1, "data.name": 1, "data.displayName": 1, "data.rank": 1, "data.status": 1 }).lean()]);
  const members = us.map((d) => ({ id: d.docId, ...(((d as U).data ?? {}) as U) }) as U).filter((u) => u.status !== "pending" && u.status !== "denied")
    .map((u) => { const n = memberName(u); const abbr = String(u.rank || "").split("/").pop()?.trim() ?? ""; return { id: u.id, name: n, rank: abbr && n.startsWith(abbr + " ") ? abbr : "", short: abbr && n.startsWith(abbr + " ") ? n.slice(abbr.length + 1) : n }; })
    .sort((x, y) => x.name.localeCompare(y.name));
  return hubJson({ data: (doc?.data ?? {}) as U, members });
}

/**
 * POST /api/hub/oob { changes: { key: slot | boolean | null } } → merges only the changed keys into settings/unit_cards,
 * so two people editing different units never overwrite each other. Same key format + Audit Log lines as the Terminal.
 * Slot = { status: open|filled|closed, name, userId }; "__SECTION_HIDDEN__…" keys are true/false.
 */
export async function POST(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "oob")) return hubJson({ error: "You don't have Order of Battle access." }, 403);
  await connectDb();
  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const ch = (b.changes && typeof b.changes === "object" ? b.changes : {}) as U;
  const keys = Object.keys(ch).slice(0, 500);
  if (!keys.length) return hubJson({ error: "Nothing to save." }, 400);
  const old = ((await TerminalDoc.findById("settings/unit_cards", { data: 1 }).lean())?.data ?? {}) as U;
  const set: U = {}, unset: U = {}, lines: string[] = [];
  for (const k of keys) {
    if (!KEY.test(k)) return hubJson({ error: "Bad slot key." }, 400);
    const v = ch[k];
    if (k.startsWith("__SECTION_HIDDEN__")) {
      set[`data.${k}`] = v === true;
      lines.push(`${k.replace("__SECTION_HIDDEN__", "")}: ${v === true ? "hidden" : "visible"}`);
      continue;
    }
    if (v == null) { unset[`data.${k}`] = ""; continue; }
    const st = ["open", "filled", "closed"].includes(v.status) ? v.status : "open";
    const slot = { status: st, name: st === "filled" ? String(v.name ?? "").slice(0, 80) : "", userId: st === "filled" ? String(v.userId ?? "").slice(0, 64) : "" };
    set[`data.${k}`] = slot;
    const od = old[k] as U | undefined, [page, ...rest] = k.split("__");
    lines.push(slot.status !== od?.status ? `${page}/${rest.join("/")}: status ${od?.status || "?"} → ${slot.status}` : `${page}/${rest.join("/")}: ${od?.name || "empty"} → ${slot.name || "empty"}`);
  }
  const now = new Date();
  await TerminalDoc.updateOne({ _id: "settings/unit_cards" }, { $set: { ...set, parent: "settings", docId: "unit_cards", updateTime: now }, ...(Object.keys(unset).length ? { $unset: unset } : {}), $setOnInsert: { createTime: now } }, { upsert: true });
  await hubAudit({ uid: a.uid, name: a.displayName, role: a.role }, "ORDER OF BATTLE SAVED", lines.slice(0, 20).join("; ") + (lines.length > 20 ? ` (+${lines.length - 20} more)` : "") + " — via app");
  return hubJson({ ok: true, msg: `Order of Battle saved — public page updated (${keys.length} change${keys.length === 1 ? "" : "s"})` });
}
