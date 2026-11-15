import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuditData, AuditEntry } from "../../../preload/api";

/**
 * SECURITY → AUDIT LOG in the app (approved mock 2026-11-15). Same data as the website's Audit Log v3.
 * One feed (Website / Discord / Hub / Cortana), filters, detail panel (before / after, saved pictures).
 * Commander / Developer: tick rows → DELETE SELECTED (reason + type DELETE). The website saves a .txt to Archives
 * first and leaves a LOCKED record. Locked rows can't be ticked.
 * Keys: ↑ ↓ move · Space ticks · / search · Esc closes the box.
 */
const SRC: Record<string, [string, string]> = { website: ["WEBSITE", "#00D9FF"], discord: ["DISCORD", "#8e98ff"], hub: ["HUB", "#2dd4bf"], cortana: ["CORTANA", "#a78bfa"] };
const ICON: [RegExp, string, string][] = [
  [/BULK DELETE|MESSAGE DELETED|ENTRIES DELETED/, "🗑", "#ff4d4d"], [/EDITED/, "✎", "#f59e0b"], [/AVATAR/, "🖼", "#00D9FF"], [/RENAMED/, "✎", "#00D9FF"],
  [/^JOINED/, "➕", "#22e07a"], [/^LEFT/, "➖", "#7d8a99"], [/KICK/, "👢", "#ff4d4d"], [/UNBAN/, "↺", "#22e07a"], [/BAN/, "⛔", "#ff4d4d"], [/TIMEOUT/, "🔇", "#f59e0b"],
  [/WARN/, "⚠", "#f59e0b"], [/ROLE/, "◆", "#a78bfa"], [/VOICE/, "🎙", "#7d8a99"], [/SIGN-IN|SIGN IN/, "🔑", "#2dd4bf"], [/CLEARED|CLEAN-UP/, "🔒", "#ffd166"], [/LOCK|ACCESS/, "🔒", "#a78bfa"], [/./, "•", "#00D9FF"],
];
const icon = (a: string) => ICON.find(([r]) => r.test(a))!.slice(1) as [string, string];
const ukDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
const ukT = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

