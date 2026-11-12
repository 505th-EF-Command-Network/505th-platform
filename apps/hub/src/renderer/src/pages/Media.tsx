import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useState } from "react";
import type { MediaItem } from "../../../preload/api";

/**
 * INTEL ARCHIVE · MEDIA (approved mock 2026-11-11): Gallery + Videos in one page, same `media` records as the Terminal
 * (public Gallery / Videos pages keep working). ALL / IMAGES / VIDEOS · categories · visible/hidden · sort · search
 * · upload images (signed, straight to Cloudinary) · add YouTube link (title looked up) · big preview with edit · bulk show/hide/category/delete.
 */
const CATS = ["operations", "training", "events", "screenshots"];
const ytId = (u: string) => /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(u)?.[1] ?? null;
const thumb = (m: MediaItem) => (m.type === "video" ? (ytId(m.url) ? `https://i.ytimg.com/vi/${ytId(m.url)}/hqdefault.jpg` : "") : m.url.replace("/upload/", "/upload/c_fill,w_480,h_300,q_auto/"));
const day = (v: string) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" }).toUpperCase() : "—");
const inp = "border border-cyan/25 bg-[#05080b] px-2.5 py-2 text-[12px] text-white outline-none focus:border-cyan";

export function Media() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState<"all" | "image" | "video">("all");
  const [cat, setCat] = useState("");
  const [vis, setVis] = useState("");
  const [sort, setSort] = useState("new");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [add, setAdd] = useState<"img" | "vid" | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [drag, setDrag] = useState(false);
  const load = useCallback(async () => { const r = await window.cn.hub.media(); if ("error" in r) setError(r.error); else { setItems(r.items); setError(null); } }, []);
  useEffect(() => {
    void load();
    let tm: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "media") { clearTimeout(tm); tm = setTimeout(() => void load(), 300); } });
    return () => { off(); clearTimeout(tm); };
  }, [load]);
  useEffect(() => { if (!toast) return; const tm = setTimeout(() => setToast(null), 4000); return () => clearTimeout(tm); }, [toast]);
  const act = async (body: Record<string, unknown>) => { const r = await window.cn.hub.mediaAction(body); setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]); await load(); return r; };

  if (error && !items) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!items) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const list = items.filter((m) => (t === "all" || m.type === t) && (!cat || m.category === cat) && (!vis || (vis === "on") === m.enabled) && m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "old" ? a.uploadedAt.localeCompare(b.uploadedAt) : sort === "az" ? a.name.localeCompare(b.name) : b.uploadedAt.localeCompare(a.uploadedAt)));
  const chip = (on: boolean) => `border px-2.5 py-1.5 text-[11px] tracking-[1.5px] ${on ? "border-cyan bg-cyan/10 text-white" : "border-cyan/15 text-dim hover:border-cyan/40"}`;
  const ids = [...sel];
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Media" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) setAdd("img"); (window as unknown as { __drop?: FileList }).__drop = e.dataTransfer.files; }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">INTEL ARCHIVE · MEDIA</h1><p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">GALLERY + VIDEOS IN ONE PLACE — SHOWN ON THE PUBLIC GALLERY / VIDEOS PAGES</p></div>
        <div className="flex-1" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" aria-label="Search media" className={`${inp} w-[220px]`} />
        <button type="button" onClick={() => setAdd("vid")} className="border border-cyan px-3 py-2 text-[11px] tracking-[1.5px] text-cyan hover:bg-cyan/10">▶ ADD YOUTUBE LINK</button>
        <button type="button" onClick={() => setAdd("img")} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black">⇪ UPLOAD IMAGES</button>
      </div>
      <div className="mb-3 grid grid-cols-5 gap-2">
        {([[items.length, "TOTAL", "#00d9ff"], [items.filter((m) => m.type === "image").length, "IMAGES", "#fff"], [items.filter((m) => m.type === "video").length, "VIDEOS", "#ff4d4d"], [items.filter((m) => m.enabled).length, "VISIBLE ON SITE", "#22e07a"], [broken.size, "BROKEN LINKS", broken.size ? "#f59e0b" : "#fff"]] as [number, string, string][]).map(([v, l, c]) => (
          <div key={l} className="border border-cyan/15 bg-[#0b1016] px-3.5 py-2.5"><b className="block font-head text-[22px]" style={{ color: c }}>{v}</b><span className="text-[10px] tracking-[2px] text-dim">{l}</span></div>))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["all", "image", "video"] as const).map((k) => <button key={k} type="button" aria-pressed={t === k} onClick={() => setT(k)} className={chip(t === k)}>{k === "image" ? "▧ IMAGES" : k === "video" ? "▶ VIDEOS" : "ALL"} {k === "all" ? items.length : items.filter((m) => m.type === k).length}</button>)}
        <span className="w-3" />
        {["", ...CATS].map((c) => <button key={c || "all"} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={chip(cat === c)}>{c ? c.toUpperCase() : "ALL CATEGORIES"}</button>)}
        <div className="flex-1" />
        <select value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Visibility" className={inp}><option value="">Visible + hidden</option><option value="on">Visible only</option><option value="off">Hidden only</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={inp}><option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">A–Z</option></select>
      </div>
      <button type="button" onClick={() => setAdd("img")} className={`mb-3 block w-full border border-dashed px-4 py-4 text-center text-[12px] tracking-[1.5px] ${drag ? "border-cyan bg-cyan/15 text-white" : "border-cyan/40 bg-cyan/[.03] text-cyan"}`}>⇪ DROP IMAGES HERE TO UPLOAD (UP TO 10 MB EACH) · OR CLICK</button>
      {sel.size > 0 && (
        <div className="rise mb-3 flex flex-wrap items-center gap-2 border border-cyan bg-cyan/5 px-3 py-2 text-[12px] text-cyan"><b>{sel.size} SELECTED</b><div className="flex-1" />
          <button type="button" onClick={() => void act({ action: "bulk", op: "show", ids }).then(() => setSel(new Set()))} className="border border-cyan/30 px-2.5 py-1 text-[11px] text-white">👁 SHOW</button>
          <button type="button" onClick={() => void act({ action: "bulk", op: "hide", ids }).then(() => setSel(new Set()))} className="border border-cyan/30 px-2.5 py-1 text-[11px] text-white">🚫 HIDE</button>
          <select defaultValue="" aria-label="Move to category" onChange={(e) => { if (e.target.value) void act({ action: "bulk", op: "category", category: e.target.value, ids }).then(() => setSel(new Set())); e.target.value = ""; }} className={inp}><option value="">🏷 CATEGORY…</option>{CATS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
          <button type="button" onClick={async () => { if (await askBox(`DELETE ${sel.size} ITEM${sel.size === 1 ? "" : "S"}?\n\nThey are removed from the public pages.\n\nTHIS CANNOT BE UNDONE.`)) void act({ action: "bulk", op: "delete", ids }).then(() => setSel(new Set())); }} className="border border-bad/60 px-2.5 py-1 text-[11px] text-bad">🗑 DELETE</button>
          <button type="button" onClick={() => setSel(new Set())} className="border border-cyan/30 px-2.5 py-1 text-[11px] text-white">CLEAR</button>
        </div>)}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {list.map((m, n) => { const on = sel.has(m.id), bad = broken.has(m.id); return (
          <div key={m.id} className={`rise tile border bg-[#0b1016] ${on ? "outline outline-2 outline-cyan" : ""}`} style={{ animationDelay: `${Math.min(n, 30) * 0.02}s`, borderColor: bad ? "#f59e0b" : "rgb(var(--accent-rgb) / .15)" }}>
            <button type="button" onClick={() => setOpen(m)} className="relative block aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#123045] to-[#0a1a24]" aria-label={`Open ${m.name}`}>
              {thumb(m) && !bad && <img src={thumb(m)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((b) => new Set(b).add(m.id))} className={`h-full w-full object-cover ${m.enabled ? "" : "opacity-35"}`} />}
              {bad && <span className="absolute inset-0 grid place-items-center text-[11px] text-amber">⚠ BROKEN LINK</span>}
              {m.type === "video" && !bad && <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/60 text-white">▶</span>}
              <span className="absolute left-1.5 top-1.5 bg-black/75 px-1.5 text-[9.5px] tracking-[1px]" style={{ color: m.type === "video" ? "#ff4d4d" : "#00d9ff" }}>{m.type === "video" ? "▶ VIDEO" : "▧ IMAGE"}</span>
            </button>
            <button type="button" aria-pressed={on} aria-label={on ? "Unselect" : "Select"} onClick={() => { const s = new Set(sel); if (on) s.delete(m.id); else s.add(m.id); setSel(s); }}
              className={`absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center border text-[12px] ${on ? "border-cyan bg-cyan text-black" : "border-white/50 bg-black/60 text-white"}`}>{on ? "✓" : ""}</button>
            <div className="px-2.5 py-2"><b className="block truncate text-[12.5px] text-white">{m.name}</b>
              <small className="text-[10.5px] text-dim">{m.category.toUpperCase()} · {m.enabled ? <span className="text-ok">● VISIBLE</span> : <span>○ HIDDEN</span>} · {day(m.uploadedAt)}</small></div>
          </div>); })}
        {!list.length && <p className="col-span-full py-12 text-center text-[11px] tracking-[2px] text-dimmer">NOTHING MATCHES</p>}
      </div>
      {open && <Preview m={open} onClose={() => setOpen(null)} act={act} />}
      {add && <AddWindow kind={add} onClose={() => setAdd(null)} act={act} />}
      {toast && <div role="status" className={`fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] tracking-[1.5px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}

function Preview({ m, onClose, act }: { m: MediaItem; onClose: () => void; act: (b: Record<string, unknown>) => Promise<{ ok?: boolean }> }) {
  const [v, setV] = useState({ name: m.name, description: m.description, category: m.category, enabled: m.enabled });
  const id = ytId(m.url);
  const dirty = v.name !== m.name || v.description !== m.description || v.category !== m.category || v.enabled !== m.enabled;
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={m.name} className="rise w-[min(960px,94vw)] border border-cyan bg-[#0a1018]">
        <div className="grid aspect-video place-items-center bg-black">
          {m.type === "video" && id ? <img src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" /> : <img src={m.url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />}
        </div>
        <div className="grid gap-2.5 p-3.5" style={{ gridTemplateColumns: "1fr 170px auto" }}>
          <input value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Title" className={inp} />
          <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} aria-label="Category" className={inp}>{CATS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
          <label className="flex items-center gap-1.5 text-[11px] text-white"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="accent-cyan" /> VISIBLE ON SITE</label>
          <input value={v.description} maxLength={500} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Description (optional)" aria-label="Description" className={`${inp} col-span-3`} />
        </div>
        <div className="flex items-center gap-2 border-t border-cyan/15 px-3.5 py-2.5 text-[11px] text-dim">{m.type === "video" ? "YouTube video" : "Image"} · added {day(m.uploadedAt)}<div className="flex-1" />
          <button type="button" onClick={async () => { if (await askBox(`DELETE "${m.name}"?\n\nIt is removed from the public page.\n\nTHIS CANNOT BE UNDONE.`)) void act({ action: "bulk", op: "delete", ids: [m.id] }).then(onClose); }} className="border border-bad/60 px-3 py-1.5 tracking-[1.5px] text-bad">🗑 DELETE</button>
          <button type="button" onClick={onClose} className="border border-cyan/30 px-3 py-1.5 tracking-[1.5px] text-white">CLOSE</button>
          <button type="button" disabled={!dirty} onClick={() => void act({ action: "edit", id: m.id, ...v }).then((r) => r.ok && onClose())} className="border border-gold bg-gold px-3 py-1.5 font-bold tracking-[1.5px] text-black disabled:opacity-40">✓ SAVE</button>
        </div>
      </div>
    </div>
  );
}

function AddWindow({ kind, onClose, act }: { kind: "img" | "vid"; onClose: () => void; act: (b: Record<string, unknown>) => Promise<{ ok?: boolean }> }) {
  const [category, setCategory] = useState("operations");
  const [enabled, setEnabled] = useState(true);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>(() => { const d = (window as unknown as { __drop?: FileList }).__drop; (window as unknown as { __drop?: FileList }).__drop = undefined; return d ? [...d].filter((f) => f.type.startsWith("image/")) : []; });
  const [prog, setProg] = useState<string | null>(null);
  const go = async () => {
    if (kind === "vid") { const r = await act({ action: "add-video", url, name, category, enabled }); if (r.ok) onClose(); return; }
    const done: { url: string; name: string }[] = [];
    for (const [i, f] of files.slice(0, 30).entries()) {
      setProg(`UPLOADING ${i + 1} / ${files.length}…`);
      if (f.size > 10 * 1024 * 1024) continue;
      const r = await window.cn.hub.upload("505th_gallery", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
      if (r.url) done.push({ url: r.url, name: f.name.replace(/\.[a-z0-9]+$/i, "") });
    }
    setProg(null);
    if (done.length) { const r = await act({ action: "add-images", files: done, category, enabled }); if (r.ok) onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" onMouseDown={(e) => e.target === e.currentTarget && !prog && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={kind === "img" ? "Upload images" : "Add YouTube video"} className="rise w-[min(560px,94vw)] border border-cyan/40 bg-panel">
        <div className="flex items-center border-b border-cyan/20 px-4 py-3"><b className="font-head tracking-[3px] text-cyan">{kind === "img" ? "⇪ UPLOAD IMAGES" : "▶ ADD YOUTUBE LINK"}</b><button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-dim">✕</button></div>
        <div className="grid gap-3 p-4 text-[12px]">
          {kind === "img" ? <label className="block cursor-pointer border border-dashed border-cyan/40 bg-cyan/5 p-5 text-center tracking-[1.5px] text-cyan">{files.length ? `${files.length} IMAGE${files.length === 1 ? "" : "S"} READY · CLICK TO CHANGE` : "⇪ CLICK TO PICK IMAGES (UP TO 10 MB EACH)"}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...(e.target.files ?? [])])} /></label>
            : <><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" aria-label="YouTube link" className={inp} />
              {ytId(url) && <img src={`https://i.ytimg.com/vi/${ytId(url)}/hqdefault.jpg`} alt="" referrerPolicy="no-referrer" className="aspect-video w-full object-cover" />}
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Title (empty = looked up from YouTube)" aria-label="Title" className={inp} /></>}
          <div className="grid grid-cols-2 gap-2.5"><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={inp}>{CATS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
            <label className="flex items-center gap-1.5 text-white"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-cyan" /> VISIBLE ON SITE</label></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-cyan/20 px-4 py-3">{prog && <span className="mr-auto self-center text-[11px] text-amber">◷ {prog}</span>}
          <button type="button" disabled={!!prog} onClick={onClose} className="border border-cyan/30 px-3 py-2 text-[11px] tracking-[1.5px] text-white">CANCEL</button>
          <button type="button" disabled={!!prog || (kind === "img" ? !files.length : !ytId(url))} onClick={() => void go()} className="border border-gold bg-gold px-3 py-2 text-[11px] font-bold tracking-[1.5px] text-black disabled:opacity-40">{kind === "img" ? "⇪ UPLOAD" : "＋ ADD VIDEO"}</button></div>
      </div>
    </div>
  );
}
