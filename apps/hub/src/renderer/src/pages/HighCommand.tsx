import { useCallback, useEffect, useMemo, useState } from "react";
import { askBox } from "../components/Confirm";

/**
 * COMMAND CENTRE → HIGH COMMAND MANAGEMENT (approved mock 18 Nov). Commander / Developer only.
 * Who can open which Command Centre pages, and until when. Same rules as the website (/api/hub/cmd-access → cmd-access-core.ts).
 * Commander + Developer always have everything. Cortana alerts 24 h before a time limit ends, then removes it.
 */
type Grant = { uid: string; name: string; role: string; keys: string[]; untilISO: string | null; by: string; reason: string; atISO: string | null; active: boolean };
type D = { grants: Grant[]; always: { uid: string; name: string; role: string }[]; members: { uid: string; name: string; role: string }[] };
const PAGES: [string, string, string][] = [["cmd_status", "Unit Status", "STATUS"], ["cmd_sitrep", "SITREP", "SITREP"], ["cmd_staff", "Command Staff", "STAFF"], ["cmd_suspend", "Suspensions", "SUSP"],
  ["ovr", "Overall Status", "OVERALL"], ["bot", "Bot Server", "BOT"], ["set", "Settings (Cortana / Discord)", "SETTINGS"]];
const PRESETS: [string, string[]][] = [["DEPUTY (ALL BUT SYSTEM)", ["cmd_status", "cmd_sitrep", "cmd_staff", "cmd_suspend", "ovr"]], ["STATUS ONLY", ["cmd_status", "cmd_sitrep", "ovr"]], ["STAFF ONLY", ["cmd_staff", "cmd_suspend"]]];
const ROLE: Record<string, string> = { commander: "Commander", developer: "Developer", officer: "Officer", staff_nco: "Staff NCO", nco: "NCO", recruiter: "Recruiter" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const plus = (days: number) => new Date(Date.now() + days * 864e5).toISOString();
const blank = { uid: "", keys: [] as string[], end: "never" as "never" | "1" | "7" | "30" | "date", date: "", reason: "", notify: true };

export function HighCommand() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => { try { const r = await window.cn.hub.cmdAccess(); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as D); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  const soon = useMemo(() => (d?.grants ?? []).filter((g) => g.active && g.untilISO && Date.parse(g.untilISO) - Date.now() < 7 * 864e5).length, [d]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim";
  const k = (n: number | string, l: string, c: string) => <div className="border border-white/10 bg-[#070a0f] px-3 py-2"><b className="block text-[22px]" style={{ color: c }}>{n}</b><small className="text-[10px] tracking-[1.5px] text-dim">{l}</small></div>;
  const edit = (g: Grant) => setV({ uid: g.uid, keys: g.keys.filter((x) => PAGES.some(([p]) => p === x)), end: g.untilISO ? "date" : "never", date: g.untilISO ? g.untilISO.slice(0, 10) : "", reason: g.reason, notify: true });
  const untilISO = (x: typeof blank) => (x.end === "never" ? null : x.end === "date" ? (x.date ? new Date(`${x.date}T23:59:00`).toISOString() : "") : plus(Number(x.end)));
  const save = async () => {
    if (!v) return;
    const u = untilISO(v);
    if (u === "") return setToast(["PICK AN END DATE", false]);
    setBusy(true); const r = await window.cn.hub.cmdAccessAction({ uid: v.uid, keys: v.keys, untilISO: u, reason: v.reason, notify: v.notify }); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : ["✓ ACCESS SAVED", true]); if (!r.error) { setV(null); void load(); }
  };
  const remove = async (g: Grant) => {
    if (!(await askBox(`Remove all Command Centre access from ${g.name}?`, { tone: "danger", go: "REMOVE" }))) return;
    setBusy(true); const r = await window.cn.hub.cmdAccessAction({ uid: g.uid, remove: true }); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : ["ACCESS REMOVED", true]); void load();
  };
  const sel = v ? (d.members.find((m) => m.uid === v.uid) ?? d.grants.find((g) => g.uid === v.uid)) : null;
  const ok = !!v && !!v.uid && v.keys.length > 0 && v.reason.trim().length >= 3;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="High Command Management">
      <div className="flex items-end gap-3"><div className="flex-1"><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">♛ HIGH COMMAND MANAGEMENT</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-amber">★ COMMANDER · WHO CAN OPEN THE COMMAND CENTRE · WHICH PAGES · FOR HOW LONG</p></div>
        <button type="button" onClick={() => setV({ ...blank })} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>＋ GIVE ACCESS</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{k(d.always.length, "ALWAYS (CMDR / DEV)", "#c9a227")}{k(d.grants.filter((g) => g.active).length, "HAVE ACCESS", "#22e07a")}{k(soon, "ENDS IN 7 DAYS", "#f59e0b")}{k(PAGES.length, "COMMAND PAGES", "#00D9FF")}</div>

      <section className="mt-4 overflow-auto border border-cyan/15 bg-panel">
        <table className="w-full border-collapse text-[12.5px]"><thead><tr className="text-left text-[9.5px] tracking-[1.5px] text-dim">
          <th className="px-3 py-2 font-normal">MEMBER</th>{PAGES.map(([key, l, s]) => <th key={key} title={l} className="px-2 py-2 text-center font-normal">{s}</th>)}<th className="px-3 py-2 font-normal">ENDS</th><th /></tr></thead>
          <tbody>
            {d.always.map((m) => <tr key={m.uid} className="border-t border-white/5"><td className="px-3 py-2"><b className="font-normal text-white">{m.name}</b><small className="block text-[10.5px] text-dim">{ROLE[m.role] ?? m.role}</small></td>
              <td colSpan={PAGES.length} className="px-2"><span className="border border-[#c9a227]/40 px-1.5 text-[9.5px] tracking-[1.5px] text-[#c9a227]">★ ALWAYS — ALL PAGES</span></td><td className="px-3 text-dim">—</td><td /></tr>)}
            {d.grants.map((g) => <tr key={g.uid} className={`border-t border-white/5 ${g.active ? "" : "opacity-50"}`}>
              <td className="px-3 py-2"><b className="font-normal text-white">{g.name}</b><small className="block text-[10.5px] text-dim">{ROLE[g.role] ?? g.role}{g.reason ? ` · “${g.reason}”` : ""}</small></td>
              {PAGES.map(([key, l]) => <td key={key} className="px-2 text-center" aria-label={`${l}: ${g.keys.includes(key) ? "yes" : "no"}`}>{g.keys.includes(key) ? <span className="text-ok">☑</span> : <span className="text-dimmer">☐</span>}</td>)}
              <td className="px-3">{!g.active ? <span className="text-[10px] tracking-[1px] text-bad">ENDED</span> : g.untilISO ? <span className="border border-amber/40 px-1.5 text-[10px] tracking-[1px] text-amber">{day(g.untilISO).toUpperCase()}</span> : <span className="border border-white/15 px-1.5 text-[10px] tracking-[1px] text-dim">NEVER</span>}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" onClick={() => edit(g)} className={`${btn} border-cyan/30 text-cyan`}>EDIT</button> <button type="button" disabled={busy} onClick={() => void remove(g)} className={`${btn} border-bad/40 text-bad`}>REMOVE</button></td></tr>)}
            {!d.grants.length && <tr className="border-t border-white/5"><td colSpan={PAGES.length + 3} className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NOBODY ELSE HAS COMMAND CENTRE ACCESS</td></tr>}
          </tbody></table></section>

      {v && <section className="mt-4 border border-cyan/30 bg-panel p-4" aria-label="Give or edit access">
        <h3 className="m-0 text-[10px] tracking-[3px] text-[#9cbf4a]">{sel ? `GIVE / EDIT ACCESS · ${sel.name.toUpperCase()}` : "GIVE ACCESS"}</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <div><label htmlFor="hcM" className={lbl}>MEMBER</label><select id="hcM" value={v.uid} onChange={(e) => setV({ ...v, uid: e.target.value })} className={inp}><option value="">— pick —</option>
            {d.members.map((m) => <option key={m.uid} value={m.uid}>{m.name} — {ROLE[m.role] ?? m.role}</option>)}</select></div>
          <div><span className={lbl}>ENDS</span><div className="flex flex-wrap items-center gap-1.5">
            {([["never", "NEVER"], ["1", "24 H"], ["7", "7 DAYS"], ["30", "30 DAYS"], ["date", "DATE"]] as const).map(([e, l]) => <button key={e} type="button" aria-pressed={v.end === e} onClick={() => setV({ ...v, end: e })} className={`${btn} ${v.end === e ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}
            {v.end === "date" && <input type="date" aria-label="End date" value={v.date} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} onChange={(e) => setV({ ...v, date: e.target.value })} className={`${inp} w-[150px]`} />}</div></div></div>
        <span className={lbl}>COMMAND CENTRE PAGES</span>
        <div className="grid grid-cols-2 gap-2 text-[12.5px] lg:grid-cols-4">{PAGES.map(([key, l]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={v.keys.includes(key)} onChange={(e) => setV({ ...v, keys: e.target.checked ? [...v.keys, key] : v.keys.filter((x) => x !== key) })} />{l}</label>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-[10px] tracking-[1.5px] text-dim">PRESETS:</span>{PRESETS.map(([l, ks]) => <button key={l} type="button" onClick={() => setV({ ...v, keys: ks })} className={`${btn} border-cyan/20 text-[#c6d0da]`}>{l}</button>)}</div>
        <label htmlFor="hcR" className={lbl}>REASON (AUDIT LOG)</label><input id="hcR" maxLength={200} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={inp} placeholder="e.g. Covering S-3 while on LOA" />
        <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.notify} onChange={(e) => setV({ ...v, notify: e.target.checked })} /> Tell them (Hub + website alert)</label>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setV(null)} className={`${btn} border-white/20 text-dim`}>CANCEL</button>
          <button type="button" disabled={!ok || busy} onClick={() => void save()} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>{busy ? "SAVING…" : "SAVE ACCESS"}</button></div>
      </section>}

      <div className="mt-4 grid gap-3 lg:grid-cols-3 text-[12px] text-[#aeb9c4]">
        <div className="border border-cyan/15 bg-panel p-3"><b className="mb-1 block text-[10.5px] tracking-[2px] text-cyan">INSTANT</b>Changes apply on their next page load on the website and every Hub. No sign-out needed.</div>
        <div className="border border-cyan/15 bg-panel p-3"><b className="mb-1 block text-[10.5px] tracking-[2px] text-cyan">TIME LIMIT</b>Access ends by itself on the date. They get an alert 24 h before.</div>
        <div className="border border-cyan/15 bg-panel p-3"><b className="mb-1 block text-[10.5px] tracking-[2px] text-cyan">ALWAYS</b>Commander and Developer always see everything. Only they can change this page.</div></div>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
