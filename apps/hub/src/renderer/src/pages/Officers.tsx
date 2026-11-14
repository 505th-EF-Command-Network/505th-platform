import { useCallback, useEffect, useMemo, useState } from "react";
import type { OmData, OmItem, OmLog, RaData } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * OFFICER MANAGEMENT v2 (approved mock 2026-11-14) — same rules and data as the website (lib/terminal/om.ts).
 * People: one person's access in groups (✓ role · + given · − taken · 🔒), reason required, time-limited, recent changes + UNDO.
 * Role defaults: what each role gets. Change log: every change with UNDO.
 */
const LV: Record<string, number> = { recruiter: 2, nco: 2.5, staff_nco: 3, officer: 4, developer: 4.5, commander: 5 };
const RL: Record<string, string> = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER" };
const GROUPS = ["MANPOWER", "OPERATIONS", "DISCORD", "WORKSPACE", "SECURITY", "COMMAND"];
const GNAME: Record<string, string> = { OPERATIONS: "EVENTS" };
const FULL = new Set(["commander", "developer"]);
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const colOf = (u: string) => COLS[[...u].reduce((x, c) => x + c.charCodeAt(0), 0) % COLS.length];
const dt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dmy = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
type Row = { uid: string; role: string; overrides: Record<string, 0 | 1> };

