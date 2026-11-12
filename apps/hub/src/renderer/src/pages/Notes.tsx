import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteItem, NotesData } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * WORKSPACE → NOTES v2 in the app (approved mock 2026-11-12). Same notes + rules as the website (/api/hub/notes → lib/notes/service.ts).
 * Board (drag, your own layout) · List · Calendar (your reminders) · search (Ctrl+K) · rich text + highlighter + checklists + images
 * · colour · folder · #tags · 📌 pin · 🗄 archive · ⏰ reminder (🔔 + Hub pop-up from Cortana) · share (owner).
 * The server cleans all note HTML before saving, so what shows here is safe.
 */
type Share = { mode: "private" | "shared"; people: Record<string, "view" | "edit">; groups: Record<string, "view" | "edit"> };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const remTxt = (r: NoteItem["rem"]) => {
  if (!r) return "";
  const d = new Date(r.atISO), diff = Math.round((+new Date(d.toDateString()) - +new Date(new Date().toDateString())) / 864e5);
  return `⏰ ${diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${r.repeat !== "none" ? " ↻" : ""}${r.sentISO ? " ✓" : ""}`;
};
const prog = (n: NoteItem) => { const a = (n.body.match(/class="ck/g) || []).length, b = (n.body.match(/class="ck d"/g) || []).length; return a ? `${b} / ${a}` : ""; };
const FCOL = ["#00D9FF", "#c9a227", "#22e07a", "#f472b6", "#8b93f8", "#f59e0b", "#2dd4bf"];
const fcol = (f: string) => FCOL[[...f].reduce((s, c) => s + c.charCodeAt(0), 0) % FCOL.length]!;
const btn = "border border-cyan/25 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-[#c6d0da] hover:border-cyan disabled:opacity-40";
const NOTE_CSS = `
.nvh mark.y{background:#f5d90a;color:#000;padding:0 2px}.nvh mark.g{background:rgba(34,224,122,.35);color:inherit;padding:0 2px}.nvh mark.r{background:rgba(255,77,77,.35);color:inherit;padding:0 2px}
.nvh .ck{display:flex;gap:6px;align-items:flex-start}.nvh .ck>b{width:13px;height:13px;border:1px solid #00D9FF;flex-shrink:0;margin-top:4px;font-size:10px;line-height:11px;text-align:center;color:#00D9FF;cursor:pointer;font-weight:400}
.nvh .ck.d{color:#7d8a99;text-decoration:line-through}.nvh img{max-width:100%;display:block;margin:6px 0;border:1px solid rgba(0,217,255,.18)}.nvh ul{padding-left:18px;list-style:disc}.nvh ol{padding-left:18px;list-style:decimal}
.nvh .nvb img{max-height:90px;object-fit:cover}`;

export function Notes() {
  const [d, setD] = useState<NotesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list" | "cal">("board");
  const [filter, setFilter] = useState<{ k: string; v?: string }>({ k: "all" });
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [cal, setCal] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [share, setShare] = useState<Share | null>(null);
  const [saved, setSaved] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dirty = useRef(false), saveT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), selR = useRef(sel);
  selR.current = sel;

  const load = useCallback(async () => {
    try { const r = await window.cn.hub.notes(); if (!r || "error" in r) setError(r?.error ?? "No answer"); else { setD(r); setError(null); } }
    catch { setError("This page needs an app restart"); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "notes") { clearTimeout(t); t = setTimeout(() => { if (!dirty.current && document.activeElement !== bodyRef.current && document.activeElement !== titleRef.current) void load(); }, 800); } });
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => { off(); clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const run = async (b: Record<string, unknown>, ok?: string) => {
    const r = await window.cn.hub.notesAction(b);
    if (r.error) setToast([r.error, false]); else if (ok) setToast([ok, true]);
    return r;
  };
  const cur = d?.notes.find((n) => n.id === sel) ?? null;
  const canEdit = (n: NoteItem | null) => !!n && n.access !== "view";
  const local = (id: string, f: Partial<NoteItem>) => setD((x) => (x ? { ...x, notes: x.notes.map((n) => (n.id === id ? { ...n, ...f } : n)) } : x));
  const patch = async (f: Record<string, unknown>, ok?: string) => { if (!cur) return; local(cur.id, f as Partial<NoteItem>); const r = await run({ action: "patch", id: cur.id, ...f }, ok); if (r.error) void load(); };

  const saveNow = useCallback(async () => {
    clearTimeout(saveT.current);
    if (!dirty.current) return;
    dirty.current = false;
    const id = selR.current, b = bodyRef.current, t = titleRef.current;
    if (!id || !b) return;
    const body = b.innerHTML, title = t?.value ?? "";
    local(id, { body, title, text: b.innerText });
    const r = await window.cn.hub.notesAction({ action: "patch", id, title, body });
    if (r.error) { dirty.current = true; setToast(["Not saved: " + r.error, false]); } else setSaved("✓ saved");
  }, []);
  const queue = () => { dirty.current = true; setSaved("saving…"); clearTimeout(saveT.current); saveT.current = setTimeout(() => void saveNow(), 700); };
  const pick = async (id: string) => { if (id === sel) return; await saveNow(); setSel(id); setSaved(""); };
  const create = async (f: Record<string, unknown> = {}) => {
    await saveNow();
    const r = await run({ action: "create", title: "New note", body: "", ...f });
    if (r.id) { setSel(r.id); await load(); setTimeout(() => titleRef.current?.select(), 50); }
  };
  // Put the note's HTML into the editor only when you switch note (so typing isn't interrupted by redraws).
  useEffect(() => { if (bodyRef.current && cur) bodyRef.current.innerHTML = cur.body; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel, cur?.id, d === null]);

  const addImage = async (f: File) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return setToast(["Images only (PNG, JPG, WEBP, GIF)", false]);
    setToast(["Uploading image…", true]);
    const r = await window.cn.hub.upload("505th_notes", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
    if (!r.url) return setToast([r.error ?? "Upload failed", false]);
    bodyRef.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${r.url.replace(/"/g, "%22")}" alt="">`);
    queue(); setToast(["Image added", true]);
  };
  const highlight = (c: string) => {
    const b = bodyRef.current, s = getSelection();
    if (!b || !s || !s.rangeCount || s.isCollapsed || !b.contains(s.anchorNode)) return setToast(["Select some text in the note first", false]);
    if (c === "x") b.querySelectorAll("mark").forEach((m) => { if (s.containsNode(m, true)) m.replaceWith(...Array.from(m.childNodes)); });
    else { const r = s.getRangeAt(0), m = document.createElement("mark"); m.className = c; m.appendChild(r.extractContents()); r.insertNode(m); }
    s.removeAllRanges(); queue();
  };
  const tickOnCard = async (n: NoteItem, i: number) => {
    if (!canEdit(n)) return;
    const tmp = document.createElement("div"); tmp.innerHTML = n.body;
    const c = tmp.querySelectorAll(".ck")[i]; if (!c) return;
    c.classList.toggle("d"); c.querySelector("b")!.textContent = c.classList.contains("d") ? "✓" : "";
    local(n.id, { body: tmp.innerHTML });
    await run({ action: "patch", id: n.id, body: tmp.innerHTML });
  };

  // board drag
  const drag = useRef<{ id: string; el: HTMLElement; sx: number; sy: number; ox: number; oy: number; moved: boolean; x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent, n: NoteItem) => { if (e.button !== 0) return; const el = (e.currentTarget as HTMLElement).closest("[data-card]") as HTMLElement; drag.current = { id: n.id, el, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop, moved: false, x: el.offsetLeft, y: el.offsetTop }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const g = drag.current; if (!g) return; const dx = e.clientX - g.sx, dy = e.clientY - g.sy; if (!g.moved && Math.hypot(dx, dy) < 4) return; g.moved = true; g.x = Math.max(0, g.ox + dx); g.y = Math.max(0, g.oy + dy); g.el.style.left = g.x + "px"; g.el.style.top = g.y + "px"; g.el.style.zIndex = "50"; g.el.style.transform = "rotate(-2deg)"; };
  const onUp = async () => { const g = drag.current; drag.current = null; if (!g) return; g.el.style.zIndex = ""; g.el.style.transform = ""; if (!g.moved) return void pick(g.id); local(g.id, { x: Math.round(g.x), y: Math.round(g.y) }); await run({ action: "patch", id: g.id, x: Math.round(g.x), y: Math.round(g.y) }); };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;

  const all = d.notes, live = all.filter((n) => !n.arch);
  const vis = all.filter((n) => (filter.k === "arch" ? n.arch : !n.arch))
    .filter((n) => ["all", "arch"].includes(filter.k) || (filter.k === "pin" && n.pin) || (filter.k === "rem" && n.rem) || (filter.k === "mine" && n.access === "owner") || (filter.k === "shared" && n.access !== "owner") || (filter.k === "f" && n.folder === filter.v) || (filter.k === "tag" && n.tags.includes(filter.v!)))
    .filter((n) => !q || `${n.title} ${n.text} ${n.tags.join(" ")} ${n.folder}`.toLowerCase().includes(q.toLowerCase()));
  const folders = [...new Set(live.map((n) => n.folder).filter(Boolean))].sort(), tags = [...new Set(live.flatMap((n) => n.tags))].sort();
  const It = ({ k, v, l, c }: { k: string; v?: string; l: React.ReactNode; c: number }) => (
    <button type="button" aria-pressed={filter.k === k && filter.v === v} onClick={() => setFilter({ k, v })} className={`flex w-full items-center gap-2 border-l-[3px] px-2 py-1.5 text-left text-[12px] ${filter.k === k && filter.v === v ? "border-cyan bg-cyan/10" : "border-transparent hover:bg-cyan/5"}`}>{l}<small className="ml-auto text-dim">{c}</small></button>);
  const ro = !canEdit(cur);
  const remD = cur?.rem ? new Date(cur.rem.atISO) : null;

  return (
    <main className="nvh flex min-h-0 flex-1 flex-col overflow-auto p-5">
      <style>{NOTE_CSS}</style>
      <div className="mb-3 flex flex-wrap items-end gap-2.5">
        <div><h1 className="font-head text-[22px] font-bold tracking-[3px] text-cyan">✎ NOTES</h1><p className="text-[10px] tracking-[2px] text-dim">YOUR NOTES + SHARED WITH YOU · SAVED AUTOMATICALLY</p></div>
        <span className="flex-1" />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search notes, checklists, tags…  (Ctrl+K)" aria-label="Search notes" className="w-[380px] border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12px] outline-none focus:border-cyan" />
        <div role="tablist" className="flex border border-cyan/20">{(["board", "list", "cal"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`px-3 py-1.5 text-[10.5px] tracking-[1.5px] ${view === k ? "bg-cyan/15 text-cyan" : "text-dim"}`}>{k === "cal" ? "CALENDAR" : k.toUpperCase()}</button>)}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_360px] items-start gap-3">
        <aside className="border border-cyan/15 bg-panel p-2.5">
          {d.canCreate && <button type="button" onClick={() => void create(filter.k === "f" ? { folder: filter.v } : {})} className="mb-1.5 w-full border border-[#c9a227] py-2 text-[11px] tracking-[2px] text-[#c9a227] hover:bg-[#c9a227]/10">＋ NEW NOTE</button>}
          <div className="mx-1 mb-1 mt-3 text-[9.5px] tracking-[2px] text-dimmer">VIEWS</div>
          <It k="all" l="▦ All notes" c={live.length} /><It k="pin" l="📌 Pinned" c={live.filter((n) => n.pin).length} /><It k="rem" l="⏰ Reminders" c={live.filter((n) => n.rem).length} />
          <It k="mine" l="★ Mine" c={live.filter((n) => n.access === "owner").length} /><It k="shared" l="👥 Shared with me" c={live.filter((n) => n.access !== "owner").length} /><It k="arch" l="🗄 Archive" c={all.filter((n) => n.arch).length} />
          {!!folders.length && <><div className="mx-1 mb-1 mt-3 text-[9.5px] tracking-[2px] text-dimmer">FOLDERS</div>{folders.map((f) => <It key={f} k="f" v={f} l={<><i className="h-2.5 w-2.5 rounded-full" style={{ background: fcol(f) }} />{f}</>} c={live.filter((n) => n.folder === f).length} />)}</>}
          {!!tags.length && <><div className="mx-1 mb-1 mt-3 text-[9.5px] tracking-[2px] text-dimmer">TAGS</div><div className="flex flex-wrap gap-1 px-1">{tags.map((t) => <button key={t} type="button" onClick={() => setFilter(filter.k === "tag" && filter.v === t ? { k: "all" } : { k: "tag", v: t })} className={`border border-cyan/20 px-1.5 text-[10px] ${filter.k === "tag" && filter.v === t ? "bg-cyan/15 text-cyan" : "text-dim"}`}>#{t}</button>)}</div></>}
        </aside>

        <div className="min-w-0">
          {!vis.length ? <p className="py-16 text-center text-[11px] tracking-[2px] text-dimmer">{q ? "NOTHING MATCHES YOUR SEARCH" : "NO NOTES HERE"}</p>
          : view === "board" ? (
            <div className="relative overflow-auto border border-dashed border-cyan/15" style={{ height: Math.max(620, ...vis.map((n, i) => (n.y ?? 20 + Math.floor(i / 3) * 210) + 240)), background: "radial-gradient(circle,rgba(0,217,255,.08) 1px,transparent 1px) 0 0/22px 22px" }}>
              {vis.map((n, i) => (
                <div key={n.id} data-card className={`nvb absolute w-[214px] bg-[#0d131b] px-3 pb-3 pt-2 text-[12px] leading-[1.55] shadow-[0_8px_22px_rgba(0,0,0,.55)] ${n.id === sel ? "outline outline-1 outline-cyan" : ""}`} style={{ left: n.x ?? 20 + (i % 3) * 230, top: n.y ?? 20 + Math.floor(i / 3) * 210, borderTop: `4px solid ${n.color}` }}>
                  <h4 onPointerDown={(e) => onDown(e, n)} onPointerMove={onMove} onPointerUp={() => void onUp()} className="mb-1 flex cursor-grab touch-none items-center gap-1.5 font-head text-[14px] font-bold tracking-[1px] text-white">{n.pin && <span className="text-amber">📌</span>}<span className="truncate">{n.title || "Untitled"}</span><span className="ml-auto tracking-[-2px] text-dim">⠿⠿</span></h4>
                  <div className="max-h-[160px] cursor-pointer overflow-hidden break-words" onClick={(e) => { const b = (e.target as HTMLElement).closest(".ck > b"); if (b) { const cks = Array.from(e.currentTarget.querySelectorAll(".ck")); return void tickOnCard(n, cks.indexOf(b.parentElement!)); } void pick(n.id); }} dangerouslySetInnerHTML={{ __html: n.body || '<span style="color:#4b5765">Empty note</span>' }} />
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[9.5px]">{n.rem && <span className="border border-amber/40 px-1.5 text-amber">{remTxt(n.rem)}</span>}{prog(n) && <span className="border border-cyan/20 px-1.5 text-dim">☑ {prog(n)}</span>}{n.tags.map((t) => <span key={t} className="border border-cyan/20 px-1.5 text-dim">#{t}</span>)}{n.access !== "owner" && <span className="border border-cyan/20 px-1.5 text-dim">👥 {n.ownerName}{n.access === "view" ? " · view" : ""}</span>}</div>
                </div>))}
            </div>)
          : view === "list" ? (
            <div className="flex flex-col gap-1.5">{[...vis].sort((a, b) => Number(b.pin) - Number(a.pin)).map((n) => (
              <button key={n.id} type="button" onClick={() => void pick(n.id)} className={`flex min-w-0 items-center gap-3 border border-cyan/15 bg-[#0d131b] px-3 py-2.5 text-left ${n.id === sel ? "bg-cyan/5" : ""}`} style={{ borderLeft: `4px solid ${n.color}` }}>
                {n.pin && "📌"}<b className="whitespace-nowrap font-normal text-white">{n.title || "Untitled"}</b><small className="min-w-0 truncate text-dim">{n.text.replace(/\s+/g, " ")}</small>
                <span className="ml-auto flex shrink-0 gap-1 text-[9.5px]">{n.rem && <span className="border border-amber/40 px-1.5 text-amber">{remTxt(n.rem)}</span>}{prog(n) && <span className="border border-cyan/20 px-1.5 text-dim">☑ {prog(n)}</span>}</span></button>))}</div>)
          : (() => {
            const m = new Date(cal.y, cal.m, 1), first = new Date(m); first.setDate(1 - ((m.getDay() + 6) % 7));
            const go = (v: number) => setCal(v === 0 ? { y: new Date().getFullYear(), m: new Date().getMonth() } : (() => { let mm = cal.m + v, yy = cal.y; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; } return { y: yy, m: mm }; })());
            return <div>
              <div className="mb-2 flex items-center gap-1.5"><b className="mr-auto font-head text-[17px] tracking-[3px] text-white">{m.toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase()}</b>
                <button type="button" className={btn} onClick={() => go(-1)} aria-label="Previous month">◀</button><button type="button" className={btn} onClick={() => go(0)}>TODAY</button><button type="button" className={btn} onClick={() => go(1)} aria-label="Next month">▶</button></div>
              <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-1">
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((x) => <div key={x} className="py-1 text-center text-[9.5px] tracking-[2px] text-dim">{x}</div>)}
                {Array.from({ length: 42 }, (_, i) => { const dd = new Date(first); dd.setDate(first.getDate() + i); const k = iso(dd);
                  const evs = vis.filter((n) => n.rem && iso(new Date(n.rem.atISO)) === k).sort((a, b) => a.rem!.atISO.localeCompare(b.rem!.atISO));
                  return <div key={k} onClick={(e) => { if ((e.target as HTMLElement).closest("[data-ev]") || !d.canCreate) return; void create({ rem: { atISO: new Date(`${k}T19:00`).toISOString(), repeat: "none" } }); }}
                    className={`group min-h-[100px] min-w-0 cursor-pointer border bg-[#0b0f15] px-1.5 py-1 text-[10.5px] hover:border-cyan/50 ${k === iso(new Date()) ? "border-cyan bg-[#0d1a24]" : "border-cyan/15"} ${dd.getMonth() !== cal.m ? "opacity-35" : ""}`}>
                    <span className="text-dim">{dd.getDate()}</span>{d.canCreate && <span className="float-right text-dimmer group-hover:text-cyan">＋</span>}
                    {evs.map((n) => <button key={n.id} data-ev type="button" onClick={() => void pick(n.id)} className="mt-1 block w-full truncate bg-[#121a24] px-1 text-left text-[10px]" style={{ borderLeft: `3px solid ${n.color}` }}>{new Date(n.rem!.atISO).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} {n.title || "Untitled"}</button>)}</div>; })}
              </div><p className="mt-2 text-[11px] text-dim">Your reminders only — each person sets their own.</p></div>; })()}
        </div>

        <div className="sticky top-0 max-h-[calc(100vh-150px)] overflow-auto border border-cyan/15 bg-panel p-3">
          {!cur ? <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">PICK A NOTE</p> : <>
            <div className="text-[9.5px] tracking-[1.5px] text-dim">{ro ? `VIEW ONLY · ${cur.ownerName}` : cur.access === "owner" ? "YOUR NOTE" : `SHARED BY ${cur.ownerName} · CAN EDIT`} <span className="text-dimmer">{saved}</span></div>
            <input key={cur.id} ref={titleRef} defaultValue={cur.title} readOnly={ro} onInput={queue} maxLength={120} aria-label="Title" className="w-full border-b border-cyan/20 bg-transparent py-1 font-head text-[18px] font-bold tracking-[1px] text-white outline-none focus:border-cyan" />
            {!ro && <>
              <div role="toolbar" aria-label="Formatting" className="my-2.5 flex flex-wrap gap-0.5 border border-cyan/15 bg-[#070a0f] p-1 text-[12px]">
                {([["bold", <b key="b">B</b>], ["italic", <i key="i">I</i>], ["underline", <u key="u">U</u>], ["strikeThrough", "S̶"]] as [string, React.ReactNode][]).map(([c, l]) => <button key={c} type="button" title={c} onMouseDown={(e) => e.preventDefault()} onClick={() => { document.execCommand(c); queue(); }} className="grid h-[26px] min-w-[26px] place-items-center border border-transparent hover:border-cyan/30">{l}</button>)}
                <i className="mx-1 w-px bg-cyan/20" />
                {([["y", "bg-[#f5d90a] text-black"], ["g", "bg-[#22e07a]/35"], ["r", "bg-[#ff4d4d]/35"]] as [string, string][]).map(([c, cl]) => <button key={c} type="button" title="Highlight" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight(c)} className={`grid h-[26px] min-w-[26px] place-items-center ${cl}`}>H</button>)}
                <button type="button" title="Remove highlight" onMouseDown={(e) => e.preventDefault()} onClick={() => highlight("x")} className="grid h-[26px] min-w-[26px] place-items-center hover:border hover:border-cyan/30">⌫</button>
                <i className="mx-1 w-px bg-cyan/20" />
                <button type="button" title="Checklist item" onMouseDown={(e) => e.preventDefault()} onClick={() => { bodyRef.current?.focus(); document.execCommand("insertHTML", false, '<div class="ck"><b></b><span>New item</span></div>'); queue(); }} className="grid h-[26px] min-w-[26px] place-items-center">☑</button>
                <button type="button" title="Bullets" onMouseDown={(e) => e.preventDefault()} onClick={() => { document.execCommand("insertUnorderedList"); queue(); }} className="grid h-[26px] min-w-[26px] place-items-center">•</button>
                <button type="button" title="Numbers" onMouseDown={(e) => e.preventDefault()} onClick={() => { document.execCommand("insertOrderedList"); queue(); }} className="grid h-[26px] min-w-[26px] place-items-center">1.</button>
                <i className="mx-1 w-px bg-cyan/20" />
                <label title="Add image" className="grid h-[26px] min-w-[26px] cursor-pointer place-items-center">🖼<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = ""; }} /></label>
              </div>
              <div className="mb-1 text-[9.5px] tracking-[2px] text-dim">COLOUR</div>
              <div className="flex gap-1.5">{d.colours.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={cur.color === c} onClick={() => void patch({ color: c })} className={`h-[22px] w-[22px] rounded-full border-2 ${cur.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}</div>
            </>}
            <div ref={bodyRef} contentEditable={!ro} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Note text" onInput={queue}
              onClick={(e) => { const b = (e.target as HTMLElement).closest(".ck > b"); if (b && !ro) { const ck = b.parentElement!; ck.classList.toggle("d"); b.textContent = ck.classList.contains("d") ? "✓" : ""; queue(); } }}
              onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); void addImage(f); } }}
              onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault(); }} onDrop={(e) => { const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); void addImage(f); } }}
              onBlur={() => void saveNow()} className="mt-2.5 min-h-[170px] break-words border border-cyan/20 bg-[#070a0f] p-2.5 text-[12.5px] leading-[1.7] outline-none focus:border-cyan" />
            {!ro && <p className="mt-1 text-[10px] text-dimmer">🖼 Paste (Ctrl+V) or drop images into the note</p>}
            <div className="mb-1 mt-3 text-[9.5px] tracking-[2px] text-dim">⏰ REMINDER <small className="text-dimmer">(just for you)</small></div>
            <RemBox key={cur.id + (cur.rem?.atISO ?? "")} at={remD} repeat={cur.rem?.repeat ?? "none"} has={!!cur.rem} txt={remTxt(cur.rem)}
              onSet={(atISO, repeat) => void patch({ rem: { atISO, repeat } }, "⏰ Reminder set — 🔔 alert + Hub pop-up")} onClear={() => void patch({ rem: null }, "Reminder removed")} />
            {!ro && <><div className="mb-1 mt-3 text-[9.5px] tracking-[2px] text-dim">FOLDER · TAGS</div>
              <div className="flex gap-1.5"><input key={"f" + cur.id} defaultValue={cur.folder} list="nvFolders" maxLength={40} placeholder="Folder" aria-label="Folder" onBlur={(e) => e.target.value.trim() !== cur.folder && void patch({ folder: e.target.value.trim() })} className="w-[42%] border border-cyan/20 bg-[#070a0f] px-2 py-1 text-[12px] outline-none focus:border-cyan" />
                <datalist id="nvFolders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
                <input key={"t" + cur.id} defaultValue={cur.tags.join(", ")} placeholder="tags, comma, separated" aria-label="Tags" onBlur={(e) => void patch({ tags: e.target.value.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean) })} className="flex-1 border border-cyan/20 bg-[#070a0f] px-2 py-1 text-[12px] outline-none focus:border-cyan" /></div></>}
            <div className="mb-1 mt-3 text-[9.5px] tracking-[2px] text-dim">SHARING</div>
            <div className="flex flex-wrap items-center gap-1 text-[10px]">{cur.shareSummary.mode === "shared" ? [...cur.shareSummary.groups.map((g) => <span key={g.key} className="border border-cyan/20 px-1.5 text-dim">👥 {g.label} · {g.perm}</span>), ...cur.shareSummary.people.map((p) => <span key={p.uid} className="border border-cyan/20 px-1.5 text-dim">{p.name} · {p.perm}</span>)] : <span className="text-dim">🔒 Only you</span>}
              {cur.access === "owner" && <button type="button" className={btn} onClick={() => setShare(JSON.parse(JSON.stringify(cur.share ?? { mode: "private", people: {}, groups: {} })))}>⇪ SHARE</button>}</div>
            <div className="mb-1 mt-3 text-[9.5px] tracking-[2px] text-dim">MORE</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={`${btn} ${cur.pin ? "!border-amber !text-amber" : ""}`} onClick={() => void patch({ pin: !cur.pin })}>📌 {cur.pin ? "UNPIN" : "PIN"}</button>
              {d.canCreate && <button type="button" className={btn} onClick={async () => { await saveNow(); void create({ title: `${cur.title} (copy)`, body: bodyRef.current?.innerHTML ?? cur.body, color: cur.color, folder: cur.folder, tags: cur.tags, x: (cur.x ?? 20) + 24, y: (cur.y ?? 20) + 24 }); }}>⧉ DUPLICATE</button>}
              <button type="button" className={btn} onClick={async () => { const a = !cur.arch; await patch({ arch: a }, a ? "Archived" : "Restored"); if (a) setSel(null); }}>🗄 {cur.arch ? "RESTORE" : "ARCHIVE"}</button>
              {cur.access === "owner" && <button type="button" className={`${btn} !border-bad/50 !text-bad`} onClick={async () => {
                if (!(await askBox(`DELETE NOTE?\n\n${cur.title || "Untitled"}\n\n${cur.shareSummary.mode === "shared" ? "It is deleted for everyone it is shared with.\n\n" : ""}THIS CANNOT BE UNDONE.`, { tone: "danger", go: "DELETE NOTE" }))) return;
                clearTimeout(saveT.current); dirty.current = false; const r = await run({ action: "delete", id: cur.id }, "Note deleted"); if (!r.error) { setSel(null); void load(); } }}>🗑 DELETE</button>}
            </div></>}
          <NotesQuick notes={live} canCreate={d.canCreate} onOpen={(id) => void pick(id)} onQuick={(t) => void create({ title: t })} />
        </div>
      </div>
      {share && cur && <ShareBox s={share} people={d.people} groups={d.groups} onChange={setShare} onClose={() => setShare(null)}
        onSave={async () => { const r = await run({ action: "patch", id: cur.id, share }, "Sharing saved"); if (!r.error) { setShare(null); void load(); } }} />}
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2 text-[12px] tracking-[1px] ${toast[1] ? "border-ok/50 bg-[#06130c] text-ok" : "border-bad/50 bg-[#1a0808] text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function RemBox(p: { at: Date | null; repeat: string; has: boolean; txt: string; onSet: (atISO: string, repeat: string) => void; onClear: () => void }) {
  const [day, setDay] = useState(p.at ? iso(p.at) : "");
  const [tm, setTm] = useState(p.at ? p.at.toTimeString().slice(0, 5) : "19:00");
  const [rep, setRep] = useState(p.repeat);
  const f = "border border-amber/40 bg-[#070a0f] px-1.5 py-0.5 text-[11px] text-white [color-scheme:dark]";
  return <div className="flex flex-wrap items-center gap-1.5 border border-amber/40 bg-amber/5 p-2">
    <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Reminder date" className={f} />
    <input type="time" value={tm} onChange={(e) => setTm(e.target.value)} aria-label="Reminder time" className={f} />
    <select value={rep} onChange={(e) => setRep(e.target.value)} aria-label="Repeat" className={f}><option value="none">no repeat</option><option value="daily">daily</option><option value="weekly">weekly</option></select>
    <button type="button" disabled={!day} onClick={() => p.onSet(new Date(`${day}T${tm || "19:00"}`).toISOString(), rep)} className={btn}>{p.has ? "UPDATE" : "SET"}</button>
    {p.has && <button type="button" onClick={p.onClear} aria-label="Remove reminder" className={`${btn} !border-bad/50 !text-bad`}>✕</button>}
    <div className="w-full text-[10.5px] text-dim">{p.has ? `${p.txt} → 🔔 alert + Hub pop-up` : "No reminder"}</div></div>;
}

function NotesQuick(p: { notes: NoteItem[]; canCreate: boolean; onOpen: (id: string) => void; onQuick: (t: string) => void }) {
  const [t, setT] = useState("");
  const rows = [...p.notes.filter((n) => n.pin), ...p.notes.filter((n) => n.rem && !n.rem.sentISO).sort((a, b) => a.rem!.atISO.localeCompare(b.rem!.atISO)).slice(0, 4)];
  return <div className="mt-4 border border-cyan/15 bg-[#0b0f15] p-2.5">
    <h5 className="mb-1.5 flex font-head text-[12px] font-bold tracking-[2px] text-cyan">✎ QUICK<span className="ml-auto font-mono text-[10px] font-normal tracking-normal text-dim">also on your Dashboard</span></h5>
    {rows.length ? rows.map((n, i) => <button key={n.id + i} type="button" onClick={() => p.onOpen(n.id)} className={`block w-full truncate border-t border-white/[.04] py-1 text-left text-[11.5px] ${n.pin ? "" : "text-amber"}`}>{n.pin ? "📌 " : `${remTxt(n.rem)} · `}{n.title || "Untitled"}</button>) : <p className="text-[11px] text-dim">Pin notes or set reminders to see them here.</p>}
    {p.canCreate && <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && t.trim()) { p.onQuick(t.trim()); setT(""); } }} maxLength={120} placeholder="＋ Quick note… (Enter)" aria-label="Quick note" className="mt-1.5 w-full border border-cyan/20 bg-[#070a0f] px-2 py-1 text-[12px] outline-none focus:border-cyan" />}
  </div>;
}

function ShareBox(p: { s: Share; people: NotesData["people"]; groups: NotesData["groups"]; onChange: (s: Share) => void; onClose: () => void; onSave: () => void }) {
  const [q, setQ] = useState("");
  const [perm, setPerm] = useState<"view" | "edit">("view");
  const s = p.s, set = (f: Partial<Share>) => p.onChange({ ...s, ...f });
  const sug = q ? p.people.filter((x) => !s.people[x.uid] && `${x.name} ${x.callsign}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const sel = "border border-cyan/20 bg-[#070a0f] px-1 py-0.5 text-[10.5px]";
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [p]);
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
    <div role="dialog" aria-modal="true" aria-label="Share note" className="w-[min(560px,100%)] border border-cyan/40 bg-panel">
      <div className="flex items-center border-b border-cyan/15 px-4 py-3"><h2 className="font-head text-[18px] font-bold tracking-[2px] text-cyan">⇪ SHARE NOTE</h2><span className="flex-1" /><button type="button" onClick={p.onClose} aria-label="Close" className={btn}>✕</button></div>
      <div className="flex max-h-[60vh] flex-col gap-2 overflow-auto px-4 py-3 text-[12px]">
        <div className="grid grid-cols-2 gap-2">{([["private", "🔒 ONLY ME"], ["shared", "👥 SHARED"]] as const).map(([m, l]) => <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => set({ mode: m })} className={`border px-3 py-2 ${s.mode === m ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>
        {s.mode === "shared" && <>
          <div className="mt-1 text-[9.5px] tracking-[2px] text-dim">ADD PEOPLE</div>
          <div className="flex gap-1.5"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or callsign…" aria-label="Find members" className="flex-1 border border-cyan/20 bg-[#070a0f] px-2 py-1 outline-none focus:border-cyan" />
            <select value={perm} onChange={(e) => setPerm(e.target.value as "view" | "edit")} aria-label="Permission" className={sel}><option value="view">CAN VIEW</option><option value="edit">CAN EDIT</option></select></div>
          {sug.map((x) => <button key={x.uid} type="button" onClick={() => { set({ people: { ...s.people, [x.uid]: perm } }); setQ(""); }} className="flex items-center gap-2 border border-cyan/10 px-2 py-1 text-left hover:border-cyan">＋ {x.name}<small className="ml-auto text-dim">{x.role.replace("_", " ").toUpperCase()}</small></button>)}
          <div className="mt-1 text-[9.5px] tracking-[2px] text-dim">ADD GROUPS</div>
          <div className="flex flex-wrap gap-1">{p.groups.map((g) => <button key={g.key} type="button" aria-pressed={!!s.groups[g.key]} onClick={() => { const n = { ...s.groups }; if (n[g.key]) delete n[g.key]; else n[g.key] = perm; set({ groups: n }); }} className={`border px-2 py-0.5 text-[10.5px] ${s.groups[g.key] ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{s.groups[g.key] ? "✓ " : "+ "}{g.label}</button>)}</div>
          <div className="mt-1 text-[9.5px] tracking-[2px] text-dim">SHARED WITH</div>
          {[...Object.entries(s.people).map(([uid, v]) => ["people", uid, p.people.find((x) => x.uid === uid)?.name ?? "Former member", v] as const), ...Object.entries(s.groups).map(([k, v]) => ["groups", k, `👥 ${p.groups.find((g) => g.key === k)?.label ?? k}`, v] as const)].map(([t, k, l, v]) => (
            <div key={t + k} className="flex items-center gap-2 border-b border-white/[.04] py-1"><span className="flex-1">{l}</span>
              <select value={v} aria-label={`Permission for ${l}`} onChange={(e) => set({ [t]: { ...s[t], [k]: e.target.value } } as Partial<Share>)} className={sel}><option value="view">CAN VIEW</option><option value="edit">CAN EDIT</option></select>
              <button type="button" aria-label={`Remove ${l}`} onClick={() => { const n = { ...s[t] }; delete n[k]; set({ [t]: n } as Partial<Share>); }} className="text-dim hover:text-bad">✕</button></div>))}
        </>}
      </div>
      <div className="flex items-center gap-2 border-t border-cyan/15 px-4 py-3"><span className="flex-1 text-[10.5px] text-dim">Groups follow roles. People you add get a 🔔 alert.</span><button type="button" className={btn} onClick={p.onClose}>CANCEL</button><button type="button" className={`${btn} !border-[#c9a227] !text-[#c9a227]`} onClick={p.onSave}>SAVE</button></div>
    </div></div>;
}

