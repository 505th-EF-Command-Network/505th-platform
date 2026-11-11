import { randomBytes } from "node:crypto";
import { TerminalDoc, connectDb } from "@505th/db";
import { getHubActor, hubAudit, hubJson } from "@/lib/hub/auth";
import { EDIT_ROLES, MEDALS, PLATOONS, RANKS, memberName } from "@/lib/hub/members";
import { syncMember } from "@/lib/terminal/fs";

export const dynamic = "force-dynamic";
type U = Record<string, any>;
const LISTS: Record<string, string> = { promo: "promotionHistory", platoon: "platoonHistory", warn: "warningHistory", commend: "commendationHistory", ribbon: "ribbonHistory" };
const KIND: Record<string, string> = { promo: "PROMOTION", platoon: "TRANSFER", warn: "WARNING", commend: "MEDAL", ribbon: "RIBBON" };
const SEVERITY = new Set(["VERBAL", "WRITTEN", "FINAL"]);
const str = (v: unknown, max = 400) => String(v ?? "").trim().slice(0, max);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : new Date().toISOString().slice(0, 10));
const autoId = () => Array.from(randomBytes(20), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");

async function notify(uid: string, type: string, title: string, body: string) {
  const id = autoId(), now = new Date();
  await TerminalDoc.create({ _id: `notifications/${uid}/items/${id}`, parent: `notifications/${uid}/items`, docId: id, createTime: now, updateTime: now, data: { type, read: false, title, body, createdAt: now } }).catch(() => {});
}
/** Same Discord webhooks + embeds as the Terminal (settings/webhooks → promote / platoon / warning). */
async function webhook(key: "promote" | "platoon" | "warning", title: string, color: number, lines: [string, string][], who: string) {
  const s = await TerminalDoc.findById("settings/webhooks", { data: 1 }).lean();
  const url = ((s?.data ?? {}) as U)[key];
  if (typeof url !== "string" || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return;
  const LOGO = "https://i.ibb.co/d0Gn5M5R/505-TH-Logo.png";
  await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ username: "505th Command Network", allowed_mentions: { parse: [] }, embeds: [{
      author: { name: "505th Expeditionary Force", icon_url: LOGO }, thumbnail: { url: LOGO }, title, color, timestamp: new Date().toISOString(),
      footer: { text: "505th Expeditionary Force • Personnel" },
      description: `**${who}**\n\n${lines.map(([k, v]) => `• **${k}:** ${v || "—"}`).join("\n")}`,
    }] }),
  }).catch(() => {});
}

/**
 * POST /api/hub/members/{uid}/action — personnel file edits from the app. Same rules as the Terminal (member-actions.js):
 * Staff NCO+ only · only the Commander can change the Commander · retired files are frozen · reason where the Terminal asks
 * · history entries · E2 sets BCT date · transfer resets platoon date · webhooks · member alerts · Audit Log.
 * Discord roles follow through Cortana's role sync (it watches the database).
 */