export function Officers() {
  const [d, setD] = useState<OmData | null>(null);
  const [ra, setRa] = useState<RaData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<Row[]>([]);
  const [until, setUntil] = useState<Record<string, Record<string, string>>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<"people" | "roles" | "log">("people");
  const [q, setQ] = useState(""), [rf, setRf] = useState("");
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const [busy, setBusy] = useState(false);
  const [ut, setUt] = useState<{ open: boolean; key: string; date: string }>({ open: false, key: "", date: "" });
  const [raW, setRaW] = useState<Record<string, Record<string, 0 | 1>>>({});

  const load = useCallback(async () => {
    const r = await window.cn.hub.officers();
    if ("error" in r) { setErr(r.error); return; }
    if (!r.members) { setErr("You don't have Officer Management access."); return; }
    const ms = [...r.members].sort((a, b) => (LV[b.role] ?? 0) - (LV[a.role] ?? 0) || nm(a).localeCompare(nm(b)));
    setD({ ...r, members: ms });
    const rw = ms.map((m) => ({ uid: m.uid, role: m.role, overrides: { ...m.overrides } }));
    setRows(rw); setSaved(JSON.parse(JSON.stringify(rw))); setUntil({}); setErr(null);
    setSel((s) => s ?? ms.find((m) => m.uid !== r.me.uid && !FULL.has(m.role))?.uid ?? ms[0]?.uid ?? null);
    const x = await window.cn.hub.roles();
    if (!("error" in x)) { setRa(x); setRaW(JSON.parse(JSON.stringify(x.current ?? {}))); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const flash = (t: string, ok = true) => { setMsg([t, ok]); setTimeout(() => setMsg(null), 4000); };

  const roleDef = useCallback((role: string, it: OmItem) => {
    if (FULL.has(role)) return true;
    if (it.locked) return (LV[role] ?? 0) >= it.min;
    const o = ra?.current?.[role];
    if (o && it.key in o) return o[it.key] === 1;
    return ra ? !!ra.builtIn[role]?.[it.key] : (LV[role] ?? 0) >= it.min;
  }, [ra]);
  const has = (r: Row, it: OmItem) => (FULL.has(r.role) ? true : it.locked ? roleDef(r.role, it) : it.key in r.overrides ? r.overrides[it.key] === 1 : roleDef(r.role, it));
  const lockedWhy = (r: Row, it: OmItem) => {
    if (!d) return "";
    if (r.role === "commander") return "The Commander always has full access";
    if (r.role === "developer") return "Developers always have full access";
    if (r.uid === d.me.uid) return "You can't edit your own access";
    if (it.locked) return "Commander / Developer only";
    if (!d.assignable?.includes(r.role)) return "This member outranks your authority";
    return "";
  };
  const dirty = rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(saved[i])).length + Object.keys(until).length;

  if (err) return <main className="grid flex-1 place-items-center p-6 text-center"><div><div className="text-[30px]">🔒</div><p className="text-dim">{err}</p></div></main>;
  if (!d || !d.members) return <main className="flex-1 p-6 text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const members = d.members;
  const mOf = (uid: string) => members.find((m) => m.uid === uid)!;
  const i = rows.findIndex((r) => r.uid === sel);
  const r = rows[i], m = r ? mOf(r.uid) : null;

  const toggle = (it: OmItem) => {
    if (!r) return;
    const w = lockedWhy(r, it);
    if (w) return flash(w, false);
    const nx = { ...r.overrides };
    if (it.key in nx) delete nx[it.key];
    else {
      const grant = !roleDef(r.role, it);
      if (grant && !d.me.access[it.key]) return flash("You can't give access you don't have yourself", false);
      nx[it.key] = grant ? 1 : 0;
    }
    setRows(rows.map((x, j) => (j === i ? { ...x, overrides: nx } : x)));
  };
  const save = async () => {
    if (why.trim().length < 3) return flash("Write a reason first", false);
    setBusy(true);
    const changes = rows.filter((x, j) => JSON.stringify(x) !== JSON.stringify(saved[j]) || until[x.uid])
      .map((x) => ({ uid: x.uid, access: x.overrides, until: Object.fromEntries(Object.entries({ ...(mOf(x.uid).until ?? {}), ...(until[x.uid] ?? {}) }).map(([k, v]) => [k, v.length === 10 ? `${v}T23:59:00Z` : v])) }));
    const res = await window.cn.hub.officersAction({ changes, reason: why.trim() });
    setBusy(false);
    if (res.error) return flash(res.error, false);
    setWhy(""); flash("✓ Saved — Change Log + 🔔 alert to the member"); void load();
  };
  const undo = async (l: OmLog) => {
    if (dirty) return flash("Save or discard your changes first", false);
    if (!(await askBox(`UNDO THIS CHANGE?\n\n${l.targetName}: ${l.changes.join(", ")}`))) return;
    const res = await window.cn.hub.officersAction({ action: "undo", id: l.id });
    if (res.error) flash(res.error, false); else { flash("✓ Undone"); void load(); }
  };
  const logRow = (l: OmLog) => <div key={l.id} className={`flex items-center gap-3 border-b border-white/5 py-1.5 text-[12px] ${l.undone ? "opacity-50" : ""}`}>
    <span className="w-[120px] shrink-0 text-dim">{dt(l.atISO)}</span>
    <span className="min-w-0 flex-1"><b className="font-normal text-white">{l.byName}</b> → {l.targetName}: {l.changes.map((c, k) => <span key={k} style={{ color: c.startsWith("+") ? "#22e07a" : "#7d8a99" }}>{k ? ", " : ""}{c.startsWith("+") ? "ENABLED " : "DISABLED "}{c.slice(1)}</span>)} <i className="text-dim">— “{l.reason}”</i>{l.undone && <i className="text-dim"> (undone{l.undoneBy ? ` by ${l.undoneBy}` : ""})</i>}</span>
    {!l.undone && <button type="button" onClick={() => void undo(l)} className="border border-cyan/25 px-2 py-0.5 text-[10px] tracking-[1.5px] text-white hover:bg-cyan/10">UNDO</button>}</div>;

  const last = d.log?.[0];
  const Tab = ({ k, l }: { k: typeof tab; l: string }) => <button type="button" onClick={() => setTab(k)} className={`border px-3.5 py-1.5 text-[11px] tracking-[2px] ${tab === k ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim hover:text-white"}`}>{l}</button>;
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Officer Management">
      <h1 className="m-0 font-head text-[22px] font-bold tracking-[4px] text-white">★ OFFICER MANAGEMENT</h1>
      <p className="mb-3 mt-0.5 text-[11px] tracking-[1px] text-dim">ROLE GIVES DEFAULT ACCESS · CHANGES HERE ONLY AFFECT THAT PERSON · SAME AS THE WEBSITE</p>
      {msg && <p role="status" className={`mb-3 border-l-2 px-3 py-1.5 text-[12px] ${msg[1] ? "border-cyan bg-cyan/5 text-cyan" : "border-bad bg-bad/10 text-bad"}`}>{msg[0]}</p>}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[["STAFF", String(rows.length), "#fff"], ["WITH CUSTOM ACCESS", String(rows.filter((x) => Object.keys(x.overrides).length).length), "#a78bfa"],
          ["CHANGES (30 DAYS)", String((d.log ?? []).filter((l) => Date.now() - Date.parse(l.atISO) < 30 * 864e5).length), "#fff"], ["LAST CHANGE", last ? `${last.byName} · ${dt(last.atISO)}` : "—", "#fff"]].map(([l, v, c]) =>
          <div key={l} className="kpi !min-h-0"><small>{l}</small><b style={{ color: c, fontSize: l === "LAST CHANGE" ? 14 : undefined }}>{v}</b></div>)}
      </div>
      <div className="mb-3 flex gap-1.5"><Tab k="people" l="♟ PEOPLE" /><Tab k="roles" l="☰ ROLE DEFAULTS" /><Tab k="log" l="☍ CHANGE LOG" /></div>

      {tab === "people" && <div className="grid grid-cols-[300px_1fr] items-start gap-3">
        <section className="card">
          <div className="flex gap-1.5 border-b border-cyan/10 p-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="⌕ Find a person…" aria-label="Find a person" className="min-w-0 flex-1 border border-cyan/20 bg-[#070a0f] px-2 py-1 text-[12px] text-white" />
            <select value={rf} onChange={(e) => setRf(e.target.value)} aria-label="Role" className="border border-cyan/20 bg-[#070a0f] px-1 text-[11px] text-white"><option value="">ALL</option>{Object.entries(RL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="max-h-[calc(100vh-330px)] overflow-auto">
            {rows.map((x, j) => { const mm = mOf(x.uid), n = Object.keys(x.overrides).length;
              if (q && !nm(mm).toLowerCase().includes(q.toLowerCase())) return null; if (rf && x.role !== rf) return null;
              const ch = JSON.stringify(x) !== JSON.stringify(saved[j]);
              return <button key={x.uid} type="button" onClick={() => setSel(x.uid)} className={`flex w-full items-center gap-2.5 border-b border-l-[3px] border-b-white/5 px-3 py-2 text-left ${x.uid === sel ? "border-l-cyan bg-cyan/10" : ch ? "border-l-amber" : "border-l-transparent hover:bg-cyan/5"}`}>
                <Av m={mm} /><span className="min-w-0 flex-1"><b className="block truncate font-head text-[14px] text-white">{nm(mm)}{x.uid === d.me.uid && <i className="ml-1 text-[9px] text-dim">YOU</i>}</b><small className="text-[9.5px] tracking-[1.5px] text-dim">{RL[x.role] ?? x.role}</small></span>
                {n > 0 && <span className="border border-[#a78bfa66] px-1 text-[9.5px] text-[#a78bfa]">● {n}</span>}</button>; })}
          </div>
        </section>
        {r && m ? <section className="card">
          <div className="flex items-center gap-3.5 p-3.5"><Av m={m} big /><div className="min-w-0 flex-1"><div className="font-head text-[20px] font-bold tracking-[2px] text-white">{nm(m)}</div><small className="text-[10.5px] tracking-[1px] text-dim">ROLE DECIDES MOST ACCESS · CHANGES HERE ONLY AFFECT THIS PERSON</small></div>
            <span className="border px-2 py-0.5 text-[10px] tracking-[1.5px] text-cyan">{RL[r.role] ?? r.role}</span></div>
          {(FULL.has(r.role) || r.uid === d.me.uid) && <div className="mx-3.5 mb-2.5 border-l-2 border-amber bg-amber/10 px-2.5 py-1.5 text-[11px] tracking-[1px] text-amber">{r.uid === d.me.uid ? "YOU CAN'T EDIT YOUR OWN ACCESS." : `${RL[r.role]} ALWAYS HAS FULL ACCESS — NOTHING TO CHANGE.`}</div>}
          {GROUPS.map((g) => { const list = d.items.filter((it) => it.group === g); if (!list.length) return null;
            const un = { ...(m.until ?? {}), ...(until[r.uid] ?? {}) };
            return <div key={g} className="border-t border-white/5 px-3.5 py-2.5"><h4 className="m-0 mb-2 flex text-[10.5px] font-normal tracking-[2.5px] text-dim">{GNAME[g] ?? g}<span className="ml-auto text-dimmer">{list.filter((it) => has(r, it)).length}/{list.length}</span></h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">{list.map((it) => {
                const on = has(r, it), def = roleDef(r.role, it), ov = it.key in r.overrides, w = lockedWhy(r, it);
                const was = JSON.stringify(saved[i]?.overrides[it.key]) !== JSON.stringify(r.overrides[it.key]);
                const tag = it.locked ? "🔒" : ov ? (on ? "ENABLED" : "DISABLED") : on ? "ROLE" : "";
                return <button key={it.key} type="button" role="checkbox" aria-checked={on} aria-disabled={!!w} title={w || (ov ? "Click to reset to role" : on ? "Click to take away" : "Click to give")} onClick={() => toggle(it)}
                  className={`flex items-center gap-2 border px-2.5 py-1.5 text-left ${ov && on && !def ? "border-ok/50 bg-ok/5" : ov && !on && def ? "border-white/10 bg-white/[.02] opacity-50 [&_b]:line-through" : "border-white/10 bg-black/20"} ${w ? "cursor-not-allowed opacity-55" : ""} ${was ? "shadow-[0_0_0_2px_#f59e0b]" : ""}`}>
                  <i className={`grid h-[18px] w-[18px] place-items-center border text-[11px] not-italic ${on ? "border-ok text-ok" : "border-dimmer"}`}>{on ? "✓" : ""}</i>
                  <b className={`flex-1 text-[12.5px] font-medium ${on ? "text-white" : "text-dim"}`}>{it.label}</b>
                  <small className="text-[9px] tracking-[1px]" style={{ color: ov && on ? "#22e07a" : "#4b5765" }}>{tag}{un[it.key] && on && ov ? ` · UNTIL ${dmy(un[it.key]!.length === 10 ? un[it.key] + "T12:00:00Z" : un[it.key]!)}` : ""}</small></button>; })}</div></div>; })}
          <div className="flex flex-wrap items-center gap-3.5 border-t border-white/5 px-3.5 py-2 text-[10px] tracking-[1px] text-dim">
            <span>✓ HAS IT</span><span className="text-ok">ENABLED — ON TOP OF ROLE</span><span>DISABLED — GREYED OUT</span><span>🔒 COMMANDER / DEVELOPER ONLY</span>
            {!FULL.has(r.role) && r.uid !== d.me.uid && <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => { setRows(rows.map((x, j) => (j === i ? { ...x, overrides: {} } : x))); const u = { ...until }; delete u[r.uid]; setUntil(u); }} className="border border-cyan/25 px-2 py-0.5 text-white">↺ RESET TO ROLE</button>
              <button type="button" onClick={() => setUt({ ...ut, open: !ut.open })} className="border border-cyan/25 px-2 py-0.5 text-white">⏱ TIME-LIMITED…</button></span>}
          </div>
          {ut.open && <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3.5 py-2 text-[11px]"><span className="text-dim">GIVE ACCESS UNTIL</span>
            <select value={ut.key} onChange={(e) => setUt({ ...ut, key: e.target.value })} aria-label="Access" className="border border-cyan/20 bg-[#070a0f] px-1 py-0.5 text-white"><option value="">— pick (must be ENABLED) —</option>
              {d.items.filter((it) => !it.locked && r.overrides[it.key] === 1).map((it) => <option key={it.key} value={it.key}>{it.label}</option>)}</select>
            <input type="date" value={ut.date} onChange={(e) => setUt({ ...ut, date: e.target.value })} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} max={new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10)} aria-label="Until" className="border border-cyan/20 bg-[#070a0f] px-1 py-0.5 text-white" />
            <button type="button" onClick={() => { if (!ut.key || !ut.date) return flash("Pick the access and a date", false); setUntil({ ...until, [r.uid]: { ...(until[r.uid] ?? {}), [ut.key]: ut.date } }); setUt({ open: false, key: "", date: "" }); }} className="border border-cyan bg-cyan/10 px-2 py-0.5 text-cyan">SET</button>
            <span className="text-dim">· switches off by itself</span></div>}
          <div className="border-t border-cyan/10 px-3.5 py-2 text-[10.5px] tracking-[2.5px] text-cyan">RECENT CHANGES FOR THIS PERSON</div>
          <div className="px-3.5 pb-3">{(d.log ?? []).filter((l) => l.targetUid === r.uid).slice(0, 6).map(logRow)}
            {!(d.log ?? []).some((l) => l.targetUid === r.uid) && <p className="m-0 py-2 text-[11px] text-dim">No changes yet — everything comes from the role.</p>}</div>
        </section> : <section className="card grid min-h-[300px] place-items-center text-dim">← Pick someone</section>}
      </div>}

      {tab === "roles" && <RoleDefaults ra={ra} work={raW} setWork={setRaW} onSaved={() => { flash("✓ Role defaults saved"); void load(); }} onErr={(t) => flash(t, false)} />}

      {tab === "log" && <section className="card px-3.5 py-2">{(d.log ?? []).map(logRow)}{!(d.log ?? []).length && <p className="text-dim">No changes yet.</p>}</section>}

      {dirty > 0 && <div className="sticky bottom-0 mt-3 flex items-center gap-2.5 border border-amber bg-[#141006] px-3.5 py-2.5">
        <b className="text-[11px] tracking-[2px] text-amber">{dirty} CHANGE{dirty === 1 ? "" : "S"} — NOT SAVED</b>
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (Change Log + the member's alert)" aria-label="Reason" className="min-w-0 flex-1 border border-amber/50 bg-[#070a0f] px-2 py-1 text-[12px] text-white" />
        <button type="button" onClick={() => { setRows(JSON.parse(JSON.stringify(saved))); setUntil({}); }} className="border border-cyan/25 px-3 py-1 text-[11px] tracking-[1.5px] text-white">DISCARD</button>
        <button type="button" disabled={busy} onClick={() => void save()} className="border border-cyan bg-cyan/10 px-3 py-1 text-[11px] tracking-[1.5px] text-cyan disabled:opacity-40">{busy ? "SAVING…" : "SAVE"}</button></div>}
    </main>
  );
}

