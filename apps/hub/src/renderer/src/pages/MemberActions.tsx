import { useState } from "react";
import type { HistoryEntry, MemberFile } from "../../../preload/api";

/**
 * Personnel file edit windows in the app — same windows and rules as the Terminal (member-actions.js):
 * Promote · Transfer · Warn · Award medal · Edit stats · Edit / delete a service record entry (reason required).
 * The website checks every rule again on the server.
 */
export type Action =
  | { kind: "promote" | "transfer" | "warn" | "medal" | "stats" }
  | { kind: "edit-entry" | "delete-entry"; list: string; index: number; entry: HistoryEntry };

const SITE = "https://www.505expeditionaryforce.com";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const rankOrder = (r: string) => { const m = /^([OE])(\d+)/.exec(r); return !m ? 999 : (m[1] === "O" ? 0 : 100) + (99 - Number(m[2])); };
const FIELDS: Record<string, [string, string, string?][]> = {
  promo: [["date", "DATE", "date"], ["fromRank", "FROM RANK"], ["toRank", "TO RANK"], ["note", "NOTE"]],
  platoon: [["date", "DATE", "date"], ["from", "FROM"], ["to", "TO"], ["note", "NOTE"]],
  warn: [["date", "DATE", "date"], ["severity", "SEVERITY"], ["note", "REASON"], ["expires", "EXPIRES", "date"]],
  commend: [["date", "DATE", "date"], ["title", "TITLE"], ["note", "CITATION"]],
  ribbon: [["date", "DATE", "date"], ["title", "TITLE"], ["note", "NOTE"]],
};
const TITLE: Record<string, [string, string]> = {
  promote: ["▲ PROMOTE / CHANGE RANK", "#22e07a"], transfer: ["⇄ TRANSFER", "#00D9FF"], warn: ["⚠ WARN", "#f59e0b"], medal: ["★ AWARD MEDAL", "#a78bfa"],
  stats: ["✎ EDIT STATS", "#00D9FF"], "edit-entry": ["✎ EDIT ENTRY", "#ffd166"], "delete-entry": ["🗑 DELETE ENTRY", "#ff4d4d"],
};

