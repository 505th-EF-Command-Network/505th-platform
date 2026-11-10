/** Shared bits for the DISCORD pages (Info Posts, Tickets, Moderation): synced lists, pickers, Cortana jobs, Discord preview CSS. */
import { addDoc, collection, doc, getDoc, getDocs } from "/terminal-shim/firestore.js";
import { db, esc } from "./_common.js";

export async function loadDiscord() {
  const [cs, rs] = await Promise.all([getDocs(collection(db, "discord_channels")), getDocs(collection(db, "discord_roles"))]);
  return {
    chans: cs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.position || 0) - (b.position || 0)),
    roles: rs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.position || 0) - (a.position || 0)),
  };
}

/** <option>s grouped by Discord category. kinds: ["text","announcement"] | ["category"] … */
export function chanOptions(chans, cur, { kinds = ["text", "announcement"], none = "— pick a channel —", needSend = true } = {}) {
  const list = chans.filter((c) => kinds.includes(c.type));
  if (kinds.length === 1 && kinds[0] === "category") return `<option value="">${esc(none)}</option>${list.map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>📁 ${esc(c.name)}</option>`).join("")}`;
  const g = new Map();
  for (const c of list) { const k = c.parentName || "NO CATEGORY"; if (!g.has(k)) g.set(k, []); g.get(k).push(c); }
  const missing = cur && !chans.some((c) => c.id === cur) ? `<option value="${esc(cur)}" selected>✕ deleted channel</option>` : "";
  return `<option value="">${esc(none)}</option>${missing}${[...g].map(([k, cs]) => `<optgroup label="${esc(k.toUpperCase())}">${cs.map((c) => `<option value="${c.id}" ${c.id === cur ? "selected" : ""} ${needSend && !c.botCanSend ? "disabled" : ""}># ${esc(c.name)}${needSend && !c.botCanSend ? " (Cortana can't post)" : ""}</option>`).join("")}</optgroup>`).join("")}`;
}
export function roleOptions(roles, cur, none = "— pick a role —", { assignable = false, exclude = [] } = {}) {
  return `<option value="">${esc(none)}</option>${roles.filter((r) => !r.managed && !exclude.includes(r.id)).map((r) => `<option value="${r.id}" ${r.color && r.color !== "#000000" ? `data-color="${r.color}"` : ""} ${r.id === cur ? "selected" : ""} ${assignable && !r.botCanAssign ? "disabled" : ""}>@${esc(r.name)}${assignable && !r.botCanAssign ? " (Cortana can't give this)" : ""}</option>`).join("")}`;
}

/** Queue a Cortana job; optionally wait for it. Returns the finished job (or null if Cortana is offline). */
export async function cortanaJob(type, payload, { wait = true, ms = 20000 } = {}) {
  const ref = await addDoc(collection(db, "bot_jobs"), { type, createdAtISO: new Date().toISOString(), payload });
  if (!wait) return { id: ref.id };
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const d = (await getDoc(doc(db, "bot_jobs", ref.id)).catch(() => null))?.data();
    if (d?.status === "failed") throw new Error(d.error || "Cortana could not do it");
    if (d?.status === "done") return d;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

export const hex = (n) => "#" + Number(n ?? 0x194a77).toString(16).padStart(6, "0");
export const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
export const ukTime = (iso, o = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", ...o }) : "—");
export const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

/** Discord look-alike preview styles, scoped to a root id. */
export const discordCss = (r) => `
${r} .dc{background:#313338;border-radius:6px;padding:14px;font-family:"Segoe UI",sans-serif;color:#dbdee1;font-size:14px;line-height:1.4}
${r} .dc .h{display:flex;gap:8px;align-items:center}${r} .dc .h i{width:36px;height:36px;border-radius:50%;background:#0b1a22 url(/images/logo.png) center/70% no-repeat;flex-shrink:0}${r} .dc .h b{color:#00d9ff;font-weight:500}${r} .dc .ap{background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px}
${r} .dc .pl{margin:2px 0 0 44px}${r} .mn{background:rgba(88,101,242,.3);color:#c9cdfb;padding:0 2px;border-radius:3px}
${r} .dc .e{border-left:4px solid var(--ec,#194A77);background:#2b2d31;padding:10px 12px;border-radius:4px;margin:6px 0 0 44px;max-width:480px}
${r} .dc .e .t{font-weight:700;color:#f2f3f5;margin-bottom:4px}${r} .dc .e .f{font-size:12px;color:#949ba4;margin-top:8px}${r} .dc .e .fl b{color:#f2f3f5;display:block;margin-top:8px}
${r} .dc .e .fg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px}${r} .dc .e .th{width:64px;height:64px;border-radius:4px;background:#0b1a22 center/85% no-repeat;flex-shrink:0}
${r} .dc .e img.big{max-width:100%;border-radius:4px;margin-top:8px;display:block}${r} .dc code{background:#1e1f22;padding:0 3px;border-radius:3px}
${r} .dc .bt{display:flex;gap:6px;margin:8px 0 0 44px;flex-wrap:wrap}${r} .dc .bt span{background:#4e5058;color:#fff;padding:6px 12px;border-radius:4px;font-size:13px}
${r} .dc .bt .green{background:#248046}${r} .dc .bt .blue{background:#5865f2}${r} .dc .bt .red{background:#da373c}
${r} .dc .sel{margin:8px 0 0 44px;background:#1e1f22;border-radius:4px;padding:8px 10px;color:#949ba4;font-size:13px;max-width:320px}
${r} .dc .eph{margin-left:44px;font-size:12px;color:#949ba4}
`;
