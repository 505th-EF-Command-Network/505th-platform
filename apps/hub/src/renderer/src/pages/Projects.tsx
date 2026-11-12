import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjData, Proj, ProjTask } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * WORKSPACE → PROJECTS v2 in the app (approved mock 2026-11-11). Same data + rules as the website (lib/projects/core.ts).
 * Card wall → open a project: cover, description, tasks (+ sub-tasks, assignee, due), images, discussion (@ tags), team, activity.
 * Private (owner only) or Invite only. Owner / Editor / Viewer. Alerts in the Hub + Terminal — no Discord DMs.
 */
const PRI = { high: ["▲ HIGH", "#ff4d4d"], med: ["■ MED", "#f59e0b"], low: ["▼ LOW", "#7d8a99"] } as const;
const STAT = { planning: ["PLANNING", "#00d9ff"], active: ["ACTIVE", "#22e07a"], hold: ["ON HOLD", "#f59e0b"], done: ["DONE", "#7d8a99"] } as const;
const ROLE = { owner: ["OWNER", "#c9a227"], editor: ["EDITOR", "#00d9ff"], viewer: ["VIEWER", "#7d8a99"], pending: ["PENDING", "#f59e0b"] } as const;
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const day = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase() : "");
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "now" : m < 60 ? `${m} m` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const ini = (n: string) => (n.replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
const pct = (p: Proj) => { const t = p.tasks.filter((x) => !x.parent); return t.length ? Math.round((t.filter((x) => x.done).length / t.length) * 100) : p.status === "done" ? 100 : 0; };
const bg = (p: Proj) => (p.cover ? `url("${p.cover}") center/cover` : "linear-gradient(135deg,#0b3a52,#071a26)");

export function Projects() {
  const [d, setD] = useState<ProjData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Proj> | null>(null);
  const [invite, setInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => {
    try { const r = await window.cn.hub.projects(); if (!r || "error" in r) setError(r?.error ?? "No answer from the app — restart it"); else { setD(r); setError(null); } }
    catch { setError("This page needs an app restart (close and run npm run hub again)"); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "projects_v2") { clearTimeout(t); t = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  const run = async (body: Record<string, unknown>, quiet = false) => {
    setBusy(true);
    const r = await window.cn.hub.projectsAction(body);
    setBusy(false);
    if (r.error) setToast([r.error, false]); else if (!quiet) setToast([String(r.msg).toUpperCase(), true]);
    await load();
    return r;
  };
  const name = useCallback((uid: string) => d?.people.find((x) => x.uid === uid)?.name ?? "Unknown", [d]);
  const col = (uid: string) => COLS[[...uid].reduce((s, c) => s + c.charCodeAt(0), 0) % COLS.length]!;

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const cur = d.projects.find((p) => p.id === open);
  const Av = ({ uid, s = 24 }: { uid: string; s?: number }) => <i title={name(uid)} className="grid shrink-0 place-items-center rounded-full font-bold not-italic text-black" style={{ width: s, height: s, fontSize: s * 0.36, background: col(uid) }}>{ini(name(uid))}</i>;
  const btn = "border border-cyan/30 px-3 py-1.5 text-[10.5px] tracking-[1.5px] text-white hover:bg-cyan/10 disabled:opacity-40";
  const go = "border border-cyan bg-cyan/10 px-3.5 py-1.5 text-[11px] tracking-[2px] text-cyan disabled:opacity-40";

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Projects">
      {!cur ? <Wall d={d} filter={filter} setFilter={setFilter} q={q} setQ={setQ} onOpen={setOpen} onNew={() => setForm({ privacy: "invite", priority: "med", status: "planning", category: "Operations" })} Av={Av} />
        : <Detail p={cur} d={d} busy={busy} run={run} name={name} Av={Av} btn={btn} go={go} onBack={() => setOpen(null)} onEdit={() => setForm(cur)} onInvite={() => setInvite(true)} setToast={setToast} />}
      {form && <ProjForm p={form} cats={d.categories} busy={busy} btn={btn} go={go} onClose={() => setForm(null)}
        onSave={async (v) => { const r = await run(form.id ? { action: "update", id: form.id, ...v } : { action: "create", ...v }); if (!r.error) { setForm(null); if (r.id) setOpen(r.id); } }} setToast={setToast} />}
      {invite && cur && <Invite p={cur} d={d} busy={busy} btn={btn} go={go} Av={Av} onClose={() => setInvite(false)}
        onSend={async (invites, message) => { const r = await run({ action: "invite", id: cur.id, invites, message }); if (!r.error) setInvite(false); }} />}
      {toast && <div role="status" className={`fixed bottom-3 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

type AvT = (p: { uid: string; s?: number }) => React.JSX.Element;

function Wall(p: { d: ProjData; filter: string; setFilter: (f: string) => void; q: string; setQ: (s: string) => void; onOpen: (id: string) => void; onNew: () => void; Av: AvT }) {
  const { d } = p;
  const t = today();
  const live = d.projects.filter((x) => x.myRole !== "pending");
  const allTasks = live.flatMap((x) => x.tasks);
  const week = new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const invites = d.projects.filter((x) => x.myRole === "pending");
  const list = d.projects.filter((x) => (p.filter === "all" ? x.myRole !== "pending" : p.filter === "mine" ? x.myRole === "owner" : p.filter === "invited" ? x.myRole !== "owner" : x.status === p.filter && x.myRole !== "pending")
    && (x.title + " " + x.description).toLowerCase().includes(p.q.toLowerCase()));
  const chip = (k: string, l: string) => <button key={k} type="button" aria-pressed={p.filter === k} onClick={() => p.setFilter(k)} className={`border px-2.5 py-1 text-[10.5px] tracking-[1.5px] ${p.filter === k ? "border-cyan text-cyan" : "border-cyan/15 text-dim hover:text-white"}`}>{l}</button>;
  return <>
    <div className="flex items-end gap-3"><div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">PROJECTS</h1><p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">PRIVATE OR INVITE ONLY · TASKS, IMAGES AND DISCUSSION IN ONE PLACE</p></div>
      <div className="flex-1" /><button type="button" onClick={p.onNew} className="border border-gold bg-gold/15 px-4 py-2 text-[11px] tracking-[2px] text-gold">＋ NEW PROJECT</button></div>
    <div className="my-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {([[live.filter((x) => x.status !== "done").length, "ACTIVE PROJECTS", "#00d9ff"], [allTasks.filter((x) => !x.done && x.due && x.due >= t && x.due <= week).length, "TASKS DUE THIS WEEK", "#f59e0b"],
        [allTasks.filter((x) => !x.done && x.due && x.due < t).length, "OVERDUE", "#ff4d4d"], [allTasks.filter((x) => !x.done && x.assigneeUid === d.me).length, "MY OPEN TASKS", "#22e07a"]] as const).map(([v, l, c]) => (
        <div key={l} className="tile border border-cyan/15 bg-panel px-3.5 py-2.5"><b className="block font-head text-[24px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>))}
    </div>
    {invites.map((x) => <InviteBanner key={x.id} p={x} by={d.people.find((u) => u.uid === x.members.find((m) => m.uid === d.me)?.invitedBy)?.name ?? "Someone"} />)}
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <input value={p.q} onChange={(e) => p.setQ(e.target.value)} placeholder="🔍 Find a project…" aria-label="Find a project" className="mr-1 min-w-[220px] flex-1 border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
      {chip("all", "ALL")}{chip("mine", "MINE")}{chip("invited", "INVITED TO")}{chip("active", "ACTIVE")}{chip("planning", "PLANNING")}{chip("hold", "ON HOLD")}{chip("done", "DONE")}
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
      {list.map((x) => { const pc = pct(x), late = x.tasks.filter((k) => !k.done && k.due && k.due < t).length; const ppl = [x.ownerUid, ...x.members.filter((m) => m.status === "active").map((m) => m.uid)];
        return (
        <button key={x.id} type="button" onClick={() => p.onOpen(x.id)} className="tile group overflow-hidden border border-cyan/15 bg-panel text-left transition hover:-translate-y-0.5 hover:border-cyan hover:shadow-[0_0_22px_-6px_var(--color-cyan)]">
          <div className="relative h-[120px]" style={{ background: bg(x) }}><div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-panel" />
            <span className="absolute left-2 top-2 border bg-black/60 px-1.5 text-[9.5px] tracking-[1.5px]" style={{ color: STAT[x.status][1], borderColor: STAT[x.status][1] }}>● {STAT[x.status][0]}</span>
            <span className="absolute right-2 top-2 bg-black/60 px-1.5 text-[9.5px] tracking-[1.5px]" style={{ color: PRI[x.priority][1] }}>{PRI[x.priority][0]}</span>
            {x.privacy === "private" && <span className="absolute bottom-2 right-2 bg-black/60 px-1.5 text-[9.5px] tracking-[1.5px] text-dim">🔒 PRIVATE</span>}</div>
          <div className="px-3.5 pb-3.5 pt-1"><h3 className="m-0 truncate font-head text-[17px] font-bold tracking-[1.5px] text-white">{x.title.toUpperCase()}</h3>
            <p className="mb-2.5 mt-1 line-clamp-2 h-[36px] text-[12px] text-dim">{x.description || "No description yet."}</p>
            <div className="h-[5px] bg-white/5"><i className="block h-full" style={{ width: `${pc}%`, background: "linear-gradient(90deg,#00d9ff,#22e07a)" }} /></div>
            <div className="mt-2 flex justify-between text-[11px] text-dim"><span>{pc}% · {x.tasks.filter((k) => !k.parent && k.done).length}/{x.tasks.filter((k) => !k.parent).length} tasks</span>
              {late ? <span className="text-bad">⚠ {late} OVERDUE</span> : x.deadline ? <span className={x.deadline < t ? "text-bad" : "text-amber"}>⏰ {day(x.deadline)}</span> : null}</div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-dim"><span className="flex">{ppl.slice(0, 4).map((u, i) => <span key={u} className={i ? "-ml-1.5" : ""}><p.Av uid={u} /></span>)}{ppl.length > 4 && <span className="-ml-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#1d2733] text-[9px] text-white">+{ppl.length - 4}</span>}</span>
              <span>💬 {x.comments.length} · 🖼 {x.images.length}</span></div></div>
        </button>); })}
      <button type="button" onClick={p.onNew} className="grid min-h-[250px] place-items-center border border-dashed border-cyan/20 text-[12px] tracking-[2px] text-dim hover:border-cyan hover:text-cyan">＋ NEW PROJECT</button>
    </div>
  </>;
}

function InviteBanner({ p, by }: { p: Proj; by: string }) {
  const [busy, setBusy] = useState(false);
  const m = p.members.find((x) => x.status === "pending");
  const answer = async (accept: boolean) => { setBusy(true); await window.cn.hub.projectsAction({ action: "respond", id: p.id, accept }); setBusy(false); };
  return <div role="alert" className="mb-2.5 flex items-center gap-3 border border-cyan/40 bg-cyan/5 px-3.5 py-2.5 text-[12.5px]">
    <span className="text-[18px]">👥</span><span className="flex-1"><b className="font-normal text-white">{by}</b> invited you to <b className="font-normal text-cyan">{p.title}</b> as {(m?.role ?? "editor").toUpperCase()}{m?.message ? <span className="text-dim"> — “{m.message}”</span> : null}</span>
    <button type="button" disabled={busy} onClick={() => void answer(false)} className="border border-cyan/25 px-3 py-1 text-[10.5px] tracking-[1.5px] text-dim hover:text-white">DECLINE</button>
    <button type="button" disabled={busy} onClick={() => void answer(true)} className="border border-ok bg-ok/10 px-3 py-1 text-[10.5px] tracking-[1.5px] text-ok">✓ ACCEPT</button></div>;
}

function Detail(p: { p: Proj; d: ProjData; busy: boolean; run: (b: Record<string, unknown>, quiet?: boolean) => Promise<{ error?: string }>; name: (u: string) => string; Av: AvT; btn: string; go: string;
  onBack: () => void; onEdit: () => void; onInvite: () => void; setToast: (t: [string, boolean]) => void }) {
  const x = p.p, t = today(), role = x.myRole;
  const owner = role === "owner", edit = owner || role === "editor";
  const [tf, setTf] = useState("all");
  const [nt, setNt] = useState({ title: "", assigneeUid: "", due: "", parent: "" });
  const [cm, setCm] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [up, setUp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const team = [x.ownerUid, ...x.members.filter((m) => m.status === "active").map((m) => m.uid)];
  const top = x.tasks.filter((k) => !k.parent);
  const show = (k: ProjTask) => tf === "all" || (tf === "mine" ? k.assigneeUid === p.d.me : tf === "open" ? !k.done : k.done);
  const pc = pct(x);
  const days = x.deadline ? Math.round((Date.parse(`${x.deadline}T12:00:00`) - Date.parse(`${t}T12:00:00`)) / 864e5) : null;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUp(true);
    const urls: string[] = [];
    for (const f of [...files].slice(0, 10)) {
      if (!f.type.startsWith("image/") || f.size > 10e6) { p.setToast([`${f.name}: images up to 10 MB only`, false]); continue; }
      const r = await window.cn.hub.upload("505th_projects", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
      if (r.url) urls.push(r.url); else p.setToast([r.error ?? "Upload failed", false]);
    }
    setUp(false);
    if (urls.length) await p.run({ action: "image.add", id: x.id, urls });
  };
  const Task = ({ k, sub }: { k: ProjTask; sub?: boolean }) => {
    const kids = x.tasks.filter((c) => c.parent === k.id);
    const late = !k.done && k.due && k.due < t;
    return <>
      <div className={`group mb-1 flex items-center gap-2.5 border border-white/5 bg-panel2 px-2.5 py-2 hover:border-cyan/25 ${sub ? "ml-7" : ""}`}>
        <button type="button" role="checkbox" aria-checked={k.done} aria-label={k.done ? "Mark not done" : "Mark done"} disabled={!edit || p.busy}
          onClick={() => void p.run({ action: "task.update", id: x.id, taskId: k.id, patch: { done: !k.done } }, true)}
          className={`grid h-4 w-4 shrink-0 place-items-center border text-[11px] ${k.done ? "border-ok bg-ok text-black" : "border-cyan"}`}>{k.done ? "✓" : ""}</button>
        <span className={`flex-1 text-[13px] ${k.done ? "text-dimmer line-through" : "text-white"}`}>{k.title}</span>
        {kids.length > 0 && <small className="text-[10px] text-dim">☑ {kids.filter((c) => c.done).length}/{kids.length}</small>}
        {k.priority === "high" && !k.done && <small className="text-[10px] text-bad">▲</small>}
        {k.due && <span className="border px-1.5 text-[10px]" style={{ color: late ? "#ff4d4d" : k.done ? "#4b5765" : "#f59e0b", borderColor: late ? "#ff4d4d66" : "#f59e0b44" }}>{late ? "⚠ OVERDUE · " : "⏰ "}{day(k.due)}</span>}
        {edit ? <select value={k.assigneeUid} aria-label="Assigned to" onChange={(e) => void p.run({ action: "task.update", id: x.id, taskId: k.id, patch: { assigneeUid: e.target.value } }, true)}
            className="max-w-[120px] border border-transparent bg-transparent text-[10.5px] text-dim hover:border-cyan/25"><option value="">Unassigned</option>{team.map((u) => <option key={u} value={u}>{p.name(u)}</option>)}</select>
          : k.assigneeUid ? <p.Av uid={k.assigneeUid} s={22} /> : null}
        {edit && <button type="button" aria-label="Delete task" onClick={async () => { if (await askBox(`DELETE TASK?\n\n${k.title}${kids.length ? `\n\nIts ${kids.length} sub-task(s) are deleted too.` : ""}`)) void p.run({ action: "task.delete", id: x.id, taskId: k.id }, true); }}
          className="invisible text-[11px] text-dimmer hover:text-bad group-hover:visible">🗑</button>}
      </div>
      {kids.filter(show).map((c) => <Task key={c.id} k={c} sub />)}
    </>;
  };
  return <>
    <button type="button" onClick={p.onBack} className="mb-2.5 text-[11px] tracking-[2px] text-dim hover:text-cyan">← ALL PROJECTS</button>
    <div className="border border-cyan/15 bg-panel">
      <div className="relative h-[190px]" style={{ background: bg(x) }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,#0b0f15f2 30%,#0b0f1566)" }} />
        {owner && <button type="button" onClick={() => file.current?.click()} className="absolute right-3.5 top-3.5 z-10 border border-white/30 bg-black/60 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white">📷 CHANGE COVER</button>}
        <div className="absolute inset-0 z-[1] flex flex-col justify-end px-6 py-5">
          <div className="flex flex-wrap items-center gap-2 text-[9.5px] tracking-[1.5px]"><span className="border bg-black/50 px-1.5" style={{ color: STAT[x.status][1], borderColor: STAT[x.status][1] }}>● {STAT[x.status][0]}</span>
            <span style={{ color: PRI[x.priority][1] }}>{PRI[x.priority][0]}</span><span className="border border-cyan/20 px-1.5 text-dim">{x.category.toUpperCase()}</span><span className="text-dim">{x.privacy === "private" ? "🔒 PRIVATE" : "👥 INVITE ONLY"}</span></div>
          <h2 className="my-1 font-head text-[28px] font-bold tracking-[3px] text-white">{x.title.toUpperCase()}</h2>
          <div className="flex flex-wrap items-center gap-x-3 text-[11.5px] text-dim">Owner <b className="font-normal text-white">{p.name(x.ownerUid)}</b> · Started {day(x.createdAtISO.slice(0, 10))}
            {x.deadline && <>· Deadline <b className={`font-normal ${days! < 0 ? "text-bad" : "text-amber"}`}>{day(x.deadline)} ({days! < 0 ? `${-days!} days late` : `${days} days`})</b></>}
            <span className="ml-auto flex gap-1.5">{owner && <><button type="button" onClick={p.onInvite} className={p.go}>👥 INVITE</button><button type="button" onClick={p.onEdit} className={p.btn}>✎ EDIT</button></>}
              <span className="relative"><button type="button" aria-label="More" aria-expanded={more} onClick={() => setMore(!more)} className={p.btn}>⋯</button>
                {more && <div role="menu" className="absolute right-0 top-9 z-20 w-[200px] border border-cyan/40 bg-panel py-1 shadow-[0_14px_34px_rgba(0,0,0,.6)]">
                  {owner ? <button type="button" role="menuitem" onClick={async () => { setMore(false); if (await askBox(`DELETE PROJECT?\n\n${x.title}\n\nAll tasks, images and comments are removed.`)) { const r = await p.run({ action: "delete", id: x.id }); if (!r.error) p.onBack(); } }} className="block w-full px-3 py-2 text-left text-[12.5px] text-bad hover:bg-bad/10">🗑 Delete project</button>
                    : <button type="button" role="menuitem" onClick={async () => { setMore(false); if (await askBox(`LEAVE PROJECT?\n\n${x.title}\n\nYour tasks become unassigned.`)) { const r = await p.run({ action: "leave", id: x.id }); if (!r.error) p.onBack(); } }} className="block w-full px-3 py-2 text-left text-[12.5px] text-amber hover:bg-amber/10">➖ Leave project</button>}
                </div>}</span></span></div>
        </div>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
        const r = await window.cn.hub.upload("505th_projects", f.name, f.type, new Uint8Array(await f.arrayBuffer())); if (r.url) void p.run({ action: "update", id: x.id, cover: r.url }); else p.setToast([r.error ?? "Upload failed", false]); }} />
      <div className="grid xl:grid-cols-[1fr_310px]">
        <div className="min-w-0 border-cyan/10 px-5 py-4 xl:border-r">
          <H t="DESCRIPTION" s={owner ? <button type="button" onClick={p.onEdit} className="hover:text-cyan">✎ EDIT</button> : null} />
          <p className="m-0 whitespace-pre-wrap text-[13px] text-[#c6d0da]">{x.description || <span className="text-dimmer">No description yet.</span>}</p>
          <H t="TASKS" s={`${top.filter((k) => k.done).length} / ${top.length} DONE`} />
          <div className="mb-2 flex gap-1.5">{(["all", "mine", "open", "done"] as const).map((k) => <button key={k} type="button" aria-pressed={tf === k} onClick={() => setTf(k)} className={`border px-2.5 py-0.5 text-[10px] tracking-[1.5px] ${tf === k ? "border-cyan text-cyan" : "border-cyan/15 text-dim"}`}>{k.toUpperCase()}</button>)}</div>
          {top.filter((k) => show(k) || x.tasks.some((c) => c.parent === k.id && show(c))).map((k) => <Task key={k.id} k={k} />)}
          {!top.length && <p className="py-4 text-center text-[11px] tracking-[2px] text-dimmer">NO TASKS YET</p>}
          {edit && <form className="mt-2 flex flex-wrap gap-1.5" onSubmit={async (e) => { e.preventDefault(); if (!nt.title.trim()) return; const r = await p.run({ action: "task.add", id: x.id, ...nt, parent: nt.parent || null }, true); if (!r.error) setNt({ ...nt, title: "" }); }}>
            <input value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} maxLength={200} placeholder="＋ Add a task…" aria-label="New task" className="min-w-[200px] flex-1 border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
            <select value={nt.assigneeUid} onChange={(e) => setNt({ ...nt, assigneeUid: e.target.value })} aria-label="Assign to" className="border border-cyan/20 bg-[#070a0f] px-2 text-[11.5px] text-white"><option value="">Unassigned</option>{team.map((u) => <option key={u} value={u}>{p.name(u)}</option>)}</select>
            <input type="date" value={nt.due} onChange={(e) => setNt({ ...nt, due: e.target.value })} aria-label="Due date" className="border border-cyan/20 bg-[#070a0f] px-2 text-[11.5px] text-white [color-scheme:dark]" />
            <select value={nt.parent} onChange={(e) => setNt({ ...nt, parent: e.target.value })} aria-label="Sub-task of" className="max-w-[150px] border border-cyan/20 bg-[#070a0f] px-2 text-[11.5px] text-white"><option value="">Main task</option>{top.map((k) => <option key={k.id} value={k.id}>↳ {k.title.slice(0, 30)}</option>)}</select>
            <button type="submit" disabled={p.busy || !nt.title.trim()} className={p.go}>ADD</button></form>}
          <H t="IMAGES" s={`${x.images.length} · ${edit ? "DROP IMAGES HERE OR CLICK ＋" : "VIEW ONLY"}`} />
          <div className="grid grid-cols-4 gap-1.5" onDragOver={(e) => edit && e.preventDefault()} onDrop={(e) => { if (!edit) return; e.preventDefault(); void upload(e.dataTransfer.files); }}>
            {x.images.map((im) => <div key={im.url} className="group relative aspect-[16/10] overflow-hidden border border-cyan/15">
              <a href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt={im.name || "Project image"} loading="lazy" className="h-full w-full object-cover" /></a>
              {edit && <button type="button" aria-label="Remove image" onClick={async () => { if (await askBox("REMOVE IMAGE?\n\nIt is removed from this project.")) void p.run({ action: "image.remove", id: x.id, url: im.url }, true); }}
                className="absolute right-1 top-1 hidden bg-black/70 px-1.5 text-[11px] text-bad group-hover:block">✕</button>}
              {owner && x.cover !== im.url && <button type="button" onClick={() => void p.run({ action: "update", id: x.id, cover: im.url })} className="absolute bottom-1 left-1 hidden bg-black/70 px-1.5 text-[9.5px] tracking-[1px] text-white group-hover:block">SET COVER</button>}</div>)}
            {edit && <label className="grid aspect-[16/10] cursor-pointer place-items-center border border-dashed border-cyan/25 text-[20px] text-dim hover:border-cyan hover:text-cyan">{up ? <span className="text-[10px] tracking-[1.5px]">UPLOADING…</span> : "＋"}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>}
          </div>
          <H t="DISCUSSION" s="TEAM ONLY · TAG SOMEONE TO ALERT THEM" />
          {x.comments.map((c) => <div key={c.id} className="group mb-2.5 flex gap-2.5"><p.Av uid={c.uid} s={28} /><div className="flex-1 border border-white/5 bg-panel2 px-2.5 py-1.5 text-[12.5px]">
            <b className="text-[12px] font-semibold text-cyan">{p.name(c.uid)}</b><small className="ml-1.5 text-[10.5px] text-dimmer">{ago(c.atISO)} ago</small>
            {(owner || c.uid === p.d.me) && <button type="button" aria-label="Delete comment" onClick={() => void p.run({ action: "comment.delete", id: x.id, commentId: c.id }, true)} className="invisible float-right text-[11px] text-dimmer hover:text-bad group-hover:visible">🗑</button>}
            <div className="whitespace-pre-wrap text-[#d6dde6]">{c.text}</div></div></div>)}
          {role !== "pending" && <div className="flex flex-wrap gap-1.5">
            <textarea value={cm} onChange={(e) => setCm(e.target.value)} rows={2} maxLength={2000} placeholder="Write a comment…" aria-label="Comment" className="min-w-[240px] flex-1 resize-none border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
            <div className="flex flex-col gap-1.5">
              <select value="" aria-label="Tag someone" onChange={(e) => { const u = e.target.value; if (!u) return; setTags([...new Set([...tags, u])]); setCm((s) => `${s}${s && !s.endsWith(" ") ? " " : ""}@${p.name(u)} `); }} className="border border-cyan/20 bg-[#070a0f] px-2 py-1 text-[11px] text-dim">
                <option value="">@ TAG</option>{team.filter((u) => u !== p.d.me).map((u) => <option key={u} value={u}>{p.name(u)}</option>)}</select>
              <button type="button" disabled={p.busy || !cm.trim()} onClick={async () => { const r = await p.run({ action: "comment", id: x.id, text: cm, mentions: tags.filter((u) => cm.includes("@" + p.name(u))) }, true); if (!r.error) { setCm(""); setTags([]); } }} className={p.go}>POST</button></div></div>}
        </div>
        <aside className="px-4 py-4">
          <div className="mx-auto mb-2 grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(#22e07a 0 ${pc}%, rgba(255,255,255,.05) 0)` }}><div className="grid h-[78px] w-[78px] place-items-center rounded-full bg-panel font-head text-[24px] font-bold text-white">{pc}%</div></div>
          <div className="mb-3 text-center text-[10px] tracking-[2px] text-dim">DONE · FROM TASKS</div>
          <H t="TEAM" s={owner ? <button type="button" onClick={p.onInvite} className="hover:text-cyan">👥 INVITE</button> : String(team.length)} />
          {[{ uid: x.ownerUid, role: "owner" as const, status: "active" }, ...x.members].map((m) => { const r = m.status === "pending" ? "pending" : m.role; const mine = x.tasks.filter((k) => k.assigneeUid === m.uid);
            return <div key={m.uid} className={`flex items-center gap-2.5 py-1.5 ${m.status === "pending" ? "opacity-60" : ""}`}><p.Av uid={m.uid} s={30} />
              <div className="min-w-0 flex-1 text-[12.5px] text-white"><span className="block truncate">{p.name(m.uid)}</span><small className="block text-[10px] text-dim">{m.status === "pending" ? "invite sent · waiting" : r === "viewer" ? "read only" : `${mine.length} tasks · ${mine.filter((k) => k.done).length} done`}</small></div>
              {owner && m.uid !== x.ownerUid ? <select value={m.status === "pending" ? "x" : m.role} aria-label={`Role for ${p.name(m.uid)}`} onChange={async (e) => {
                  const v = e.target.value; if (v === "remove") { if (await askBox(`REMOVE ${p.name(m.uid).toUpperCase()}?\n\nThey lose access to ${x.title}. Their tasks become unassigned.`)) void p.run({ action: "member", id: x.id, uid: m.uid, remove: true }); }
                  else if (v === "owner") { if (await askBox(`HAND OVER OWNERSHIP?\n\n${p.name(m.uid)} becomes the owner of ${x.title}. You become an editor.`)) void p.run({ action: "transfer", id: x.id, uid: m.uid }); }
                  else void p.run({ action: "member", id: x.id, uid: m.uid, role: v }); }}
                  className="border bg-transparent px-1 text-[9.5px] tracking-[1px]" style={{ color: ROLE[r][1], borderColor: `${ROLE[r][1]}66` }}>
                  {m.status === "pending" ? <option value="x">PENDING</option> : <><option value="editor">EDITOR</option><option value="viewer">VIEWER</option><option value="owner">★ MAKE OWNER</option></>}<option value="remove">✕ REMOVE</option></select>
                : <span className="border px-1.5 text-[9.5px] tracking-[1px]" style={{ color: ROLE[r][1], borderColor: `${ROLE[r][1]}66` }}>{ROLE[r][0]}</span>}</div>; })}
          <H t="DETAILS" />
          {[["Category", x.category], ["Privacy", x.privacy === "private" ? "🔒 Private" : "👥 Invite only"], ["Your role", ROLE[role ?? "viewer"][0]], ["Updated", `${ago(x.updatedAtISO)} ago`]].map(([k, v]) =>
            <div key={k} className="flex justify-between py-1 text-[12px]"><span className="text-dim">{k}</span><b className="font-normal text-white">{v}</b></div>)}
          <H t="ACTIVITY" />
          {[...x.activity].reverse().slice(0, 12).map((a, i) => <div key={i} className="flex gap-2 border-b border-white/5 py-1.5 text-[12px] text-[#aeb9c4]"><i className="w-5 text-center not-italic">{a.icon}</i><span className="flex-1">{a.text}</span><small className="whitespace-nowrap text-dimmer">{ago(a.atISO)}</small></div>)}
        </aside>
      </div>
    </div>
  </>;
}

const H = ({ t, s }: { t: string; s?: React.ReactNode }) => <div className="mb-2 mt-4 flex items-center justify-between font-head text-[13px] font-bold tracking-[3px] text-cyan first:mt-0">{t}{s != null && <small className="font-sans text-[10px] font-normal tracking-[1px] text-dim">{s}</small>}</div>;

function Shell(p: { title: string; onClose: () => void; children: React.ReactNode; foot: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
    <div role="dialog" aria-modal="true" aria-label={p.title} className="cfm-pop max-h-[90vh] w-[560px] max-w-[94vw] overflow-auto border border-cyan bg-panel shadow-[0_18px_50px_rgba(0,0,0,.7),0_0_30px_rgba(0,217,255,.2)]">
      <div className="flex items-center border-b border-cyan/10 px-4 py-3"><b className="font-head text-[17px] tracking-[2.5px] text-white">{p.title}</b><button type="button" aria-label="Close" onClick={p.onClose} className="ml-auto text-dim hover:text-white">✕</button></div>
      <div className="px-4 py-3">{p.children}</div>
      <div className="flex justify-end gap-2 border-t border-cyan/10 bg-[#080b10] px-4 py-3">{p.foot}</div></div></div>;
}

function ProjForm(p: { p: Partial<Proj>; cats: string[]; busy: boolean; btn: string; go: string; onClose: () => void; onSave: (v: Record<string, unknown>) => void; setToast: (t: [string, boolean]) => void }) {
  const [v, setV] = useState({ title: p.p.title ?? "", description: p.p.description ?? "", category: p.p.category ?? "Operations", priority: p.p.priority ?? "med", status: p.p.status ?? "planning", deadline: p.p.deadline ?? "", privacy: p.p.privacy ?? "invite", cover: p.p.cover ?? "" });
  const [up, setUp] = useState(false);
  const fld = "w-full border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-cyan [color-scheme:dark]";
  const lbl = "mb-1 mt-3 block text-[9.5px] tracking-[2px] text-dim";
  return <Shell title={p.p.id ? "✎ EDIT PROJECT" : "＋ NEW PROJECT"} onClose={p.onClose}
    foot={<><button type="button" onClick={p.onClose} className={p.btn}>CANCEL</button><button type="button" disabled={p.busy || up || !v.title.trim()} onClick={() => p.onSave(v)} className={p.go}>{p.p.id ? "SAVE" : "CREATE PROJECT"}</button></>}>
    <label className={`${lbl} mt-0`}>COVER IMAGE</label>
    <label className="relative grid h-[110px] cursor-pointer place-items-center overflow-hidden border border-dashed border-cyan/25 text-[11px] tracking-[1.5px] text-dim hover:border-cyan" style={v.cover ? { background: `url("${v.cover}") center/cover` } : undefined}>
      <span className="bg-black/60 px-2 py-0.5">{up ? "UPLOADING…" : v.cover ? "📷 CHANGE" : "📷 ADD A COVER (OPTIONAL)"}</span>
      <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUp(true); const r = await window.cn.hub.upload("505th_projects", f.name, f.type, new Uint8Array(await f.arrayBuffer())); setUp(false); if (r.url) setV({ ...v, cover: r.url }); else p.setToast([r.error ?? "Upload failed", false]); }} /></label>
    <label htmlFor="pj-t" className={lbl}>NAME</label><input id="pj-t" autoFocus maxLength={80} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={fld} />
    <label htmlFor="pj-d" className={lbl}>DESCRIPTION</label><textarea id="pj-d" rows={5} maxLength={5000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={`${fld} resize-y`} />
    <div className="grid grid-cols-2 gap-3">
      <div><label htmlFor="pj-c" className={lbl}>CATEGORY</label><select id="pj-c" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} className={fld}>{p.cats.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><label htmlFor="pj-dl" className={lbl}>DEADLINE (OPTIONAL)</label><input id="pj-dl" type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} className={fld} /></div>
      <div><label htmlFor="pj-s" className={lbl}>STATUS</label><select id="pj-s" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Proj["status"] })} className={fld}>{Object.entries(STAT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="pj-p" className={lbl}>PRIORITY</label><select id="pj-p" value={v.priority} onChange={(e) => setV({ ...v, priority: e.target.value as Proj["priority"] })} className={fld}>{Object.entries(PRI).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
    </div>
    <span className={lbl}>WHO CAN SEE IT</span>
    <div className="grid grid-cols-2 gap-2" role="radiogroup">{([["private", "🔒 PRIVATE", "Only you"], ["invite", "👥 INVITE ONLY", "You + people you invite"]] as const).map(([k, l, s]) =>
      <button key={k} type="button" role="radio" aria-checked={v.privacy === k} onClick={() => setV({ ...v, privacy: k })} className={`border px-3 py-2 text-left ${v.privacy === k ? "border-cyan bg-cyan/10" : "border-cyan/15"}`}>
        <b className={`block text-[11px] font-normal tracking-[1.5px] ${v.privacy === k ? "text-cyan" : "text-white"}`}>{l}</b><small className="text-[10.5px] text-dim">{s}</small></button>)}</div>
    {p.p.id && v.privacy === "private" && (p.p.members?.length ?? 0) > 0 && <p className="mt-2 border-l-2 border-amber bg-amber/10 px-2.5 py-1.5 text-[11px] text-amber">⚠ The team keep their place but can't see the project while it's private.</p>}
  </Shell>;
}

function Invite(p: { p: Proj; d: ProjData; busy: boolean; btn: string; go: string; Av: AvT; onClose: () => void; onSend: (inv: { uid: string; role: string }[], msg: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<{ uid: string; role: string }[]>([]);
  const [msg, setMsg] = useState("");
  const inTeam = new Set([p.p.ownerUid, ...p.p.members.map((m) => m.uid)]);
  const found = useMemo(() => (q.trim() ? p.d.people.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []), [q, p.d.people]);
  return <Shell title={`👥 INVITE TO ${p.p.title.toUpperCase()}`} onClose={p.onClose}
    foot={<><button type="button" onClick={p.onClose} className={p.btn}>CANCEL</button><button type="button" disabled={p.busy || !sel.length} onClick={() => p.onSend(sel, msg)} className={p.go}>SEND {sel.length || ""} INVITE{sel.length === 1 ? "" : "S"}</button></>}>
    <p className="mb-2 mt-0 text-[11px] tracking-[1px] text-dim">THEY GET AN ALERT IN THE HUB AND THE TERMINAL, AND ACCEPT OR DECLINE. ONLY STAFF WITH PROJECTS ACCESS ARE LISTED.</p>
    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Find a member…" aria-label="Find a member" className="w-full border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-cyan" />
    {found.length > 0 && <div className="mt-0.5 border border-cyan/20 bg-[#070a0f]">{found.map((u) => { const dis = inTeam.has(u.uid) || sel.some((s) => s.uid === u.uid);
      return <button key={u.uid} type="button" disabled={dis} onClick={() => { setSel([...sel, { uid: u.uid, role: "editor" }]); setQ(""); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-white hover:bg-cyan/10 disabled:opacity-40">
        <p.Av uid={u.uid} s={22} />{u.name}<small className="ml-auto text-[10px] tracking-[1px] text-dim">{inTeam.has(u.uid) ? "ALREADY IN TEAM" : (u.platoon || "").toUpperCase()}</small></button>; })}</div>}
    {sel.length > 0 && <><div className="mb-1 mt-3 text-[9.5px] tracking-[2px] text-dim">TO INVITE</div>
      {sel.map((s) => <div key={s.uid} className="flex items-center gap-2 border-b border-white/5 py-1.5 text-[12.5px] text-white"><p.Av uid={s.uid} s={22} />{p.d.people.find((u) => u.uid === s.uid)?.name}
        <select value={s.role} onChange={(e) => setSel(sel.map((x) => (x.uid === s.uid ? { ...x, role: e.target.value } : x)))} aria-label="Role" className="ml-auto border border-cyan/20 bg-[#070a0f] px-1 text-[11px] text-white">
          <option value="editor">EDITOR — add &amp; tick tasks</option><option value="viewer">VIEWER — read + comment</option></select>
        <button type="button" aria-label="Remove" onClick={() => setSel(sel.filter((x) => x.uid !== s.uid))} className="text-dim hover:text-bad">✕</button></div>)}</>}
    <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={300} placeholder="Optional message…" aria-label="Message" className="mt-3 w-full resize-none border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
  </Shell>;
}
