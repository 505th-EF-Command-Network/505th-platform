import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Aar, AarData } from "../../../preload/api";

/**
 * AFTER ACTION REPORTS in the app — same as the Terminal's aar.js:
 * archive (search · op type / unit / drafts filters · list left, full report right · edit / delete)
 * + writer (6 sections with ✓, auto-saved DRAFT, PUBLISH when ready, objectives tick list, fill from attendance event, screenshots).
 * "Public page" link left out on purpose: the app never opens the website.
 */
const UNITS: Record<string, string> = { alpha: "Alpha Company", forcerecon: "JTF-23 Force Recon", corpsman: "Hospital Corpsman", airwing: "54th Air Wing", combined: "Combined Arms" };
const RES: Record<string, [string, string, string]> = { success: ["MISSION SUCCESS", "#22e07a", "✓"], partial: ["PARTIAL SUCCESS", "#f5c518", "◐"], failure: ["MISSION FAILURE", "#ff4d4d", "✕"] };
const OPS: Record<string, string> = { main_op: "Main Op", patrol: "Patrol", deployment: "Deployment", fun_op: "Fun Op" };
const CLS = ["CL-5", "CL-4", "CL-3", "CL-2", "CL-1"];
const ATT2OP: Record<string, string> = { main_op: "main_op", patrol: "patrol", training: "deployment", fun_op: "fun_op" };
const SECTIONS: [string, string[]][] = [["BRIEFING", ["title", "date", "opType", "unit", "commander"]], ["MISSION PLAN", ["mainObjective"]], ["WHAT HAPPENED", ["actualExecution"]], ["ENEMY", ["enemyFaction"]], ["DEBRIEF", ["result", "objectiveOutcome"]], ["ATTACHMENTS", []]];
const REQUIRED: Record<string, string> = { title: "Operation name", date: "Date", opType: "Op type", unit: "Unit", commander: "Commander", actualExecution: "Actual execution", result: "Result" };
const TEXT = ["title", "commander", "filedBy", "author", "location", "mainObjective", "commanderIntent", "objectiveStandards", "plannedExecution", "unitsInvolved", "enemyFaction", "enemyCasualties", "enemyTactics", "enemyDisposition", "successfulManeuvers", "mistakes", "unexpected", "objectiveOutcome", "lessonsLearned", "recommended", "miscComments", "result", "unit"] as const;
const filled = (v: unknown) => v != null && String(v).trim() !== "";
const opName = (t: string) => { if (!t) return "—"; const k = t.toLowerCase().trim().replace(/[\s-]+/g, "_"); return OPS[k] ?? OPS[({ mainop: "main_op", main: "main_op", funop: "fun_op", fun: "fun_op" } as Record<string, string>)[k.replace(/_/g, "")] ?? ""] ?? t; };
const ukDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }) : "—");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const inp = "w-full border border-cyan/30 bg-[#060a0e] px-2.5 py-2 text-[13px] text-white outline-none focus:border-cyan [color-scheme:dark]";
type V = Record<string, string>;
type W = { id: string | null; status: string; sec: number; v: V; objectives: { text: string; done: boolean }[]; files: string[]; dirty: boolean; saving: boolean; savedAt: string | null };

