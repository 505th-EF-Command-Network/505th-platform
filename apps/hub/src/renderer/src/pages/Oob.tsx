import { useCallback, useEffect, useMemo, useState } from "react";
import type { OobData } from "../../../preload/api";

/**
 * ORDER OF BATTLE in the app — same as the Terminal's order-of-battle.js (structure + key format copied 1:1, so the
 * public career pages keep working): unit tabs with fill counts · editor (OPEN / FILLED / CLOSED + member picker,
 * show / hide section) · live public preview · save bar (only changed slots are saved). No "view public page" (app stays in app).
 */
type Slot = { status?: string; name?: string; userId?: string };
const STRUCTURE: Record<string, { accent: string; sections: Record<string, string[]> }> = {
  "Battalion Command": { accent: "#C9A227", sections: { "Command Staff": ["O9 / Lieutenant General", "O8 / Major General", "O7 / Brigadier General", "O6 / Colonel", "O5 / Lieutenant Colonel", "O4 / Major", "O3 / Captain", "O2 / First Lieutenant", "O1 / Second Lieutenant"] } },
  "Alpha Company": { accent: "#8aad44", sections: {
    "1st Platoon — Killjoy": ["Platoon Commander", "Platoon Sergeant", "KJ 1-1 SQL", ...m(8), "KJ 1-2 SQL", ...m(8), "KJ 1-3 SQL", ...m(8)],
    "2nd Platoon": ["Platoon Commander", "Platoon Sergeant", "Alpha 2-1 SQL", ...m(8), "Bravo 2-2 SQL", ...m(8), "Charlie 2-3 SQL", ...m(8)],
    "3rd Platoon": ["Platoon Commander", "Platoon Sergeant", "Alpha 3-1 SQL", ...m(8), "Bravo 3-2 SQL", ...m(8), "Charlie 3-3 SQL", ...m(8)] } },
  "JSOTF-23": { accent: "#a47de0", sections: { "1st Plt — Marine Recon": ["Platoon Commander", "Platoon Sergeant", "Stalker 1-0 SQL", ...m(6), "Stalker 2-0 SQL", ...m(6)] } },
  "54th Air Wing": { accent: "#00c4b7", sections: { "Wing Staff": ["Wing Commander", "Deputy Wing Commander"], "Alpha Squadron": ["Squadron CO", "Squadron XO", "Pilot 1", "Pilot 2", "Pilot 3", "Pilot 4"], "Bravo Squadron": ["Squadron CO", "Squadron XO", "Pilot 1", "Pilot 2", "Pilot 3", "Pilot 4"] } },
  "Support Company": { accent: "#e05a4a", sections: { "Hospital Corpsman": ["Hospital Overseer", "Hospital Supervisor", "Head of Training", "Corpsman 1", "Corpsman 2", "Corpsman 3", "Corpsman 4", "Corpsman 5", "Corpsman 6"] } },
};
function m(n: number) { return Array.from({ length: n }, (_, i) => `Marine ${i + 1}`); }
const PAGES: Record<string, [string, string]> = { "Battalion Command": ["505th Expeditionary Force", "/about-505th"], "Alpha Company": ["Alpha Company", "/about-alpha-company"], "JSOTF-23": ["JTF-23 Force Recon", "/about-stalker"], "Support Company": ["Hospital Corpsman", "/about-corpsman"], "54th Air Wing": ["54th Air Wing", "/about-54th-air-wing"] };
const ORDER = ["Battalion Command", "Alpha Company", "JSOTF-23", "Support Company", "54th Air Wing"];
const slotKey = (u: string, section: string, slot: string, squad: string) => `${u}__${section}__${squad ? `${squad}__${slot}` : slot}`.split(" ").join("_");
const hiddenKey = (u: string, section: string) => `__SECTION_HIDDEN__${u}__${section}`.split(" ").join("_");
function groupSlots(slots: string[]) {
  const staff: string[] = [], squads: { name: string; slots: string[] }[] = [];
  let cur: { name: string; slots: string[] } | null = null;
  for (const s of slots) { if (s.endsWith("SQL")) { cur = { name: s.replace(/ SQL$/, "").trim(), slots: [s] }; squads.push(cur); } else if (cur) cur.slots.push(s); else staff.push(s); }
  return { staff, squads };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Last data, kept while the app is open, so reopening the page is instant (fresh data loads behind it). */
let cache: OobData | null = null;

export function Oob() {
  const [d, setD] = useState<OobData | null>(cache);
  const [data, setData] = useState<Record<string, Slot | boolean>>(() => (cache ? JSON.parse(JSON.stringify(cache.data)) : {}));
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState("Battalion Command");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async (keep: boolean) => {
    const r = await window.cn.hub.oob();
    if ("error" in r) return setError(r.error);
    cache = r; setD(r); setError(null);
    if (!keep) setData(JSON.parse(JSON.stringify(r.data)));
  }, []);
  const dirty = useMemo(() => (d ? [...new Set([...Object.keys(data), ...Object.keys(d.data)])].filter((k) => !same(data[k], d.data[k])) : []), [d, data]);
  useEffect(() => {
    void load(false);
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "settings" || x === "users") { clearTimeout(t); t = setTimeout(() => void load(true), 400); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;

  const byId = new Map(d.members.map((x) => [x.id, x]));
  const get = (k: string): Slot => (data[k] as Slot) || { status: "open", name: "", userId: "" };
  const setSlot = (k: string, st: string, uid?: string) => {
    const v = get(k);
    if (st !== "filled") return setData({ ...data, [k]: { status: st, name: "", userId: "" } });
    const id = uid === undefined ? v.userId : uid === "__typed" ? "" : uid;
    const mem = id ? byId.get(id) : undefined;
    setData({ ...data, [k]: { status: "filled", userId: id || "", name: mem ? mem.name : uid === "__typed" ? v.name ?? "" : v.name || "" } });
  };
  const stats = (u: string) => { let f = 0, o = 0; for (const [sec, slots] of Object.entries(STRUCTURE[u]!.sections)) { const { staff, squads } = groupSlots(slots);
    for (const k of [...staff.map((s) => slotKey(u, sec, s, "")), ...squads.flatMap((q) => q.slots.map((s) => slotKey(u, sec, s, q.name)))]) { const st = get(k).status || "open"; if (st === "filled") f++; else if (st === "open") o++; } } return { f, o }; };
  const cfg = STRUCTURE[unit]!;
  const save = async () => {
    setBusy(true);
    const r = await window.cn.hub.oobAction({ changes: Object.fromEntries(dirty.map((k) => [k, data[k] ?? null])) });
    setBusy(false);
    setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]);
    if (!r.error) await load(false);
  };

  const row = (section: string, s: string, squad: string) => {
    const k = slotKey(unit, section, s, squad), v = get(k), st = v.status || "open", isDirty = !same(data[k], d.data[k]);
    return (
      <div key={k} className="relative grid items-center gap-3 border-b border-white/[.03] py-[7px]" style={{ gridTemplateColumns: "150px 228px minmax(0,1fr)" }}>
        {isDirty && <span className="absolute -left-[11px] text-[9px] text-amber">●</span>}
        <span className="truncate text-[13px] font-semibold text-[#e0e0e0]" title={s}>{s}</span>
        <div role="group" aria-label={`${s} status`} className="flex gap-1">{(["open", "filled", "closed"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={st === t} onClick={() => setSlot(k, t)} className="flex-1 border px-2 py-1.5 text-[10px] font-bold tracking-[1px]"
            style={st === t ? (t === "open" ? { background: "rgb(0 217 255 / .15)", color: "#00D9FF", borderColor: "#00D9FF" } : t === "filled" ? { background: "rgb(138 173 68 / .22)", color: "#b0d860", borderColor: "#8aad44" } : { background: "#1b2328", color: "#c4ccd2", borderColor: "#4b5765" })
              : { color: "#6f8a96", borderColor: "rgb(0 217 255 / .2)", background: "#061018" }}>{t.toUpperCase()}</button>))}</div>
        <div>{st === "filled"
          ? <select value={v.userId || (v.name ? "__typed" : "")} onChange={(e) => setSlot(k, "filled", e.target.value)} aria-label={`Member for ${s}`} className="w-full border border-cyan/25 bg-[#060a0e] px-2 py-1.5 text-[12.5px] text-white">
              <option value="">— pick a member —</option>{!v.userId && v.name && <option value="__typed">★ {v.name} (typed name, not linked)</option>}
              {d.members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          : <span className="text-[12px] text-[#4d6470]">{st === "open" ? "— open, recruiting —" : "— closed —"}</span>}</div>
      </div>);
  };
  const pv = (section: string, s: string, squad: string) => {
    const v = get(slotKey(unit, section, s, squad)), st = v.status === "filled" || v.status === "closed" ? v.status : "open";
    const mem = v.userId ? byId.get(v.userId) : undefined;
    return { s, c: st[0] as "f" | "o" | "c", rank: st === "filled" ? mem?.rank ?? "" : "", name: st === "filled" ? (mem ? mem.short : v.name || "") : "" };
  };
  const HEX: Record<string, React.CSSProperties> = { f: { background: cfg.accent, color: "#fff" }, o: { background: "rgb(0 217 255 / .14)", color: "#00D9FF" }, c: { background: "#1b2328", color: "#55626a" } };
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Order of Battle">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">ORDER OF BATTLE</h1>
      <p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">SETS THE UNIT CARDS ON THE PUBLIC CAREER PAGES · LIVE PREVIEW ON THE RIGHT</p>
      <div className="my-3 flex flex-wrap gap-1.5">{ORDER.map((u) => { const s = stats(u), c = STRUCTURE[u]!.accent; return (
        <button key={u} type="button" aria-pressed={u === unit} onClick={() => setUnit(u)} className="flex items-center gap-2 border px-3 py-2 text-[12px] font-bold tracking-[1.5px]"
          style={u === unit ? { color: "#fff", borderColor: c, background: `color-mix(in srgb, ${c} 12%, transparent)` } : { color: "#6f8a96", borderColor: "rgb(0 217 255 / .18)" }}>
          <i className="h-2.5 w-2.5" style={{ background: c }} />{PAGES[u]![0].toUpperCase()}<small className="text-[10px] opacity-80">{s.f}/{s.f + s.o}</small></button>); })}</div>
      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)" }}>
        <section className="border border-cyan/15 bg-black/25">
          <div className="flex items-center justify-between border-b border-cyan/15 px-3.5 py-2.5"><b className="text-[12px] tracking-[2px] text-cyan">{PAGES[unit]![0].toUpperCase()}</b><small className="text-[10px] tracking-[1px] text-dim">PUBLIC CARD: {unit.toUpperCase()}</small></div>
          {Object.entries(cfg.sections).map(([section, slots]) => {
            const hk = hiddenKey(unit, section), hidden = data[hk] === true, { staff, squads } = groupSlots(slots);
            return (
              <div key={section} className="border-b border-cyan/[.08]">
                <div className="flex items-center gap-2.5 bg-cyan/[.04] px-3.5 py-2.5">
                  <b className="flex-1 font-head text-[13px] uppercase tracking-[2px]" style={{ color: cfg.accent }}>{section}</b>
                  <button type="button" role="switch" aria-checked={!hidden} onClick={() => setData({ ...data, [hk]: !hidden })} className="flex items-center gap-1.5 text-[10px] tracking-[1px] text-[#6f8a96]">
                    <span className="relative h-4 w-[30px] border" style={hidden ? { borderColor: "#6f8a96" } : { borderColor: "#22e07a", background: "rgb(34 224 122 / .2)" }}>
                      <i className="absolute top-[2px] h-2.5 w-2.5" style={hidden ? { left: 2, background: "#6f8a96" } : { right: 2, background: "#22e07a" }} /></span>{hidden ? "HIDDEN" : "SHOWN"}</button>
                </div>
                <div className="px-3.5 pb-2 pt-1">{staff.map((s) => row(section, s, ""))}
                  {squads.map((q) => <div key={q.name}><div className="mb-0.5 mt-2.5 text-[11px] font-bold tracking-[2px]" style={{ color: cfg.accent }}>{q.name.toUpperCase()}</div>{q.slots.map((s) => row(section, s, q.name))}</div>)}</div>
              </div>);
          })}
          <div className="px-3.5 py-2.5 text-[10px] tracking-[1px] text-[#6f8a96]">FILLED + MEMBER = RANK &amp; NAME STAY IN SYNC WITH PERSONNEL FILES</div>
        </section>
        <section className="sticky top-0 border border-cyan/15 bg-black/25">
          <div className="flex items-center justify-between border-b border-cyan/15 px-3.5 py-2.5"><b className="text-[12px] tracking-[2px] text-cyan">PUBLIC PAGE PREVIEW</b><small className="text-[10px] tracking-[1px] text-dim">WHAT VISITORS SEE</small></div>
          <div className="max-h-[calc(100vh-230px)] overflow-auto bg-[#050709] p-4">
            <div className="mb-3 border border-cyan/15 bg-[#0a1216] px-2 py-0.5 text-[10px] tracking-[1px] text-[#6f8a96]">🌐 505expeditionaryforce.com{PAGES[unit]![1]}</div>
            {Object.entries(cfg.sections).map(([section, slots]) => {
              if (data[hiddenKey(unit, section)] === true) return <div key={section} className="my-2 border border-dashed border-cyan/20 p-2 text-center text-[11px] text-[#6f8a96]">"{section}" is hidden — visitors don't see it</div>;
              const { staff, squads } = groupSlots(slots);
              const all = [...staff.map((s) => pv(section, s, "")), ...squads.flatMap((q) => q.slots.map((s) => pv(section, s, q.name)))];
              const f = all.filter((x) => x.c === "f").length, t = all.filter((x) => x.c !== "c").length;
              return (
                <div key={section} className="mb-3 border" style={{ borderColor: `color-mix(in srgb, ${cfg.accent} 30%, transparent)` }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${cfg.accent} 14%, transparent), transparent)` }}>
                    <b className="text-[13px] tracking-[2px]" style={{ color: cfg.accent }}>{unit === "Battalion Command" ? "COMMAND STAFF" : section.toUpperCase()}</b>
                    <span className="flex items-center gap-2 text-[10px] text-[#8a9aa6]">{t ? `${f} / ${t} FILLED` : "NOT RECRUITING"}<i className="inline-block h-[5px] w-[70px] bg-[#162027]"><i className="grow-x block h-full" style={{ width: `${t ? (f / t) * 100 : 0}%`, background: cfg.accent }} /></i></span></div>
                  {staff.length > 0 && <div className="grid gap-1.5 px-3 py-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>{staff.map((s) => { const x = pv(section, s, ""); return (
                    <div key={s} className="flex items-center gap-2 border border-white/[.07] bg-[#0a1216] px-2 py-1.5">
                      <div className="grid h-[33px] w-[30px] shrink-0 place-items-center text-[9px] font-bold [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" style={HEX[x.c]}>{x.c === "f" ? x.rank || "★" : x.c === "o" ? "+" : "—"}</div>
                      <div><div className="text-[9px] text-[#8a9aa6]">{s.toUpperCase()}</div><div className="text-[12px] font-bold" style={x.c === "f" ? { color: "#fff" } : x.c === "o" ? { color: "rgb(0 217 255 / .65)", fontStyle: "italic", fontWeight: 400 } : { color: "#6b7880" }}>{x.c === "f" ? `${x.rank ? x.rank + " " : ""}${x.name}` : x.c === "o" ? "Open" : "Closed"}</div></div>
                    </div>); })}</div>}
                  {squads.length > 0 && <div className="grid gap-1.5 px-3 pb-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>{squads.map((q) => (
                    <div key={q.name} className="border border-white/[.08] bg-[#0a1216]"><div className="border-b border-white/[.06] px-2 py-1 text-[10px] font-bold tracking-[1.5px]" style={{ color: cfg.accent }}>{q.name.toUpperCase()}</div>
                      {q.slots.map((s, i) => { const x = pv(section, s, q.name); return (
                        <div key={i} className="grid items-center gap-1.5 px-2 py-[3px] text-[12px]" style={{ gridTemplateColumns: "12px 1fr auto", background: i === 0 ? `color-mix(in srgb, ${cfg.accent} 7%, transparent)` : undefined }}>
                          <span className="h-[7px] w-[7px] rounded-full" style={x.c === "f" ? { background: cfg.accent } : x.c === "o" ? { border: "1px dashed #00D9FF" } : { background: "#2a343b" }} />
                          <span style={x.c === "o" ? { color: "rgb(0 217 255 / .6)", fontStyle: "italic" } : x.c === "c" ? { color: "#55626a" } : { color: "#d6dde6" }}>{x.c === "f" ? x.name : x.c === "o" ? "Open" : "Closed"}</span>
                          {x.c === "f" && <span className="border px-1 text-[9px] font-bold" style={{ borderColor: `color-mix(in srgb, ${cfg.accent} 45%, transparent)` }}>{x.rank || "—"}</span>}</div>); })}</div>))}</div>}
                </div>);
            })}
          </div>
        </section>
      </div>
      {dirty.length > 0 && (
        <div className="rise sticky bottom-2.5 z-10 mt-2.5 flex items-center justify-between gap-2.5 border border-amber bg-[#141006] px-3.5 py-2.5 text-[11px] tracking-[2px] text-amber">
          <span>{dirty.length} UNSAVED CHANGE{dirty.length === 1 ? "" : "S"}</span>
          <div className="flex gap-2"><button type="button" onClick={() => setData(JSON.parse(JSON.stringify(d.data)))} className="border border-cyan/30 px-3 py-1.5 text-white">DISCARD</button>
            <button type="button" disabled={busy} onClick={() => void save()} className="border border-gold bg-gold px-3 py-1.5 font-bold text-black disabled:opacity-50">{busy ? "SAVING…" : "SAVE · UPDATE PUBLIC PAGE"}</button></div>
        </div>)}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
