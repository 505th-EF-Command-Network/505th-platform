import { TerminalDoc } from "@505th/db";
import { getHubActor, hubJson } from "@/lib/hub/auth";
import { can } from "@/lib/terminal/access";
import { memberName } from "@/lib/hub/members";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
/** Same lists as the Terminal's recruitment-stats.js. Read-only. */
const SOURCES = ["Reddit", "Steam Community", "Disboard", "Discord", "Word of Mouth", "Other"];
const iso = (v: unknown) => { if (!v) return ""; const d = v instanceof Date ? v : new Date(typeof v === "object" && v && "seconds" in (v as U) ? (v as U).seconds * 1000 : String(v)); return isNaN(+d) ? "" : d.toISOString(); };

/** GET /api/hub/recruit → members with source, joined date and BCT instructor. */
export async function GET(req: Request) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  if (!can(a.role, a.access, "rstat")) return hubJson({ error: "You don't have Recruitment Stats access." }, 403);
  const users = (await TerminalDoc.find({ parent: "users" }, { docId: 1, data: 1 }).lean()).map((d) => ({ id: d.docId, ...((d.data ?? {}) as U) }) as U)
    .filter((u) => u.status !== "pending" && u.status !== "denied");
  const instr = (v: unknown) => { if (!v) return ""; const i = users.find((x) => x.id === v || x.callsign === v); return i ? memberName(i) : String(v); };
  const members = users.map((u) => ({ id: u.id, name: memberName(u), source: SOURCES.includes(u.recruitSource) ? u.recruitSource : u.recruitSource ? "Other" : "",
    joined: iso(u.approvedAt) || iso(u.joinedAt) || iso(u.graduation) || iso(u.createdAt), instructor: instr(u.bctInstructor) }));
  return hubJson({ sources: SOURCES, members });
}