export function Aars(p: { me: string }) {
  const [d, setD] = useState<AarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fUnit, setFUnit] = useState("");
  const [fDrafts, setFDrafts] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [w, setW] = useState<W | null>(null);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wRef = useRef<W | null>(null);
  wRef.current = w;

  const load = useCallback(async () => { const r = await window.cn.hub.aars(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "aars") { clearTimeout(t); t = setTimeout(() => { if (!wRef.current) void load(); }, 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const save = async (mode: "save" | "publish", quiet = false) => {
    const cur = wRef.current;
    if (!cur || cur.saving) return;
    if (mode === "publish") {
      const miss = Object.entries(REQUIRED).filter(([k]) => !filled(cur.v[k])).map(([, l]) => l);
      if (miss.length) { setW({ ...cur, sec: 5 }); return setToast(["NOT READY TO PUBLISH — FILL: " + miss.join(", ").toUpperCase(), false]); }
    } else if (!filled(cur.v.title)) { if (!quiet) setToast(["ADD AN OPERATION NAME FIRST", false]); return; }
    setW({ ...cur, saving: true });
    const r = await window.cn.hub.aarsAction({ action: mode, id: cur.id ?? undefined, v: cur.v, objectives: cur.objectives, files: cur.files, quiet });
    if (r.error) { setW((o) => o && { ...o, saving: false }); return setToast([r.error, false]); }
    if (mode === "publish" && cur.status === "draft") { setToast(["✓ AAR PUBLISHED", true]); setW(null); setSel(r.id ?? null); setFDrafts(false); return void load(); }
    setW((o) => o && { ...o, id: r.id ?? o.id, status: r.status ?? o.status, saving: false, dirty: false, savedAt: r.savedAt ?? new Date().toISOString() });
    if (!quiet) setToast([r.status === "draft" ? "DRAFT SAVED" : "CHANGES SAVED", true]);
  };
  const touch = (patch: Partial<W>) => {
    setW((o) => o && { ...o, ...patch, dirty: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const c = wRef.current; if (c?.dirty && c.status === "draft" && filled(c.v.title)) void save("save", true); }, 4000);
  };
  const openWriter = (a?: Aar) => {
    const v: V = Object.fromEntries(TEXT.map((k) => [k, a ? String(a[k] ?? "") : ""]));
    Object.assign(v, { date: a?.date ? a.date.slice(0, 10) : today(), opType: a?.operationType ?? "", classification: a?.classification || "CL-5", actualExecution: a?.summary ?? "", personnel: a?.personnel == null ? "" : String(a.personnel), casualties: a ? String(a.casualties ?? "") : "" });
    if (!a) { v.filedBy = p.me; v.author = p.me; }
    setW({ id: a?.id ?? null, status: a ? a.status || "published" : "draft", sec: 0, v, objectives: a?.objectives.map((o) => ({ ...o })) ?? [], files: a ? [...a.attachments] : [], dirty: false, saving: false, savedAt: a?.updatedAt || null });
  };
  const leave = async () => { clearTimeout(timer.current); const c = wRef.current; if (c?.dirty && c.status === "draft") await save("save", true); setW(null); void load(); };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  if (w) return <Writer w={w} d={d} touch={touch} setW={setW} save={save} leave={leave} toast={toast} setToast={setToast} />;

  const isDraft = (a: Aar) => a.status === "draft";
  const list = d.reports.filter((a) => (fDrafts ? isDraft(a) : !isDraft(a)) && (!fType || opName(a.operationType) === OPS[fType]) && (!fUnit || a.unit === fUnit) && a.title.toLowerCase().includes(q.toLowerCase()));
  const cur = list.find((a) => a.id === sel) ?? list[0] ?? null;
  const pub = d.reports.filter((a) => !isDraft(a)), drafts = d.reports.filter(isDraft);
  const chip = (on: boolean) => `border px-2.5 py-1.5 text-[10.5px] tracking-[1px] ${on ? "border-cyan bg-cyan/10 text-white" : "border-cyan/20 text-dim"}`;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="After Action Reports">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">AFTER ACTION REPORTS</h1><div className="flex-1" />
        <input value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search…" aria-label="Search reports" className={`${inp} max-w-[220px]`} />
        <button type="button" onClick={() => openWriter()} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">＋ NEW AAR</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={!fType} onClick={() => setFType("")} className={chip(!fType)}>ALL <span className="opacity-70">{pub.length}</span></button>
        {Object.entries(OPS).map(([k, l]) => <button key={k} type="button" aria-pressed={fType === k} onClick={() => setFType(k)} className={chip(fType === k)}>{l.toUpperCase()}</button>)}
        <span className="ml-2 text-[10px] tracking-[2px] text-dim">UNIT</span>
        <button type="button" aria-pressed={!fUnit} onClick={() => setFUnit("")} className={chip(!fUnit)}>ALL</button>
        {Object.entries(UNITS).map(([k, l]) => <button key={k} type="button" aria-pressed={fUnit === k} onClick={() => setFUnit(k)} className={chip(fUnit === k)}>{l.split(" ")[0]!.toUpperCase()}</button>)}
        <button type="button" aria-pressed={fDrafts} onClick={() => setFDrafts(!fDrafts)} className={chip(fDrafts)}>DRAFTS <span className="opacity-70">{drafts.length}</span></button>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "330px minmax(0,1fr)", minHeight: 540 }}>
        <div role="listbox" aria-label="Reports" className="max-h-[calc(100vh-250px)] overflow-auto border border-cyan/15 bg-[#0b0f15]">
          {list.map((a, i) => { const r = RES[a.result];
            return (<button key={a.id} type="button" role="option" aria-selected={a.id === cur?.id} onClick={() => setSel(a.id)}
              className={`rise block w-full border-b border-cyan/5 border-l-[3px] px-3 py-2.5 text-left hover:bg-cyan/5 ${a.id === cur?.id ? "bg-cyan/10" : ""}`} style={{ borderLeftColor: isDraft(a) ? "#7d8a99" : r?.[1] ?? "#7d8a99", animationDelay: `${Math.min(i, 20) * 0.02}s` }}>
              <b className="block font-head text-[14px] tracking-[.5px] text-white">{a.title || "Untitled"}</b>
              <small className="text-[10.5px] text-dim">{isDraft(a) ? `DRAFT · saved ${a.updatedAt ? ukDate(a.updatedAt) : "—"}${a.submittedByName ? " by " + a.submittedByName : ""}` : `${ukDate(a.date).toUpperCase()} · ${opName(a.operationType).toUpperCase()} · ${(UNITS[a.unit] ?? "—").split(" ")[0]!.toUpperCase()}${r ? ` · ${r[2]} ${r[0].replace("MISSION ", "")}` : ""}`}</small>
            </button>); })}
          {!list.length && <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">{fDrafts ? "NO DRAFTS" : "NO REPORTS MATCH"}</p>}
        </div>
        <div className="max-h-[calc(100vh-250px)] min-w-0 overflow-auto border border-cyan/15 bg-[#0b0f15] p-5">
          {cur ? <Reader a={cur} onEdit={() => openWriter(cur)} onDelete={async () => {
            if (!await askBox(`DELETE THIS AAR?\n\n${cur.title}\n\n${isDraft(cur) ? "The draft is deleted." : "It is removed from the archive and the public AAR page."}\n\nTHIS CANNOT BE UNDONE.`)) return;
            const r = await window.cn.hub.aarsAction({ action: "delete", id: cur.id }); setToast(r.error ? [r.error, false] : ["AAR DELETED", true]); setSel(null); void load(); }} />
            : <p className="py-16 text-center text-[11px] tracking-[2px] text-dimmer">PICK A REPORT</p>}
        </div>
      </div>
      {toast && <Toast t={toast} />}
    </main>
  );
}

const Toast = ({ t }: { t: [string, boolean] }) => <div role="status" className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${t[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{t[1] ? "✓ " : "⚠ "}{t[0]}</div>;

function Reader({ a, onEdit, onDelete }: { a: Aar; onEdit: () => void; onDelete: () => void }) {
  const r = RES[a.result] ?? ["—", "#7d8a99", ""];
  const sec = (t: string, rows: [string, string][]) => { const x = rows.filter(([, v]) => filled(v)); return x.length ? <>
    <h4 className="mb-1.5 mt-4 text-[10.5px] tracking-[2.5px] text-cyan">{t}</h4>
    {x.map(([k, v]) => <div key={k} className="mb-2"><span className="text-[10px] tracking-[1.5px] text-dim">{k}</span><p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-[#d6dde6]">{v}</p></div>)}</> : null; };
  return (<>
    <div className="flex flex-wrap gap-1.5 text-[10px] tracking-[1.5px]">
      <span className="border border-cyan px-2 py-0.5 text-cyan">{opName(a.operationType).toUpperCase()}</span><span className="border px-2 py-0.5" style={{ color: r[1], borderColor: r[1] }}>{r[2]} {r[0]}</span>
      <span className="border border-[#7d8a99] px-2 py-0.5 text-[#7d8a99]">{a.classification || "CL-5"}</span>{a.status === "draft" && <span className="border border-[#ffd166] px-2 py-0.5 text-[#ffd166]">DRAFT — NOT PUBLISHED</span>}
    </div>
    <h2 className="mb-0.5 mt-2 font-head text-[24px] font-bold tracking-[2px] text-white">{a.title || "Untitled"}</h2>
    <div className="text-[10.5px] tracking-[1px] text-dim">{ukDate(a.date).toUpperCase()} · {(UNITS[a.unit] ?? "—").toUpperCase()}{a.commander ? ` · CO: ${a.commander}` : ""}{a.filedBy ? ` · FILED BY ${a.filedBy}` : ""}{a.location ? ` · 📍 ${a.location}` : ""}</div>
    <div className="my-3 grid grid-cols-4 gap-2">{([[a.personnel ?? "—", "DEPLOYED"], [a.casualties ?? 0, "FRIENDLY CAS"], [a.enemyCasualties || "—", "ENEMY CAS"], [a.objectives.length ? `${a.objectives.filter((o) => o.done).length}/${a.objectives.length}` : "—", "OBJECTIVES"]] as [string | number, string][]).map(([v, l]) => (
      <div key={l} className="border border-cyan/15 p-2 text-center"><b className="block font-mono text-[18px] text-white">{v}</b><span className="text-[9px] tracking-[1.5px] text-dim">{l}</span></div>))}</div>
    {a.objectives.length > 0 && <><h4 className="mb-1.5 mt-4 text-[10.5px] tracking-[2.5px] text-cyan">OBJECTIVES</h4><ul className="m-0 list-none p-0">{a.objectives.map((o, i) => <li key={i} style={{ color: o.done ? "#22e07a" : "#7d8a99" }}>{o.done ? "✓" : "○"} {o.text}</li>)}</ul></>}
    {sec("MISSION PLAN", [["MAIN OBJECTIVE", a.mainObjective], ["COMMANDER'S INTENT", a.commanderIntent], ["STANDARDS", a.objectiveStandards], ["PLANNED EXECUTION", a.plannedExecution]])}
    {sec("WHAT HAPPENED", [["ACTUAL EXECUTION", a.summary], ["UNITS INVOLVED", a.unitsInvolved], ["SUCCESSFUL MANOEUVRES", a.successfulManeuvers], ["MISTAKES", a.mistakes], ["UNEXPECTED", a.unexpected]])}
    {sec("ENEMY", [["FACTION", a.enemyFaction], ["DISPOSITION", a.enemyDisposition], ["TACTICS", a.enemyTactics]])}
    {sec("DEBRIEF", [["OUTCOME", a.objectiveOutcome], ["LESSONS LEARNED", a.lessonsLearned], ["RECOMMENDED", a.recommended], ["OTHER COMMENTS", a.miscComments]])}
    {a.attachments.length > 0 && <><h4 className="mb-1.5 mt-4 text-[10.5px] tracking-[2.5px] text-cyan">IMAGES</h4><div className="grid grid-cols-3 gap-2">{a.attachments.map((u) => <img key={u} src={u} alt="" loading="lazy" className="aspect-video w-full border border-cyan/15 object-cover" referrerPolicy="no-referrer" />)}</div></>}
    <div className="mt-3.5 text-[10.5px] tracking-[1px] text-dim">SUBMITTED BY {a.submittedByName || "—"}{a.submittedAt ? ` · ${ukDate(a.submittedAt)}` : ""}{a.updatedByName ? ` · LAST EDIT ${a.updatedByName}` : ""}</div>
    <div className="mt-3.5 flex justify-end gap-2">
      <button type="button" onClick={onEdit} className="border border-cyan/40 px-3 py-1.5 text-[11px] tracking-[1.5px] text-white">✎ {a.status === "draft" ? "CONTINUE DRAFT" : "EDIT"}</button>
      <button type="button" onClick={onDelete} className="border border-bad/60 px-3 py-1.5 text-[11px] tracking-[1.5px] text-bad">🗑 DELETE</button>
    </div>
  </>);
}

function Writer(p: { w: W; d: AarData; touch: (patch: Partial<W>) => void; setW: (f: (o: W | null) => W | null) => void; save: (m: "save" | "publish") => Promise<void>; leave: () => void; toast: [string, boolean] | null; setToast: (t: [string, boolean]) => void }) {
  const { w, d, touch } = p, v = w.v;
  const [obj, setObj] = useState("");
  const [up, setUp] = useState(false);
  const setV = (k: string, x: string) => touch({ v: { ...v, [k]: x } });
  const secDone = (i: number) => (i === 5 ? w.files.length > 0 : i === 1 ? filled(v.mainObjective) || w.objectives.length > 0 : SECTIONS[i]![1].every((k) => filled(v[k])));
  const F = (k: string, l: string, type: "text" | "date" | "number" | "area" = "text", max = 4000, h?: number) => (
    <div key={k}><label htmlFor={`aw_${k}`} className="mb-1 block text-[9.5px] tracking-[2px] text-dim">{l}{REQUIRED[k] && <i className="not-italic text-[#ffd166]"> *</i>}</label>
      {type === "area" ? <textarea id={`aw_${k}`} value={v[k] ?? ""} maxLength={max} onChange={(x) => setV(k, x.target.value)} className={inp} style={{ height: h ?? 76 }} />
        : <input id={`aw_${k}`} type={type} value={v[k] ?? ""} maxLength={max} min={type === "number" ? 0 : undefined} max={type === "number" ? 500 : undefined} onChange={(x) => setV(k, x.target.value)} className={inp} />}</div>);
  const S = (k: string, l: string, opts: [string, string][]) => (
    <div key={k}><label htmlFor={`aw_${k}`} className="mb-1 block text-[9.5px] tracking-[2px] text-dim">{l}{REQUIRED[k] && <i className="not-italic text-[#ffd166]"> *</i>}</label>
      <select id={`aw_${k}`} value={v[k] ?? ""} onChange={(x) => setV(k, x.target.value)} className={inp}><option value="">— pick —</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></div>);
  const addFiles = async (files: FileList) => {
    setUp(true);
    let list = [...w.files];
    for (const f of [...files].slice(0, 10 - list.length)) {
      if (!/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) { p.setToast([`SKIPPED ${f.name} (IMAGES UP TO 10 MB)`, false]); continue; }
      const r = await window.cn.hub.upload("505th_aar", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
      if (r.url) { list = [...list, r.url]; touch({ files: list }); } else p.setToast(["UPLOAD FAILED: " + (r.error ?? "error"), false]);
    }
    setUp(false);
  };
  const miss = Object.keys(REQUIRED).filter((k) => !filled(v[k]));
  const s = w.sec;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="AAR writer">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="m-0 font-head text-[22px] font-bold tracking-[4px] text-cyan">{w.id && w.status !== "draft" ? "EDIT AAR" : "NEW AAR"}</h1>
        <span role="status" className="text-[11px] tracking-[1.5px] text-dim">{w.saving ? "◷ SAVING…" : w.dirty ? "● UNSAVED" : w.savedAt ? `● ${w.status === "draft" ? "DRAFT " : ""}SAVED ${new Date(w.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
        <div className="flex-1" />
        <button type="button" onClick={p.leave} className="border border-cyan/30 px-3 py-2 text-[11px] tracking-[1.5px] text-white">← BACK</button>
        {w.status === "draft" ? <><button type="button" onClick={() => void p.save("save")} className="border border-cyan/30 px-3 py-2 text-[11px] tracking-[1.5px] text-white">SAVE DRAFT</button>
          <button type="button" onClick={() => void p.save("publish")} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">PUBLISH</button></>
          : <button type="button" onClick={() => void p.save("save")} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">SAVE CHANGES</button>}
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>
        <nav aria-label="Sections" className="flex flex-col gap-1 self-start">
          {SECTIONS.map(([t], i) => <button key={t} type="button" aria-current={s === i ? "step" : undefined} onClick={() => p.setW((o) => o && { ...o, sec: i })}
            className={`flex items-center justify-between border px-3 py-2.5 text-left text-[11px] tracking-[2px] ${s === i ? "border-cyan bg-cyan/10 text-white" : "border-cyan/15 text-dim"}`}>{t}{secDone(i) && <span className="text-ok">✓</span>}</button>)}
        </nav>
        <div>
          <section className="rise border border-cyan/15 bg-[#0b0f15] p-4" key={s}>
            <b className="font-head tracking-[3px] text-cyan">{SECTIONS[s]![0]}</b>
            <div className="mt-3">
              {s === 0 && <>
                <div className="mb-3 flex justify-end"><select aria-label="Fill from attendance event" defaultValue="" className={`${inp} max-w-[380px]`} onChange={(x) => {
                  const e = d.events.find((y) => y.id === x.target.value); if (!e) return;
                  touch({ v: { ...v, title: e.title || v.title, date: e.date || v.date, opType: ATT2OP[e.type] ?? v.opType, personnel: String(e.attendees) } }); p.setToast([`FILLED FROM ${e.title.toUpperCase()}`, true]); x.target.value = ""; }}>
                  <option value="">⇩ FILL FROM ATTENDANCE EVENT…</option>{d.events.map((e) => <option key={e.id} value={e.id}>{e.date} · {e.title} · {e.attendees} present</option>)}</select></div>
                <div className="grid grid-cols-3 gap-3">
                  {F("title", "OPERATION NAME", "text", 120)}{F("date", "DATE", "date")}{S("opType", "OP TYPE", Object.entries(OPS))}
                  {S("unit", "UNIT", Object.entries(UNITS))}{F("commander", "COMMANDER", "text", 80)}{F("filedBy", "FILED BY", "text", 80)}
                  {F("location", "LOCATION", "text", 100)}{F("unitsInvolved", "UNITS INVOLVED", "text", 200)}{S("classification", "CLASSIFICATION", CLS.map((c) => [c, c]))}
                  {F("personnel", "DEPLOYED", "number")}{F("casualties", "FRIENDLY CASUALTIES", "number")}{F("author", "AUTHOR (SHOWN PUBLICLY)", "text", 80)}
                </div></>}
              {s === 1 && <div className="grid grid-cols-2 gap-3">
                {F("commanderIntent", "COMMANDER'S INTENT", "area")}{F("mainObjective", "MAIN OBJECTIVE", "area")}
                <div><span className="mb-1 block text-[9.5px] tracking-[2px] text-dim">OBJECTIVES — TICK WHEN COMPLETED</span>
                  <ul className="m-0 list-none p-0">
                    {w.objectives.map((o, n) => <li key={n} className="flex items-center gap-2 border-b border-cyan/10 py-1"><label className="flex flex-1 items-center gap-2 text-[13px] text-white">
                      <input type="checkbox" checked={o.done} onChange={(x) => touch({ objectives: w.objectives.map((y, j) => (j === n ? { ...y, done: x.target.checked } : y)) })} className="accent-cyan" /> {o.text}</label>
                      <button type="button" aria-label="Remove objective" onClick={() => touch({ objectives: w.objectives.filter((_, j) => j !== n) })} className="text-bad">✕</button></li>)}
                    <li className="pt-1.5"><input value={obj} maxLength={120} onChange={(x) => setObj(x.target.value)} placeholder="＋ Add objective… (Enter)" aria-label="Add objective" className={inp}
                      onKeyDown={(x) => { if (x.key === "Enter" && obj.trim() && w.objectives.length < 20) { touch({ objectives: [...w.objectives, { text: obj.trim(), done: false }] }); setObj(""); } }} /></li>
                  </ul></div>
                <div className="space-y-3">{F("objectiveStandards", "STANDARDS / SUCCESS CRITERIA", "area")}{F("plannedExecution", "PLANNED EXECUTION", "area")}</div>
              </div>}
              {s === 2 && <div className="grid grid-cols-2 gap-3">{F("actualExecution", "ACTUAL EXECUTION (SUMMARY ON THE PUBLIC CARD)", "area", 8000, 120)}{F("successfulManeuvers", "SUCCESSFUL MANOEUVRES", "area", 4000, 120)}{F("mistakes", "MISTAKES", "area")}{F("unexpected", "UNEXPECTED EVENTS", "area")}</div>}
              {s === 3 && <div className="grid grid-cols-2 gap-3">{F("enemyFaction", "ENEMY FACTION", "text", 80)}{F("enemyCasualties", "ENEMY CASUALTIES", "text", 40)}{F("enemyDisposition", "ENEMY DISPOSITION", "area")}{F("enemyTactics", "ENEMY TACTICS", "area")}</div>}
              {s === 4 && <>
                <span className="mb-1 block text-[9.5px] tracking-[2px] text-dim">RESULT <i className="not-italic text-[#ffd166]">*</i></span>
                <div role="radiogroup" aria-label="Result" className="mb-3 flex gap-1.5">{Object.entries(RES).map(([k, [l, c, sy]]) => <button key={k} type="button" role="radio" aria-checked={v.result === k} onClick={() => setV("result", k)}
                  className="border px-3 py-1.5 text-[11px] tracking-[1px]" style={v.result === k ? { color: c, borderColor: c, background: c + "14" } : { color: "#7d8a99", borderColor: "rgb(var(--accent-rgb) / .2)" }}>{sy} {l}</button>)}</div>
                <div className="grid grid-cols-2 gap-3">{F("objectiveOutcome", "OUTCOME", "area")}{F("lessonsLearned", "LESSONS LEARNED", "area")}{F("recommended", "RECOMMENDED CHANGES", "area")}{F("miscComments", "OTHER COMMENTS", "area")}</div></>}
              {s === 5 && <>
                <label className="block cursor-pointer border border-dashed border-cyan/40 bg-cyan/5 px-4 py-6 text-center text-[12px] tracking-[1.5px] text-cyan hover:bg-cyan/10">
                  {up ? "◷ UPLOADING…" : "⇪ CLICK TO UPLOAD SCREENSHOTS · first image = cover on the public card"}
                  <input type="file" accept="image/*" multiple hidden disabled={up} onChange={(x) => { if (x.target.files) void addFiles(x.target.files); x.target.value = ""; }} /></label>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {w.files.map((u, n) => <div key={u} className="relative border border-cyan/20"><img src={u} alt="" className="aspect-video w-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute left-1 top-1 bg-black/70 px-1.5 text-[10px] text-white">{n === 0 ? "COVER" : `IMAGE ${n + 1}`}</span>
                    <button type="button" aria-label="Remove image" onClick={() => touch({ files: w.files.filter((_, j) => j !== n) })} className="absolute right-1 top-1 bg-black/70 px-1.5 text-bad">✕</button></div>)}
                  {!w.files.length && <span className="col-span-4 text-[11px] text-dim">NO IMAGES YET (OPTIONAL)</span>}
                </div>
                <div className="mt-4 border border-cyan/15 p-3"><b className="text-[11px] tracking-[2px] text-white">READY TO PUBLISH?</b>
                  <ul className="m-0 mt-2 list-none p-0 text-[12.5px]">{Object.entries(REQUIRED).map(([k, l]) => <li key={k} style={{ color: filled(v[k]) ? "#22e07a" : "#f59e0b" }}>{filled(v[k]) ? "✓" : "○"} {l}</li>)}
                    <li className="text-dim">{w.objectives.length ? `✓ ${w.objectives.filter((o) => o.done).length} of ${w.objectives.length} objectives ticked` : "○ No objectives (optional)"}</li></ul>
                  <div className="mt-2 text-[11px] text-dim">{miss.length ? "Fill the ○ items to publish." : "Publishing shows it on the public AAR page and Cortana posts it in Discord."}</div></div>
              </>}
            </div>
          </section>
          <div className="mt-3 flex justify-end gap-2">
            {s > 0 && <button type="button" onClick={() => p.setW((o) => o && { ...o, sec: s - 1 })} className="border border-cyan/30 px-3 py-2 text-[11px] tracking-[1.5px] text-white">← PREVIOUS</button>}
            {s < 5 && <button type="button" onClick={() => p.setW((o) => o && { ...o, sec: s + 1 })} className="border border-cyan/30 px-3 py-2 text-[11px] tracking-[1.5px] text-white">NEXT →</button>}
          </div>
        </div>
      </div>
      {p.toast && <Toast t={p.toast} />}
    </main>
  );
}
