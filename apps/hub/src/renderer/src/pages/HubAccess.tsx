import { useCallback, useEffect, useState } from "react";
import type { HubAccessData } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * SECURITY → HUB ACCESS in the app (release v0.1, approved mock 2026-11-11). Same data + rules as the website page.
 * Commander: approve / deny requests, give, revoke (instant sign-out everywhere), restore, quick-add a role. Developer: view only.
 */
const ROLE: Record<string, string> = { commander: "Commander", developer: "Developer", officer: "Officer", staff_nco: "Staff NCO", nco: "NCO", recruiter: "Recruiter" };
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const col = (u: string) => COLS[[...u].reduce((s, c) => s + c.charCodeAt(0), 0) % COLS.length]!;
const ini = (n: string) => (n.replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
const day = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : "");
const ago = (iso: string) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 5 ? "active now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const ST: Record<string, [string, string]> = { always: ["★ ALWAYS", "#c9a227"], granted: ["✓ ACCESS", "#22e07a"], revoked: ["✕ REVOKED", "#ff4d4d"], requested: ["✋ ASKED", "#f59e0b"], denied: ["DECLINED", "#7d8a99"], none: ["NO ACCESS", "#4b5765"] };

export function HubAccess() {
  const [d, setD] = useState<HubAccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [why, setWhy] = useState<{ uid: string; name: string; action: "revoke" | "deny" } | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => { try { const r = await window.cn.hub.hubAccess(); if (!r || "error" in r) setError(r?.error ?? "No answer"); else { setD(r); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "hub_access" || x === "users") { clearTimeout(t); t = setTimeout(() => void load(), 400); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const act = async (b: Record<string, unknown>) => { setBusy(true); const r = await window.cn.hub.hubAccessAction(b); setBusy(false); setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]); void load(); return !r.error; };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const can = d.canManage;
  const reqs = d.people.filter((p) => p.status === "requested");
  const list = d.people.filter((p) => (f === "all" || (f === "access" ? p.status === "granted" || p.status === "always" : p.status === f)) && p.name.toLowerCase().includes(q.toLowerCase()));
  const Av = ({ p }: { p: HubAccessData["people"][number] }) => p.photo ? <img src={p.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" /> : <i className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[9.5px] font-bold not-italic text-black" style={{ background: col(p.uid) }}>{ini(p.name)}</i>;
  const chip = (k: string, l: string) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)} className={`border px-2.5 py-1 text-[10.5px] tracking-[1.5px] ${f === k ? "border-cyan text-cyan" : "border-cyan/15 text-dim hover:text-white"}`}>{l}</button>;
  const sb = "border px-2.5 py-1 text-[10px] tracking-[1.5px] disabled:opacity-40";
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Hub Access">
      <div className="flex items-center gap-3 border-b border-cyan/15 pb-3"><div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">🔑 HUB ACCESS</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-amber">★ {can ? "COMMANDER" : "VIEW ONLY — THE COMMANDER CHANGES THIS"} · WHO MAY DOWNLOAD AND SIGN IN TO THE COMMAND NETWORK APP</p></div></div>
      <div className="my-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {([[d.stats.access, "HAVE ACCESS", "#22e07a"], [d.stats.requests, "REQUESTS WAITING", "#f59e0b"], [d.stats.online, "USING THE HUB NOW", "#00d9ff"], [d.stats.revoked, "REVOKED", "#ff4d4d"]] as const).map(([v, l, c]) =>
          <div key={l} className="tile border border-cyan/15 bg-panel px-3.5 py-2.5"><b className="block font-head text-[24px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>)}
      </div>
      {reqs.length > 0 && <section className="mb-3.5 border border-amber/40 bg-amber/5" aria-label="Requests waiting">
        <div className="border-b border-amber/20 px-3 py-1.5 font-head text-[12px] font-bold tracking-[2.5px] text-amber">✋ REQUESTS WAITING · {reqs.length}</div>
        {reqs.map((p) => <div key={p.uid} className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2 text-[12.5px] last:border-0"><Av p={p} />
          <div className="min-w-0 flex-1"><b className="font-normal text-white">{p.name}</b><small className="block text-[10.5px] text-dim">{ROLE[p.role] ?? p.role} · {p.note ? `“${p.note}”` : "no reason given"} · {day(p.requestAtISO)}</small></div>
          {can && <><button type="button" disabled={busy} onClick={() => void act({ action: "approve", uid: p.uid })} className={`${sb} border-ok/50 text-ok`}>✓ APPROVE</button>
            <button type="button" disabled={busy} onClick={() => { setWhy({ uid: p.uid, name: p.name, action: "deny" }); setReason(""); }} className={`${sb} border-cyan/25 text-white`}>DENY</button></>}</div>)}
      </section>}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Find a member…" aria-label="Find a member" className="mr-1 min-w-[200px] flex-1 border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
        {chip("all", "ALL")}{chip("access", "HAS ACCESS")}{chip("revoked", "REVOKED")}{chip("none", "NO ACCESS")}
        {can && <><span className="ml-2 text-[10px] tracking-[1.5px] text-dim">QUICK:</span>
          {([["officer", "ALL OFFICERS"], ["staff_nco", "ALL STAFF NCOs"]] as const).map(([r, l]) => <button key={r} type="button" disabled={busy}
            onClick={async () => { if (await askBox(`GIVE HUB ACCESS TO ${l}?\n\nAnyone with that role who doesn't have access yet gets it (revoked people are skipped). They get a 🔔 alert.`)) void act({ action: "bulk", role: r }); }}
            className="border border-cyan/15 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-dim hover:text-white">＋ {l}</button>)}</>}
      </div>
      <table className="w-full border-collapse border border-cyan/15 bg-panel text-[12.5px]"><thead><tr className="text-[9.5px] tracking-[2px] text-dim">{["MEMBER", "ACCESS", "GIVEN / CHANGED BY", "DEVICES", ""].map((h, i) => <th key={i} className="border-b border-cyan/15 px-3.5 py-2 text-left font-normal">{h}</th>)}</tr></thead>
        <tbody>{list.map((p) => { const [l, c] = ST[p.status] ?? ST.none!; return (
          <tr key={p.uid} className={`rrow border-b border-white/5 ${p.status === "revoked" ? "opacity-60" : ""}`}>
            <td className="px-3.5 py-2"><div className="flex items-center gap-2.5"><Av p={p} /><div><b className="font-normal text-white">{p.name}</b><small className="block text-[10.5px] text-dim">{ROLE[p.role] ?? p.role}</small></div></div></td>
            <td className="px-3.5"><span className="border px-1.5 text-[9.5px] tracking-[1.5px]" style={{ color: c, borderColor: `${c}66` }}>{l}</span></td>
            <td className="px-3.5 text-[#c6d0da]">{p.always ? "—" : p.byName ? <>{p.byName} · {day(p.atISO)}{p.reason && <small className="block text-[10.5px] text-dim">“{p.reason}”</small>}</> : "—"}</td>
            <td className="px-3.5 text-[#c6d0da]">{p.devices ? `${p.devices} · ${ago(p.lastUsedISO)}` : p.status === "granted" || p.status === "always" ? <span className="text-dim">not installed yet</span> : "—"}</td>
            <td className="px-3.5 text-right">{can && !p.always && (p.status === "granted" ? <button type="button" disabled={busy} onClick={() => { setWhy({ uid: p.uid, name: p.name, action: "revoke" }); setReason(""); }} className={`${sb} border-bad/50 text-bad`}>REVOKE</button>
              : p.status === "revoked" ? <button type="button" disabled={busy} onClick={() => void act({ action: "restore", uid: p.uid })} className={`${sb} border-cyan/30 text-white`}>RESTORE</button>
              : <button type="button" disabled={busy} onClick={() => void act({ action: "give", uid: p.uid })} className={`${sb} border-cyan/40 text-cyan`}>＋ GIVE ACCESS</button>)}</td>
          </tr>); })}
          {!list.length && <tr><td colSpan={5} className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NO ONE MATCHES</td></tr>}</tbody></table>
      <div className="mt-3.5 grid gap-2.5 lg:grid-cols-3">{[["REVOKE = INSTANT", "Their Hub signs out on every PC within seconds, the download card locks, and they can't sign in again. A reason is required and goes in the Audit Log."],
        ["ALWAYS", "Commander and Developer always have access and can't be revoked here."], ["POLICY", "Everyone must accept the 505th Software Use Policy in the app before they can use it."]].map(([t, x]) =>
        <div key={t} className="border border-cyan/15 bg-panel px-3 py-2.5 text-[12px] text-[#aeb9c4]"><b className="mb-0.5 block text-[10.5px] tracking-[2px] text-cyan">{t}</b>{x}</div>)}</div>
      {why && <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setWhy(null)}>
        <div role="dialog" aria-modal="true" aria-label={why.action === "revoke" ? "Revoke access" : "Decline request"} className="cfm-pop w-[440px] border bg-panel" style={{ borderColor: why.action === "revoke" ? "#ff4d4d" : "#f59e0b" }}>
          <div className="px-4 pb-1 pt-4"><b className="font-head text-[15px] tracking-[2.5px] text-white">{why.action === "revoke" ? `⛔ REVOKE — ${why.name.toUpperCase()}?` : `DECLINE ${why.name.toUpperCase()}?`}</b>
            <p className="mb-2 mt-1 text-[12px] text-[#aeb9c4]">{why.action === "revoke" ? "They are signed out of the Hub on every PC straight away and can't sign in again." : "They get a 🔔 alert. They can ask again later."}</p>
            <label htmlFor="ha-why" className="mb-1 block text-[9.5px] tracking-[2px] text-dim">{why.action === "revoke" ? "REASON (GOES IN THE AUDIT LOG)" : "REASON (OPTIONAL — THEY SEE IT)"}</label>
            <textarea id="ha-why" autoFocus rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full resize-none border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" /></div>
          <div className="mt-2 flex justify-end gap-2 border-t border-cyan/10 bg-[#080b10] px-4 py-3">
            <button type="button" onClick={() => setWhy(null)} className="border border-cyan/25 px-3 py-1.5 text-[11px] tracking-[1.5px] text-white">CANCEL</button>
            <button type="button" disabled={busy || (why.action === "revoke" && reason.trim().length < 3)} onClick={async () => { if (await act({ action: why.action, uid: why.uid, reason })) setWhy(null); }}
              className={`border px-3.5 py-1.5 text-[11px] tracking-[2px] disabled:opacity-40 ${why.action === "revoke" ? "border-bad bg-bad/15 text-bad" : "border-amber bg-amber/10 text-amber"}`}>{why.action === "revoke" ? "⛔ REVOKE" : "DECLINE"}</button></div>
        </div></div>}
      {toast && <div role="status" className={`fixed bottom-3 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
