import { useCallback, useEffect, useMemo, useState } from "react";
import type { CcChannel } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * CORTANA COMMAND → MODERATION (same as the website page). Warn / Timeout: "modw" · Kick / Ban: "modk".
 * Cortana does it in Discord, makes a numbered case, posts the Mod Log and the Audit Log, and refuses anyone your rank or higher.
 * 3 active warnings in 30 days → automatic 24 h timeout. PURGE: 1–100 messages in a channel (everyone / one member / bots).
 */
type Case = { id: string; number?: number; discordId: string; targetName: string; action: string; reason: string; note?: string; byName: string; atISO: string; active?: boolean; untilISO?: string };
type Purge = { id: string; channelName?: string; deleted?: number; asked?: number; mode?: string; memberName?: string; reason?: string; byName?: string; atISO?: string };
type D = { members: { id: string; discordId: string; name: string }[]; cases: Case[]; purges: Purge[]; channels: CcChannel[]; canWarn: boolean; canKick: boolean };
const ACT: Record<string, [string, string, "w" | "k"]> = { warn: ["⚠ WARN", "#f59e0b", "w"], timeout: ["⏱ TIMEOUT", "#00D9FF", "w"], kick: ["👢 KICK", "#ff8a3d", "k"], ban: ["⛔ BAN", "#ff4d4d", "k"] };
const LENGTHS: [number, string][] = [[10, "10 min"], [60, "1 hour"], [360, "6 hours"], [1440, "1 day"], [10080, "1 week"], [40320, "28 days"]];
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function Moderation() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"act" | "cases" | "purge">("act");
  const [v, setV] = useState({ discordId: "", kind: "warn", reason: "", note: "", minutes: 60, deleteDays: 0, dm: true });
  const [pv, setPv] = useState({ channelId: "", amount: 20, mode: "all", memberId: "", keepPinned: true, reason: "" });
  const [q, setQ] = useState(""), [cf, setCf] = useState<"active" | "all">("active");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => { try { const r = await window.cn.hub.cc("mod"); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as D); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if ((x === "mod_cases" || x === "mod_purges") && document.documentElement.dataset.page === "panel-mod") { clearTimeout(t); t = setTimeout(() => void load(), 500); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (d && !d.canWarn && d.canKick && (v.kind === "warn" || v.kind === "timeout")) setV((o) => ({ ...o, kind: "kick" })); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  const run = async (body: Record<string, unknown>) => { setBusy(true); const r = await window.cn.hub.ccAction({ part: "mod", ...body }); setBusy(false); setToast(r.error ? [r.error.toUpperCase(), false] : [String(r.msg).toUpperCase(), !r.queued]); void load(); return !r.error; };
  const found = useMemo(() => (d?.members ?? []).filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40), [d, q]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const ok = (k: string) => (ACT[k]![2] === "w" ? d.canWarn : d.canKick);
  const target = d.members.find((m) => m.discordId === v.discordId);
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim", inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const cases = d.cases.filter((c) => cf === "all" || c.active);
  const groups = [...new Set(d.channels.map((c) => c.parentName || "NO CATEGORY"))];
  const doAct = async () => {
    if (!target) return setToast(["PICK A MEMBER", false]);
    if (v.reason.trim().length < 3) return setToast(["A REASON IS NEEDED", false]);
    if (!(await askBox(`${ACT[v.kind]![0]} ${target.name}?${v.kind === "timeout" ? ` (${LENGTHS.find(([m]) => m === v.minutes)?.[1]})` : ""}\nReason: ${v.reason}`, { tone: v.kind === "ban" || v.kind === "kick" ? "danger" : "warn", go: ACT[v.kind]![0].slice(2) }))) return;
    if (await run({ action: "action", kind: v.kind, discordId: v.discordId, reason: v.reason, note: v.note, minutes: v.minutes, deleteDays: v.deleteDays, dm: v.dm })) setV((o) => ({ ...o, reason: "", note: "" }));
  };
  const doPurge = async () => {
    if (!pv.channelId) return setToast(["PICK A CHANNEL", false]);
    if (pv.reason.trim().length < 3) return setToast(["A REASON IS NEEDED", false]);
    const ch = d.channels.find((c) => c.id === pv.channelId)?.name;
    if (!(await askBox(`Delete the last ${pv.amount} ${pv.mode === "bots" ? "bot " : pv.mode === "member" ? "of that member's " : ""}messages in #${ch}?`, { tone: "danger", go: "PURGE", typeToConfirm: "PURGE" }))) return;
    if (await run({ action: "purge", ...pv })) setPv((o) => ({ ...o, reason: "" }));
  };

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Moderation">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⛨ MODERATION</h1>
      <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">CORTANA DOES IT IN DISCORD · NUMBERED CASE · MOD LOG + AUDIT LOG · NOBODY YOUR RANK OR HIGHER</p>
      <div className="my-3.5 flex gap-1.5" role="tablist">{([["act", "TAKE ACTION"], ["cases", `CASES (${d.cases.filter((c) => c.active).length} ACTIVE)`], ...(d.canWarn ? [["purge", "PURGE MESSAGES"]] : [])] as [typeof tab, string][]).map(([k, l]) =>
        <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${btn} ${tab === k ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>

      {tab === "act" && <section className="max-w-[720px] border border-cyan/15 bg-panel p-4">
        <span className={lbl} style={{ marginTop: 0 }}>ACTION</span>
        <div className="flex flex-wrap gap-1.5">{Object.entries(ACT).filter(([k]) => ok(k)).map(([k, [l, c]]) =>
          <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => setV({ ...v, kind: k })} className={btn} style={v.kind === k ? { color: c, borderColor: c, background: `${c}1a` } : { color: "#7d8a99", borderColor: "#ffffff22" }}>{l}</button>)}</div>
        <label htmlFor="mdQ" className={lbl}>MEMBER</label>
        <input id="mdQ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className={inp} />
        <div className="mt-1 max-h-[160px] overflow-auto border border-white/10">{found.map((m) =>
          <button key={m.id} type="button" onClick={() => setV({ ...v, discordId: m.discordId })} className={`block w-full px-2.5 py-1.5 text-left text-[12.5px] ${v.discordId === m.discordId ? "bg-cyan/15 text-white" : "text-[#c6d0da] hover:bg-cyan/5"}`}>{m.name}</button>)}
          {!found.length && <p className="m-0 p-2 text-[11px] text-dimmer">No members match.</p>}</div>
        {v.kind === "timeout" && <><span className={lbl}>LENGTH</span><div className="flex flex-wrap gap-1.5">{LENGTHS.map(([m, l]) => <button key={m} type="button" aria-pressed={v.minutes === m} onClick={() => setV({ ...v, minutes: m })} className={`${btn} ${v.minutes === m ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div></>}
        {v.kind === "ban" && <><label htmlFor="mdDd" className={lbl}>DELETE THEIR MESSAGES FROM THE LAST</label><select id="mdDd" value={v.deleteDays} onChange={(e) => setV({ ...v, deleteDays: Number(e.target.value) })} className={inp}>{[0, 1, 7].map((n) => <option key={n} value={n}>{n ? `${n} day${n > 1 ? "s" : ""}` : "Don't delete"}</option>)}</select></>}
        <label htmlFor="mdR" className={lbl}>REASON (REQUIRED — THEY SEE IT IF DMED)</label><textarea id="mdR" rows={2} maxLength={500} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} className={inp} />
        <label htmlFor="mdN" className={lbl}>STAFF NOTE (PRIVATE)</label><input id="mdN" maxLength={500} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={inp} />
        <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.dm} onChange={(e) => setV({ ...v, dm: e.target.checked })} /> Send them a DM with the reason</label>
        <div className="mt-4 flex items-center gap-3"><span className="flex-1 text-[11px] text-dim">{target ? `→ ${target.name}` : "Pick a member"}</span>
          <button type="button" disabled={busy || !target} onClick={() => void doAct()} className={btn} style={{ color: ACT[v.kind]![1], borderColor: ACT[v.kind]![1] }}>{busy ? "WORKING…" : ACT[v.kind]![0]}</button></div>
      </section>}

      {tab === "cases" && <section className="border border-cyan/15 bg-panel">
        <div className="flex gap-1.5 border-b border-white/5 p-2.5">{(["active", "all"] as const).map((k) => <button key={k} type="button" aria-pressed={cf === k} onClick={() => setCf(k)} className={`${btn} ${cf === k ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{k.toUpperCase()}</button>)}</div>
        {!cases.length && <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NO CASES</p>}
        {cases.map((c) => { const [l, col] = ACT[c.action] ?? [c.action, "#7d8a99"]; return (
          <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-[12.5px]">
            <span className="w-12 text-[11px] text-dim">#{c.number ?? "—"}</span><b className="w-[100px] text-[11px] tracking-[1px]" style={{ color: col }}>{l}</b>
            <span className="min-w-0 flex-1"><b className="text-white">{c.targetName}</b> <span className="text-dim">· {c.reason}</span><small className="block text-[10.5px] text-dimmer">by {c.byName} · {when(c.atISO)}{c.active ? " · ACTIVE" : ""}</small></span>
            {c.active && c.action !== "kick" && (c.action !== "ban" || d.canKick) && <button type="button" disabled={busy} onClick={async () => { if (await askBox(`${c.action === "ban" ? "Unban" : c.action === "timeout" ? "End timeout for" : "Remove warning for"} ${c.targetName}?`, { tone: "warn" })) void run({ action: "lift", caseId: c.id }); }} className={`${btn} border-cyan/30 text-cyan`}>{c.action === "ban" ? "UNBAN" : c.action === "timeout" ? "END TIMEOUT" : "REMOVE"}</button>}
            <button type="button" disabled={busy} aria-label={`Delete case ${c.number}`} onClick={async () => { if (await askBox(`Delete case #${c.number}? This doesn't undo the action.`, { tone: "danger", go: "DELETE" })) void run({ action: "delete", caseId: c.id }); }} className={`${btn} border-bad/40 text-bad`}>🗑</button>
          </div>); })}
      </section>}

      {tab === "purge" && <div className="grid gap-4 xl:grid-cols-2"><section className="border border-cyan/15 bg-panel p-4">
        <label htmlFor="pgCh" className={lbl} style={{ marginTop: 0 }}>CHANNEL</label>
        <select id="pgCh" value={pv.channelId} onChange={(e) => setPv({ ...pv, channelId: e.target.value })} className={inp}><option value="">— pick a channel —</option>
          {groups.map((g) => <optgroup key={g} label={g.toUpperCase()}>{d.channels.filter((c) => (c.parentName || "NO CATEGORY") === g).map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}</optgroup>)}</select>
        <label htmlFor="pgN" className={lbl}>HOW MANY (1–100)</label><input id="pgN" type="number" min={1} max={100} value={pv.amount} onChange={(e) => setPv({ ...pv, amount: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} className={inp} />
        <span className={lbl}>WHOSE MESSAGES</span><div className="flex gap-1.5">{([["all", "EVERYONE"], ["member", "ONE MEMBER"], ["bots", "BOTS"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={pv.mode === k} onClick={() => setPv({ ...pv, mode: k })} className={`${btn} ${pv.mode === k ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>
        {pv.mode === "member" && <select aria-label="Member" value={pv.memberId} onChange={(e) => setPv({ ...pv, memberId: e.target.value })} className={`${inp} mt-2`}><option value="">— pick a member —</option>{d.members.map((m) => <option key={m.id} value={m.discordId}>{m.name}</option>)}</select>}
        <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={pv.keepPinned} onChange={(e) => setPv({ ...pv, keepPinned: e.target.checked })} /> Keep pinned messages</label>
        <label htmlFor="pgR" className={lbl}>REASON (REQUIRED)</label><input id="pgR" maxLength={300} value={pv.reason} onChange={(e) => setPv({ ...pv, reason: e.target.value })} className={inp} />
        <div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={() => void doPurge()} className={`${btn} border-bad/60 text-bad`}>{busy ? "WORKING…" : "🧹 PURGE"}</button></div>
        <p className="mt-2 text-[10.5px] text-dim">Discord can't bulk-delete messages older than 14 days — those are skipped.</p>
      </section>
      <section className="border border-cyan/15 bg-panel"><h3 className="m-0 border-b border-white/5 px-3.5 py-2.5 text-[10px] tracking-[3px] text-[#9cbf4a]">RECENT PURGES</h3>
        {!d.purges.length && <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NONE YET</p>}
        {d.purges.map((p) => <div key={p.id} className="border-b border-white/5 px-3.5 py-2 text-[12.5px]"><b className="text-white">#{p.channelName}</b> <span className="text-dim">· {p.deleted ?? 0}/{p.asked ?? 0} · {p.mode === "member" ? p.memberName : p.mode}</span><small className="block text-[10.5px] text-dimmer">{p.reason} · by {p.byName} · {when(p.atISO)}</small></div>)}
      </section></div>}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