export async function POST(req: Request, ctx: { params: Promise<{ uid: string }> }) {
  const a = await getHubActor(req);
  if (!a) return hubJson({ error: "unauthenticated" }, 401);
  const { uid } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) return hubJson({ error: "Invalid member." }, 400);
  if (!EDIT_ROLES.has(a.role)) return hubJson({ error: "You do not have authority to edit personnel files." }, 403);
  await connectDb();
  const doc = await TerminalDoc.findById(`users/${uid}`, { data: 1 }).lean();
  if (!doc) return hubJson({ error: "Member not found." }, 404);
  const u = (doc.data ?? {}) as U;
  if (u.role === "commander" && a.role !== "commander") return hubJson({ error: "Only the Commander can change the Commander's file." }, 403);
  if (u.role === "retired_veteran") return hubJson({ error: "This file is retired and frozen." }, 403);

  const b = ((await req.json().catch(() => null)) ?? {}) as U;
  const by = a.displayName, name = memberName(u), now = new Date(), nowISO = now.toISOString();
  const who = { uid: a.uid, name: a.displayName, role: a.role };
  const set: U = { "data.updatedAt": nowISO, updateTime: now };
  let after: (() => Promise<void>) | null = null;

  switch (b.action) {
    case "promote": {
      const to = str(b.rank, 60);
      if (!RANKS.includes(to)) return hubJson({ error: "Pick a valid rank." }, 400);
      if (to === u.rank) return hubJson({ error: "That is already their rank." }, 400);
      const date = day(b.date), note = str(b.note, 200);
      const entry = { date, fromRank: u.rank || "—", toRank: to, note: note || "Rank changed", addedBy: by, addedAt: nowISO, auto: false, source: "hub" };
      set["data.rank"] = to;
      set["data.promotionHistory"] = [...(u.promotionHistory || []), entry];
      if (to.startsWith("E2") && !u.graduation) set["data.graduation"] = date;
      if (b.resetPt === true) set["data.promotionTracker"] = 0;
      after = async () => {
        if (b.notify !== false) { await webhook("promote", "⭐ Promotion Record Updated", 0xa78bfa, [["From Rank", entry.fromRank], ["To Rank", to], ["Note", entry.note], ["By", by]], name); await notify(uid, "promotion", "Your rank has changed", "New rank: " + to); }
        await hubAudit(who, "RANK CHANGED", `${name}: ${entry.fromRank} → ${to}${note ? ` (${note})` : ""} — via app`);
      };
      break;
    }
    case "transfer": {
      const to = str(b.platoon, 40);
      if (!PLATOONS.includes(to)) return hubJson({ error: "Pick a valid platoon." }, 400);
      if (to === u.platoon) return hubJson({ error: "They are already in that platoon." }, 400);
      const date = day(b.date), note = str(b.note, 200);
      const entry = { date, from: u.platoon || "—", to, note: note || "Transferred", addedBy: by, addedAt: nowISO, auto: false, source: "hub" };
      Object.assign(set, { "data.platoon": to, "data.joinedPlatoon": date, "data.squad": str(b.squad, 40), "data.platoonHistory": [...(u.platoonHistory || []), entry] });
      after = async () => {
        if (b.notify !== false) { await webhook("platoon", "🔄 Platoon Transfer", 0x00d9ff, [["From", entry.from], ["To", to], ["Note", entry.note], ["By", by]], name); await notify(uid, "transfer", "You have been transferred to a new platoon", `${entry.from} → ${to}`); }
        await hubAudit(who, "TRANSFER", `${name}: ${entry.from} → ${to}${note ? ` (${note})` : ""} — via app`);
      };
      break;
    }
    case "warn": {
      const sev = str(b.severity, 10).toUpperCase(), reason = str(b.reason, 400);
      if (!SEVERITY.has(sev)) return hubJson({ error: "Pick Verbal, Written or Final." }, 400);
      if (reason.length < 3) return hubJson({ error: "A reason is required." }, 400);
      const entry: U = { date: day(b.date), severity: sev, note: reason, addedBy: by, addedAt: nowISO, source: "hub" };
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.expires ?? ""))) entry.expires = b.expires;
      const n = (u.warningHistory || []).length + 1;
      set["data.warningHistory"] = [...(u.warningHistory || []), entry];
      after = async () => {
        if (b.notify !== false) { await webhook("warning", "⚠️ Warning Issued", 0xff6b35, [["Severity", sev], ["Reason", reason], ["Issued by", by]], name); await notify(uid, "warning", `You have received a ${sev.toLowerCase()} warning`, reason); }
        await hubAudit(who, "WARNING FILED", `${name}: ${sev} warning #${n} — ${reason} — via app`);
      };
      break;
    }
    case "medal": {
      const img = str(b.medalImg, 60), title = str(b.title, 80), note = str(b.note, 400);
      if (!MEDALS.some(([f]) => f === img)) return hubJson({ error: "Pick a medal." }, 400);
      if (!title) return hubJson({ error: "A title is required." }, 400);
      set["data.commendationHistory"] = [...(u.commendationHistory || []), { date: day(b.date), title, note, medalImg: img, addedBy: by, addedAt: nowISO, source: "hub" }];
      after = async () => { await notify(uid, "commendation", "You have been awarded: " + title, note); await hubAudit(who, "MEDAL AWARDED", `${name}: ${title}${note ? " — " + note : ""} — via app`); };
      break;
    }
    case "stats": {
      const reason = str(b.reason, 200);
      if (reason.length < 3) return hubJson({ error: "A reason is required." }, 400);
      const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
      const att = Math.min(3, n(b.attendance)), pt = n(b.promotionTracker), oa = n(b.opsAttended), oe = Math.max(oa, n(b.opsEligible));
      Object.assign(set, { "data.attendance": att, "data.promotionTracker": pt, "data.opsAttended": oa, "data.opsEligible": oe });
      after = () => hubAudit(who, "ROSTER STATS EDITED", `${name}: att ${u.attendance || 0}→${att}/3, PT ${u.promotionTracker || 0}→${pt}, ops ${u.opsAttended || 0}/${u.opsEligible || 0}→${oa}/${oe} — ${reason} — via app`);
      break;
    }
    case "edit-entry":
    case "delete-entry": {
      const list = LISTS[String(b.kind)], i = Number(b.index);
      const reason = str(b.reason, 200);
      if (!list || !Number.isInteger(i)) return hubJson({ error: "Invalid entry." }, 400);
      if (reason.length < 3) return hubJson({ error: "A reason is required." }, 400);
      const arr = [...((u[list] as U[]) || [])];
      const e = arr[i];
      // The app sends the entry it saw: if someone changed the record meanwhile, stop.
      if (!e || JSON.stringify(e) !== JSON.stringify(b.expect)) return hubJson({ error: "Someone else changed this record. Close it and open it again." }, 409);
      const label = KIND[String(b.kind)];
      if (b.action === "delete-entry") {
        arr.splice(i, 1);
        after = () => hubAudit(who, "SERVICE RECORD ENTRY DELETED", `${name}: ${label} (${e.date || "—"}) — reason: ${reason} — via app`);
      } else {
        const ch = (b.changes ?? {}) as U, done: string[] = [], next: U = { ...e };
        for (const k of ["date", "fromRank", "toRank", "from", "to", "severity", "note", "title", "expires"]) {
          if (!(k in ch)) continue;
          const v = k === "date" || k === "expires" ? (String(ch[k] || "") === "" ? "" : day(ch[k])) : str(ch[k]);
          if (String(e[k] ?? "") !== v) { done.push(`${k}: ${e[k] ?? "—"} → ${v || "—"}`); next[k] = v; }
        }
        if (!done.length) return hubJson({ error: "Nothing changed." }, 400);
        Object.assign(next, { editedBy: by, editedAt: nowISO });
        arr[i] = next;
        after = () => hubAudit(who, "SERVICE RECORD EDITED", `${name}: ${label} (${e.date || "—"}) — ${done.join("; ")} — reason: ${reason} — via app`);
      }
      set[`data.${list}`] = arr;
      break;
    }
    default:
      return hubJson({ error: "Unknown action." }, 400);
  }

  await TerminalDoc.updateOne({ _id: `users/${uid}` }, { $set: set });
  await syncMember(uid, false).catch(() => {}); // keep the members copy (sign-in, Cortana) in step
  await after?.();
  return hubJson({ ok: true });
}