export function Audit() {
  const [d, setD] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [src, setSrc] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [box, setBox] = useState(false);
  const [why, setWhy] = useState("");
  const [cf, setCf] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const last = useRef<string | null>(null);
  const qRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { const r = await window.cn.hub.audit(days); if (!r || "error" in r) setError(r?.error ?? "No answer"); else { setD(r); setError(null); } } catch { setError("This page needs an app restart"); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "audit_logs" || x === "audit_log") { clearTimeout(t); t = setTimeout(() => void load(), 800); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (d?.entries ?? []).filter((e) => (!src || e.source === src) && (!cat || e.cat === cat) && (!s || `${e.action} ${e.by} ${e.details} ${e.target ?? ""} ${e.channel ?? ""}`.toLowerCase().includes(s)));
  }, [d, src, cat, q]);
  const cats = useMemo(() => [...new Set((d?.entries ?? []).map((e) => e.cat))].sort(), [d]);
  const cur = list.find((e) => e.id === sel) ?? list[0] ?? null;
  const pickable = list.filter((e) => !e.locked).map((e) => e.id);

  const tick = (id: string, shift: boolean) => setPicked((p) => {
    const n = new Set(p);
    if (shift && last.current) { const a = pickable.indexOf(last.current), b = pickable.indexOf(id); if (a >= 0 && b >= 0) { pickable.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => n.add(x)); last.current = id; return n; } }
    n.has(id) ? n.delete(id) : n.add(id); last.current = id; return n;
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setBox(false); return; }
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (box || /INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === "/") { e.preventDefault(); qRef.current?.focus(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const i = list.findIndex((x) => x.id === cur?.id), n = list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (n) { e.preventDefault(); setSel(n.id); document.getElementById(`au-${n.id}`)?.scrollIntoView({ block: "nearest" }); }
      }
      if (e.key === " " && cur && !cur.locked && d?.canDelete) { e.preventDefault(); tick(cur.id, false); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const del = async () => {
    if (why.trim().length < 3) return setErr("Enter a reason first");
    if (cf.trim().toUpperCase() !== "DELETE") return setErr("Type DELETE to confirm");
    setBusy(true);
    const r = await window.cn.hub.auditAction({ action: "delete", ids: [...picked], reason: why.trim() });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setBox(false); setPicked(new Set()); setWhy(""); setCf("");
    setToast([`${r.removed} ENTRIES DELETED · SAVED TO ${r.archive}`, true]);
    void load();
  };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const tdy = today(), n = (f: (e: AuditEntry) => boolean) => d.entries.filter(f).length;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  let day = "";
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Audit Log">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-cyan/15 pb-3">
        <div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">☍ AUDIT LOG</h1>
          <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">WEBSITE, DISCORD (CORTANA) AND HUB IN ONE FEED · {d.canDelete ? "YOU CAN DELETE ENTRIES" : "VIEW ONLY"}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => void load()} className={`${btn} border-cyan/30 text-dim hover:text-white`}>↻ REFRESH</button>
          <a href="https://www.505expeditionaryforce.com/terminal" target="_blank" rel="noreferrer" className={`${btn} border-cyan/30 text-dim no-underline hover:text-white`}>🗄 ARCHIVES / CLEAN-UP ON WEBSITE ↗</a></div>
      </div>

      <div className="my-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {([[n((e) => !!e.at && ukDay(e.at) === tdy), "TODAY", "#fff"], [n((e) => /DELETED/.test(e.action) && e.source === "discord"), `DELETED MESSAGES (${d.days} D)`, "#ff8080"],
          [n((e) => /KICK|BAN|TIMEOUT|WARN/.test(e.action)), `MODERATION (${d.days} D)`, "#f59e0b"], [n((e) => e.source === "hub"), `HUB ACTIVITY (${d.days} D)`, "#2dd4bf"]] as const).map(([v, l, c]) =>
          <div key={l} className="tile border border-cyan/15 bg-panel px-3.5 py-2.5"><b className="block font-head text-[24px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>)}
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Source">
        {[["", "ALL", "#00D9FF"], ...Object.entries(SRC).map(([k, [l, c]]) => [k, l, c])].map(([k, l, c]) =>
          <button key={k} type="button" role="tab" aria-selected={src === k} onClick={() => setSrc(k!)} className="rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[1.5px]"
            style={src === k ? { background: c, color: "#0a0e14", borderColor: c } : { borderColor: "#ffffff1a", color: "#9aa7b4" }}>{l}</button>)}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input ref={qRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, action, channel…  ( / )" aria-label="Search" className="min-w-[220px] flex-1 border border-cyan/25 bg-[#0a0e14] px-2.5 py-1.5 text-[12px] outline-none focus:border-cyan" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="border border-cyan/25 bg-[#0a0e14] px-2 py-1.5 text-[11px] tracking-[1px]">
          <option value="">ALL CATEGORIES</option>{cats.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
        <select value={days} onChange={(e) => { setDays(Number(e.target.value)); setPicked(new Set()); }} aria-label="Time range" className="border border-cyan/25 bg-[#0a0e14] px-2 py-1.5 text-[11px] tracking-[1px]">
          <option value={1}>TODAY</option><option value={7}>LAST 7 DAYS</option><option value={30}>LAST 30 DAYS</option></select>
      </div>

      {picked.size > 0 && (
        <div role="region" aria-label="Selection" className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded border border-bad/50 bg-bad/10 px-3.5 py-2">
          <b className="text-[11px] tracking-[2px] text-[#ff8080]">{picked.size} SELECTED</b>
          <span className="flex-1 text-[11px] text-dim">Locked 🔒 records can't be selected.</span>
          <button type="button" onClick={() => setPicked(new Set(pickable))} className={`${btn} border-cyan/30 text-dim`}>SELECT ALL SHOWN</button>
          <button type="button" onClick={() => setPicked(new Set())} className={`${btn} border-cyan/30 text-dim`}>CLEAR</button>
          <button type="button" onClick={() => { setErr(""); setBox(true); }} className={`${btn} border-bad/60 text-[#ff8080]`}>🗑 DELETE SELECTED…</button>
        </div>)}

      <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
        <div className="overflow-hidden rounded border border-cyan/15 bg-panel" role="list" aria-label="Audit entries">
          {!list.length && <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">NOTHING MATCHES</p>}
          {list.map((e) => {
            const [ic, col] = icon(e.action), [sl, sc] = SRC[e.source] ?? ["?", "#7d8a99"], dk = e.at ? ukDay(e.at) : "—", head = dk !== day ? (day = dk, true) : false;
            return (<div key={e.id}>
              {head && <div className="border-b border-white/5 bg-[#0a0e14] px-3.5 py-1.5 text-[9.5px] tracking-[2px] text-dimmer">{dk === tdy ? "TODAY" : dk}</div>}
              <div id={`au-${e.id}`} role="listitem" onClick={() => setSel(e.id)} className={`grid cursor-pointer grid-cols-[22px_28px_1fr_auto] items-center gap-2.5 border-b border-l-[3px] border-b-white/5 px-3.5 py-2 ${cur?.id === e.id ? "border-l-cyan bg-cyan/10" : "border-l-transparent hover:bg-cyan/5"} ${picked.has(e.id) ? "bg-bad/10" : ""}`}>
                {d.canDelete ? <input type="checkbox" checked={picked.has(e.id)} disabled={e.locked} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => tick(e.id, (ev.nativeEvent as MouseEvent).shiftKey)}
                  aria-label={`Select ${e.action} by ${e.by}`} className="h-4 w-4 cursor-pointer accent-[#ff4d4d] disabled:cursor-not-allowed disabled:opacity-25" /> : <span />}
                <span aria-hidden="true" className="grid h-[26px] w-[26px] place-items-center rounded-full bg-white/5 text-[12px]" style={{ color: col }}>{e.locked ? "🔒" : ic}</span>
                <span className="min-w-0"><span className="mr-1.5 rounded-full border px-1.5 text-[9px] tracking-[1.5px]" style={{ color: sc, borderColor: `${sc}66` }}>{sl}</span>
                  <b className="text-[11px] tracking-[1.5px]" style={{ color: col }}>{e.action}</b>
                  <span className="block truncate text-[12px] text-[#c6d0da]">{e.by} <span className="text-dim">· {e.details}</span></span></span>
                <span className="text-[10.5px] text-dim">{e.at ? ukT(e.at) : ""}</span>
              </div></div>);
          })}
        </div>

        {cur && (<aside aria-live="polite" className="h-fit rounded border border-cyan/15 bg-panel p-3.5 xl:sticky xl:top-0">
          <h2 className="m-0 text-[12px] tracking-[2px]" style={{ color: icon(cur.action)[1] }}>{cur.locked ? "🔒" : icon(cur.action)[0]} {cur.action}</h2>
          <div className="mt-1.5 flex gap-1.5"><span className="rounded-full border px-1.5 text-[9px] tracking-[1.5px]" style={{ color: (SRC[cur.source] ?? ["", "#7d8a99"])[1], borderColor: `${(SRC[cur.source] ?? ["", "#7d8a99"])[1]}66` }}>{(SRC[cur.source] ?? ["?"])[0]}</span>
            <span className="rounded-full border border-white/15 px-1.5 text-[9px] tracking-[1.5px] text-dim">{cur.cat.toUpperCase()}</span></div>
          <dl className="my-3 grid grid-cols-[84px_1fr] gap-x-2.5 gap-y-1.5 text-[12px]">
            <dt className="text-[10px] tracking-[1px] text-dim">WHO</dt><dd className="m-0">{cur.by}</dd>
            {(cur.target || cur.channel) && <><dt className="text-[10px] tracking-[1px] text-dim">WHERE</dt><dd className="m-0">{[cur.target, cur.channel].filter(Boolean).join(" · ")}</dd></>}
            <dt className="text-[10px] tracking-[1px] text-dim">WHEN</dt><dd className="m-0">{cur.at ? new Date(cur.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</dd>
            {!!cur.extra.reason && <><dt className="text-[10px] tracking-[1px] text-dim">REASON</dt><dd className="m-0">{String(cur.extra.reason)}</dd></>}
            <dt className="text-[10px] tracking-[1px] text-dim">DETAILS</dt><dd className="m-0 break-words">{cur.details || "—"}</dd>
          </dl>
          {cur.content && <div className="mb-2 rounded border border-bad/30 bg-bad/10 px-2.5 py-2 text-[12px]"><small className="block text-[9px] tracking-[1.5px] text-dim">MESSAGE TEXT</small>{cur.content}</div>}
          {(cur.before != null || cur.after != null) && <div className="grid gap-2">
            {cur.before != null && <div className="rounded border border-bad/30 bg-bad/10 px-2.5 py-2 text-[12px]"><small className="block text-[9px] tracking-[1.5px] text-dim">BEFORE</small>{String(cur.before)}</div>}
            {cur.after != null && <div className="rounded border border-ok/30 bg-ok/10 px-2.5 py-2 text-[12px]"><small className="block text-[9px] tracking-[1.5px] text-dim">AFTER</small>{String(cur.after)}</div>}</div>}
          {cur.media?.map((m) => m.kind === "image" || /\.(png|jpe?g|gif|webp)$/i.test(m.name)
            ? <img key={m.url} src={m.url} alt={`Saved copy: ${m.name}`} className="mt-2 max-h-48 w-full rounded border border-cyan/20 object-contain" />
            : <p key={m.url} className="mt-2 text-[11px] text-dim">📎 {m.name} (saved copy)</p>)}
          {cur.mediaRemoved && <p className="mt-2 text-[11px] text-dimmer">Picture copy removed by clean-up.</p>}
          {cur.private && <p className="mt-2 text-[11px] text-amber">Message text hidden — Officer and above only.</p>}
          {cur.bulk && <p className="mt-2 text-[11px] text-dim">{cur.bulk.length} messages in this bulk delete — open on the website for the full list.</p>}
          {cur.locked && <p className="mt-3 border-t border-white/5 pt-2.5 text-[10.5px] text-[#ffd166]">🔒 LOCKED RECORD — can't be removed.</p>}
          <div className="mt-3 flex gap-1.5"><button type="button" onClick={() => void navigator.clipboard.writeText(`${cur.at ?? ""} ${cur.source.toUpperCase()} ${cur.action} — ${cur.by}: ${cur.details}`)} className={`${btn} border-cyan/30 text-dim`}>⧉ COPY</button>
            {!!cur.extra.messageUrl && <a href={String(cur.extra.messageUrl)} target="_blank" rel="noreferrer" className={`${btn} border-cyan/30 text-dim no-underline`}>↗ OPEN IN DISCORD</a>}</div>
        </aside>)}
      </div>

      {box && (<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5" role="dialog" aria-modal="true" aria-labelledby="au-del">
        <div className="w-full max-w-[440px] rounded-lg border border-bad/60 bg-panel p-5">
          <h2 id="au-del" className="m-0 text-[13px] tracking-[3px] text-[#ff8080]">DELETE {picked.size} ENTRIES?</h2>
          <p className="my-2 text-[12px] text-[#c6d0da]">A copy is saved to <b>Archives</b> (.txt) first. A <b>locked record</b> stays in the log: who deleted how many, when and why. That record can't be removed.</p>
          <label htmlFor="au-why" className="mt-2.5 block text-[10px] tracking-[1.5px] text-dim">REASON (REQUIRED)</label>
          <textarea id="au-why" autoFocus rows={2} value={why} onChange={(e) => { setWhy(e.target.value); setErr(""); }} className="mt-1 w-full border border-white/15 bg-[#0a0e14] p-2 text-[12px] outline-none focus:border-cyan" />
          <label htmlFor="au-cf" className="mt-2.5 block text-[10px] tracking-[1.5px] text-dim">TYPE DELETE TO CONFIRM</label>
          <input id="au-cf" value={cf} onChange={(e) => { setCf(e.target.value); setErr(""); }} autoComplete="off" className="mt-1 w-full border border-white/15 bg-[#0a0e14] p-2 text-[12px] outline-none focus:border-cyan" />
          <p role="alert" className="m-0 mt-1 min-h-[14px] text-[11px] text-[#ff8080]">{err}</p>
          <div className="mt-2.5 flex justify-end gap-2"><button type="button" onClick={() => setBox(false)} className={`${btn} border-cyan/30 text-dim`}>CANCEL</button>
            <button type="button" disabled={busy} onClick={() => void del()} className={`${btn} border-bad/60 text-[#ff8080]`}>{busy ? "DELETING…" : "🗑 DELETE"}</button></div>
        </div></div>)}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-bad/50 bg-[#1a0a0a] text-bad"}`}>{toast[0]}</div>}
    </main>
  );
}