function RoleDefaults({ ra, work, setWork, onSaved, onErr }: { ra: RaData | null; work: Record<string, Record<string, 0 | 1>>; setWork: (w: Record<string, Record<string, 0 | 1>>) => void; onSaved: () => void; onErr: (t: string) => void }) {
  const roles = useMemo(() => (ra?.roles ?? []).filter((r) => !FULL.has(r.key)), [ra]);
  if (!ra) return <section className="card p-4 text-dim">Role defaults couldn't load.</section>;
  const on = (role: string, k: string) => (work[role] && k in work[role]! ? work[role]![k] === 1 : !!ra.builtIn[role]?.[k]);
  const changed = JSON.stringify(work) !== JSON.stringify(ra.current ?? {});
  return <section className="card overflow-auto">
    <div className="border-b border-cyan/10 px-3.5 py-2 text-[11px] text-dim">What each role gets by default. Per-person changes still win. {ra.canEdit ? "Click to change." : "Only Developers / Command can change these."}</div>
    <table className="w-full border-collapse text-[12px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim"><th className="px-3 py-2 text-left font-normal">ACCESS</th>{roles.map((r) => <th key={r.key} className="font-normal">{RL[r.key]}<small className="block text-dimmer">{r.count}</small></th>)}<th className="font-normal">DEV</th><th className="font-normal">CMDR</th></tr></thead>
      <tbody>{GROUPS.map((g) => { const list = ra.items.filter((it) => it.group === g); if (!list.length) return null;
        return [<tr key={g}><td colSpan={roles.length + 3} className="bg-cyan/5 px-3 py-1 text-[10px] tracking-[2.5px] text-cyan">{GNAME[g] ?? g}</td></tr>,
          ...list.map((it) => <tr key={it.key} className="border-t border-white/5"><td className="px-3 py-1.5 text-white">{it.label}{it.locked && <span className="ml-1 text-[9px] text-dim">🔒</span>}</td>
            {roles.map((r) => { const v = on(r.key, it.key), fixed = it.locked || !ra.canEdit;
              return <td key={r.key} className="text-center"><button type="button" disabled={fixed} aria-label={`${RL[r.key]} — ${it.label}`} onClick={() => setWork({ ...work, [r.key]: { ...(work[r.key] ?? {}), [it.key]: v ? 0 : 1 } })}
                className={`inline-grid h-5 w-5 place-items-center border text-[11px] ${v ? "border-ok text-ok" : "border-dimmer"} ${fixed ? "opacity-40" : ""}`}>{v ? "✓" : ""}</button></td>; })}
            <td className="text-center text-ok opacity-50">✓</td><td className="text-center text-ok opacity-50">✓</td></tr>)]; })}</tbody></table>
    {ra.canEdit && changed && <div className="flex justify-end gap-2 border-t border-amber/40 p-2.5">
      <button type="button" onClick={() => setWork(JSON.parse(JSON.stringify(ra.current ?? {})))} className="border border-cyan/25 px-3 py-1 text-[11px] text-white">DISCARD</button>
      <button type="button" onClick={async () => { if (!(await askBox("SAVE ROLE DEFAULTS?\n\nEveryone with these roles follows them (unless they have their own change)."))) return; const r = await window.cn.hub.rolesAction({ roles: work }); if (r.error) onErr(r.error); else onSaved(); }}
        className="border border-cyan bg-cyan/10 px-3 py-1 text-[11px] text-cyan">SAVE ROLE DEFAULTS</button></div>}
  </section>;
}