export function ActionWindow(p: { f: MemberFile; name: string; action: Action; onClose: () => void; onDone: (msg: string) => void }) {
  const { f, action } = p;
  const [v, setV] = useState<Record<string, unknown>>(() => {
    if (action.kind === "stats") return { attendance: f.attendance, promotionTracker: f.promotionTracker, opsAttended: f.opsAttended, opsEligible: f.opsEligible };
    if (action.kind === "edit-entry") return Object.fromEntries((FIELDS[action.list] ?? []).map(([k, , t]) => [k, String(action.entry[k] ?? "").slice(0, t === "date" ? 10 : 400)]));
    if (action.kind === "medal") return { medalImg: f.lists.medals[0]?.[0], title: f.lists.medals[0]?.[1], date: today(), notify: true };
    if (action.kind === "warn") return { severity: "VERBAL", date: today(), notify: true };
    return { date: today(), notify: true };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  const [title, color] = TITLE[action.kind]!;

  async function go() {
    setErr(null);
    const body: Record<string, unknown> =
      action.kind === "edit-entry" ? { action: "edit-entry", kind: action.list, index: action.index, expect: action.entry, reason: v.reason, changes: Object.fromEntries((FIELDS[action.list] ?? []).map(([k]) => [k, v[k]])) }
      : action.kind === "delete-entry" ? { action: "delete-entry", kind: action.list, index: action.index, expect: action.entry, reason: v.reason }
      : { action: action.kind, ...v };
    setBusy(true);
    const r = await window.cn.hub.memberAction(f.id, body);
    setBusy(false);
    if (r.error) return setErr(r.error);
    p.onDone(`${title.replace(/^\S+\s/, "")} — SAVED`);
  }

  const label = (t: string, id: string) => <label htmlFor={id} className="mb-1.5 mt-3 block text-[10.5px] tracking-[2px] text-cyan">{t}</label>;
  const input = (k: string, type = "text", extra: Record<string, unknown> = {}) => (
    <input id={`ma-${k}`} type={type} value={String(v[k] ?? "")} onChange={(e) => set(k, e.target.value)} {...extra}
      className="w-full border border-cyan/35 bg-black/55 px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan" />
  );
  const chips = (k: string, opts: string[], cur?: string) => (
    <div className="flex max-h-[190px] flex-wrap gap-1.5 overflow-auto">
      {opts.map((o) => (
        <button key={o} type="button" disabled={o === cur} aria-pressed={v[k] === o} onClick={() => set(k, o)}
          className="border px-2.5 py-1.5 text-[11px] tracking-[1px] disabled:opacity-40"
          style={{ borderColor: v[k] === o ? color : "rgba(0,217,255,.18)", color: v[k] === o ? color : "#c9d3de" }}>{o}{o === cur ? " · NOW" : ""}</button>
      ))}
    </div>
  );
  const notifyBox = (
    <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] text-[#c9d3de]">
      <input type="checkbox" checked={v.notify !== false} onChange={(e) => set("notify", e.target.checked)} className="accent-cyan" /> NOTIFY THE MEMBER + POST TO DISCORD
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-6" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-[min(580px,96vw)] border border-cyan/40 bg-panel" style={{ borderTop: `3px solid ${color}` }}>
        <div className="flex items-center border-b border-cyan/20 px-4 py-3"><b className="font-head text-[14px] tracking-[3px]" style={{ color }}>{title}</b>
          <button type="button" onClick={p.onClose} aria-label="Close" className="ml-auto px-2 text-dim hover:text-white">✕</button></div>
        <div className="max-h-[70vh] overflow-auto px-4 pb-4 pt-2">
          <div className="font-head text-[16px] font-bold tracking-[1.5px] text-white">{p.name}<small className="block font-mono text-[11px] font-normal text-dim">{f.rank || "No rank"} · {f.platoon || "No platoon"}</small></div>

          {action.kind === "promote" && (<>
            {label("NEW RANK", "ma-rank")}{chips("rank", [...f.lists.ranks].sort((a, b) => rankOrder(b) - rankOrder(a)), f.rank)}
            {typeof v.rank === "string" && <p className="mt-2 text-[12px]" style={{ color: rankOrder(v.rank) < rankOrder(f.rank) ? "#22e07a" : "#ff4d4d" }}>{f.rank || "—"} → {v.rank} {rankOrder(v.rank) < rankOrder(f.rank) ? "▲" : "▼ DEMOTION"}</p>}
            <div className="grid grid-cols-2 gap-3"><div>{label("DATE", "ma-date")}{input("date", "date")}</div><div>{label("REASON / NOTE", "ma-note")}{input("note", "text", { maxLength: 200 })}</div></div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] text-[#c9d3de]"><input type="checkbox" checked={v.resetPt === true} onChange={(e) => set("resetPt", e.target.checked)} className="accent-cyan" /> RESET PROMOTION TRACKER (PT) TO 0</label>
            {notifyBox}
          </>)}
          {action.kind === "transfer" && (<>
            {label("NEW PLATOON", "ma-plt")}{chips("platoon", f.lists.platoons, f.platoon)}
            <div className="grid grid-cols-2 gap-3"><div>{label("DATE", "ma-date")}{input("date", "date")}</div><div>{label("SQUAD (OPTIONAL)", "ma-squad")}{input("squad", "text", { maxLength: 40 })}</div></div>
            {label("REASON / NOTE", "ma-note")}{input("note", "text", { maxLength: 200 })}
            <p className="mt-2 text-[11px] text-dim">Platoon service date resets to the transfer date.</p>{notifyBox}
          </>)}
          {action.kind === "warn" && (<>
            {f.warningHistory.length > 0 && <div className="mt-3 border border-amber px-3 py-2 text-[11px] tracking-[1px] text-amber">THIS WILL BE WARNING #{f.warningHistory.length + 1} ON THIS FILE.</div>}
            {label("SEVERITY", "ma-sev")}{chips("severity", ["VERBAL", "WRITTEN", "FINAL"])}
            <div className="grid grid-cols-2 gap-3"><div>{label("DATE", "ma-date")}{input("date", "date")}</div><div>{label("EXPIRES (OPTIONAL)", "ma-expires")}{input("expires", "date")}</div></div>
            {label("REASON (REQUIRED)", "ma-reason")}{input("reason", "text", { maxLength: 400 })}{notifyBox}
          </>)}
          {action.kind === "medal" && (<>
            {label("MEDAL", "ma-medal")}
            <div className="grid grid-cols-4 gap-1.5">
              {f.lists.medals.map(([img, t]) => (
                <button key={img} type="button" aria-pressed={v.medalImg === img} onClick={() => setV((o) => ({ ...o, medalImg: img, title: t }))}
                  className="flex flex-col items-center gap-1 border px-1 py-2" style={{ borderColor: v.medalImg === img ? "#a78bfa" : "rgba(0,217,255,.18)" }}>
                  <img src={`${SITE}/images/medal_emojis/${encodeURIComponent(img)}`} alt="" className="h-[30px] w-[30px] object-contain" />
                  <small className="text-center text-[8.5px] tracking-[1px] text-[#c9d3de]">{t.toUpperCase()}</small>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3"><div>{label("TITLE", "ma-title")}{input("title", "text", { maxLength: 80 })}</div><div>{label("DATE", "ma-date")}{input("date", "date")}</div></div>
            {label("CITATION", "ma-note")}{input("note", "text", { maxLength: 400 })}
          </>)}
          {action.kind === "stats" && (<>
            <div className="grid grid-cols-4 gap-2.5">
              {[["attendance", "ATT PIPS (0–3)", f.attendance], ["promotionTracker", "PT", f.promotionTracker], ["opsAttended", "OPS ATTENDED", f.opsAttended], ["opsEligible", "OPS ELIGIBLE", f.opsEligible]].map(([k, l, now]) => (
                <div key={k as string}>{label(l as string, `ma-${k}`)}{input(k as string, "number", { min: 0, max: k === "attendance" ? 3 : undefined })}<small className="text-[9.5px] text-dimmer">NOW {now as number}</small></div>
              ))}
            </div>
            {label("REASON (REQUIRED · AUDIT LOG)", "ma-reason")}{input("reason", "text", { maxLength: 200 })}
            <p className="mt-2 text-[11px] text-dim">Ops attended can't be more than ops eligible.</p>
          </>)}
          {action.kind === "edit-entry" && (<>
            <div className="grid grid-cols-2 gap-x-3">
              {(FIELDS[action.list] ?? []).map(([k, l, t]) => <div key={k} className={k === "note" ? "col-span-2" : ""}>{label(l, `ma-${k}`)}{input(k, t ?? "text", { maxLength: 400 })}</div>)}
            </div>
            {label("REASON FOR THE CHANGE (REQUIRED · AUDIT LOG)", "ma-reason")}{input("reason", "text", { maxLength: 200 })}
          </>)}
          {action.kind === "delete-entry" && (<>
            <p className="mt-3 border border-bad/40 bg-bad/5 px-3 py-2 text-[13px] text-white">{String(action.entry.date ?? "—")} · {String(action.entry.toRank ?? action.entry.to ?? action.entry.title ?? action.entry.severity ?? "")} {action.entry.note ? `— ${String(action.entry.note)}` : ""}</p>
            <p className="mt-2 text-[12px] text-dim">The entry is removed from the service record. The reason is saved in the Audit Log.</p>
            {label("REASON (REQUIRED)", "ma-reason")}{input("reason", "text", { maxLength: 200 })}
          </>)}
        </div>
        <div className="flex items-center gap-2 border-t border-cyan/20 px-4 py-3">
          <span role="alert" className="flex-1 text-[11.5px] text-bad">{err}</span>
          <button type="button" onClick={p.onClose} className="border border-cyan/35 px-4 py-2 font-head text-[12px] font-bold tracking-[2px] text-cyan">CANCEL</button>
          <button type="button" disabled={busy} onClick={() => void go()} className="border px-4 py-2 font-head text-[12px] font-bold tracking-[2px] text-black disabled:opacity-50"
            style={{ background: color, borderColor: color }}>{busy ? "SAVING…" : action.kind === "delete-entry" ? "DELETE" : "SAVE"}</button>
        </div>
      </div>
    </div>
  );
}