/** Dashboard widget: 📌 pinned + ⏰ next reminders. */
export function NotesWidget({ onPage }: { onPage: (id: string) => void }) {
  const [n, setN] = useState<NoteItem[] | null>(null);
  useEffect(() => {
    const load = () => void window.cn.hub.notes().then((r) => setN(r && !("error" in r) ? r.notes.filter((x) => !x.arch) : [])).catch(() => setN([]));
    load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "notes") { clearTimeout(t); t = setTimeout(load, 1000); } });
    return () => { off(); clearTimeout(t); };
  }, []);
  if (!n) return <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">LOADING…</p>;
  const rows = [...n.filter((x) => x.pin), ...n.filter((x) => !x.pin && x.rem && !x.rem.sentISO).sort((a, b) => a.rem!.atISO.localeCompare(b.rem!.atISO)), ...n.filter((x) => !x.pin && !(x.rem && !x.rem.sentISO))].slice(0, 6);
  if (!rows.length) return <p className="py-6 text-center text-[11px] tracking-[2px] text-dimmer">NO NOTES YET</p>;
  return <>{rows.map((x) => <button key={x.id} type="button" onClick={() => onPage("panel-notes")} className="flex w-full items-center gap-2 border-b border-cyan/[.07] py-1.5 text-left text-[12px] last:border-0 hover:bg-cyan/[.04]">
    <span style={{ color: x.color }}>{x.pin ? "📌" : "✎"}</span><span className="min-w-0 flex-1 truncate">{x.title || "Untitled"}</span>{x.rem && !x.rem.sentISO ? <small className="shrink-0 text-amber">{remTxt(x.rem)}</small> : prog(x) ? <small className="shrink-0 text-dim">☑ {prog(x)}</small> : null}</button>)}</>;
}