const nm = (m: { rank: string; callsign: string; firstName: string; lastName: string }) => {
  const r = (m.rank || "").split(" / ").pop() ?? "";
  const ab: Record<string, string> = { "Staff Sergeant": "SSgt", "Gunnery Sergeant": "GySgt", Sergeant: "Sgt", Corporal: "Cpl", "Lance Corporal": "LCpl", Captain: "Capt", "First Lieutenant": "1stLt", "Second Lieutenant": "2ndLt", "Master Sergeant": "MSgt", Private: "Pvt", "Private First Class": "PFC" };
  return [ab[r] ?? r, m.firstName ? `${m.firstName[0]}.` : "", m.callsign ? `"${m.callsign}"` : "", m.lastName].filter(Boolean).join(" ") || "Member";
};
function Av({ m, big }: { m: { uid: string; photo: string | null; firstName: string; lastName: string }; big?: boolean }) {
  const s = big ? 64 : 34;
  const clip = { clipPath: "polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)", width: s, height: s } as const;
  return m.photo ? <span className="shrink-0 bg-cover bg-center" style={{ ...clip, backgroundImage: `url("${m.photo}")` }} />
    : <span className="grid shrink-0 place-items-center font-head font-bold text-[#05070a]" style={{ ...clip, background: colOf(m.uid), fontSize: big ? 20 : 12 }}>{((m.firstName?.[0] ?? "") + (m.lastName?.[0] ?? "")).toUpperCase() || "?"}</span>;
}
