import { useEffect, useState } from "react";
import type { CcChannel } from "../../../preload/api";

/**
 * CORTANA COMMAND → QUICK POST (was Quick Upload; same as the website page). Access "qu".
 * Pick up to 10 images → uploaded (505th_discord) → Cortana posts them in ONE message (505 embed / grid / plain).
 * Optional: also add to the website Gallery (needs Gallery access).
 */
type F = { f: File; url: string; st: "" | "up" | "ok" | "err" };
const MAX = 10, MAX_MB = 8;
const STYLES: [string, string][] = [["embed", "505 EMBED (CAPTION + CREDIT)"], ["grid", "GALLERY GRID"], ["plain", "PLAIN IMAGES"]];

export function QuickPost() {
  const [d, setD] = useState<{ channels: CcChannel[]; ops: string[]; canGallery: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<F[]>([]);
  const [v, setV] = useState({ channelId: "", style: "embed", op: "", caption: "", credit: "", gallery: true });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  useEffect(() => { void window.cn.hub.cc("quick").then((r) => (!r || "error" in r ? setError(String((r as { error?: string } | null)?.error ?? "No answer")) : setD(r as never))).catch(() => setError("This page needs an app restart")); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  const add = (list: FileList | File[]) => {
    const bad: string[] = [], next = [...files];
    for (const f of list) {
      if (next.length >= MAX) { bad.push(`only ${MAX} images per post`); break; }
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) { bad.push(`${f.name}: not an image`); continue; }
      if (f.size > MAX_MB * 1048576) { bad.push(`${f.name}: over ${MAX_MB} MB`); continue; }
      next.push({ f, url: URL.createObjectURL(f), st: "" });
    }
    setFiles(next);
    if (bad.length) setToast(["SKIPPED — " + bad.join(" · ").toUpperCase(), false]);
  };
  const problem = !v.channelId ? "Pick a channel" : !files.length ? "Add at least one image" : "";
  const post = async () => {
    if (problem || busy) return;
    setBusy(true);
    const urls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setFiles((x) => x.map((y, j) => (j === i ? { ...y, st: "up" } : y)));
        const f = files[i]!.f, r = await window.cn.hub.upload("505th_discord", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
        if (!r.url) { setFiles((x) => x.map((y, j) => (j === i ? { ...y, st: "err" } : y))); throw new Error(`${f.name}: ${r.error ?? "upload failed"}`); }
        urls.push(r.url);
        setFiles((x) => x.map((y, j) => (j === i ? { ...y, st: "ok" } : y)));
      }
      const r = await window.cn.hub.ccAction({ part: "quick", ...v, images: urls });
      if (r.error) throw new Error(r.error);
      setToast([String(r.msg).toUpperCase(), !r.queued]);
      files.forEach((x) => URL.revokeObjectURL(x.url));
      setFiles([]); setV((o) => ({ ...o, caption: "", credit: "", op: "" }));
    } catch (e) { setToast([("UPLOAD FAILED: " + (e as Error).message).toUpperCase(), false]); }
    setBusy(false);
  };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim", inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const groups = [...new Set(d.channels.map((c) => c.parentName || "NO CATEGORY"))];
  const n = files.length, grid = n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Quick Post">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⇪ QUICK POST</h1>
      <p className="m-0 mb-4 mt-0.5 text-[11px] tracking-[1.5px] text-dim">POST UP TO {MAX} IMAGES TO DISCORD IN ONE MESSAGE · CORTANA POSTS IT</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border border-cyan/15 bg-panel p-4">
          <label className="block cursor-pointer border border-dashed border-cyan p-6 text-center text-[12px] tracking-[1px] text-[#cfe9f2] hover:bg-cyan/5"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) add([...e.dataTransfer.files]); }}>
            DROP IMAGES HERE OR <u>CHOOSE FILES</u><small className="mt-1 block text-[10px] text-dim">PNG · JPG · WEBP · GIF · UP TO {MAX_MB} MB EACH · {n}/{MAX}</small>
            <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={busy} onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>
          {n > 0 && <div className="mt-2.5 grid grid-cols-5 gap-2">{files.map((x, i) => (
            <div key={x.url} className="relative h-[70px] border border-cyan/20"><img src={x.url} alt="" className="h-full w-full object-cover" />
              {x.st && <span className={`absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-bold ${x.st === "ok" ? "text-ok" : x.st === "err" ? "text-bad" : "text-cyan"}`}>{x.st === "ok" ? "✓" : x.st === "err" ? "✕" : "…"}</span>}
              {!busy && <button type="button" aria-label={`Remove ${x.f.name}`} onClick={() => { URL.revokeObjectURL(x.url); setFiles(files.filter((_, j) => j !== i)); }} className="absolute right-0.5 top-0.5 h-5 w-5 bg-black/70 text-[12px] text-white">✕</button>}</div>))}</div>}
          <label htmlFor="qpCh" className={lbl}>CHANNEL</label>
          <select id="qpCh" value={v.channelId} onChange={(e) => setV({ ...v, channelId: e.target.value })} className={inp}><option value="">— pick a channel —</option>
            {groups.map((g) => <optgroup key={g} label={g.toUpperCase()}>{d.channels.filter((c) => (c.parentName || "NO CATEGORY") === g).map((c) => <option key={c.id} value={c.id} disabled={!c.botCanSend}># {c.name}</option>)}</optgroup>)}</select>
          <span className={lbl}>STYLE</span>
          <div className="flex flex-wrap gap-1.5">{STYLES.map(([k, l]) => <button key={k} type="button" aria-pressed={v.style === k} onClick={() => setV({ ...v, style: k })} className={`border px-2.5 py-1 text-[10.5px] tracking-[1px] ${v.style === k ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}</div>
          {v.style === "embed" && <><label htmlFor="qpOp" className={lbl}>OPERATION (OPTIONAL)</label><input id="qpOp" list="qpOps" value={v.op} onChange={(e) => setV({ ...v, op: e.target.value })} className={inp} placeholder="e.g. Op Iron Gate" />
            <datalist id="qpOps">{d.ops.map((o) => <option key={o} value={o} />)}</datalist></>}
          {v.style !== "plain" && <><label htmlFor="qpCap" className={lbl}>CAPTION</label><textarea id="qpCap" rows={2} maxLength={1000} value={v.caption} onChange={(e) => setV({ ...v, caption: e.target.value })} className={inp} /></>}
          {v.style === "embed" && <><label htmlFor="qpCr" className={lbl}>PHOTO CREDIT</label><input id="qpCr" maxLength={100} value={v.credit} onChange={(e) => setV({ ...v, credit: e.target.value })} className={inp} /></>}
          {d.canGallery && <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={v.gallery} onChange={(e) => setV({ ...v, gallery: e.target.checked })} /> Also add to the website Gallery</label>}
          <div className="mt-4 flex items-center gap-3"><span className="flex-1 text-[11px] text-amber">{problem && `▲ ${problem}`}</span>
            <button type="button" disabled={!!problem || busy} onClick={() => void post()} className="border border-[#9cbf4a] bg-[#9cbf4a] px-4 py-2 text-[11px] font-semibold tracking-[1.5px] text-black disabled:opacity-40">{busy ? "UPLOADING…" : `POST ${n || ""} IMAGE${n === 1 ? "" : "S"}`}</button></div>
        </section>
        <section><span className="mb-1.5 block text-[10px] tracking-[1.5px] text-dim">PREVIEW</span>
          <div className="rounded-md bg-[#313338] p-3.5 text-[14px] text-[#dbdee1]">
            <div className="flex items-center gap-2"><b className="text-white">Cortana</b><span className="rounded bg-[#5865f2] px-1 text-[10px] text-white">APP</span><span className="text-[11px] text-[#949ba4]">Today</span></div>
            {v.style === "embed" ? <div className="ml-0 mt-1.5 max-w-[460px] rounded border-l-4 border-[#194a77] bg-[#2b2d31] p-2.5">
                {v.op && <div className="font-bold text-white">📸 {v.op}</div>}{v.caption && <div className="whitespace-pre-wrap">{v.caption}</div>}
                {n > 0 && <div className={`mt-2 grid gap-1 ${grid}`}>{files.slice(0, 6).map((x) => <img key={x.url} src={x.url} alt="" className="h-24 w-full rounded object-cover" />)}</div>}
                {v.credit && <div className="mt-1.5 text-[11px] text-[#949ba4]">Photo: {v.credit}</div>}</div>
              : <>{v.style === "grid" && v.caption && <div className="mt-1 whitespace-pre-wrap">{v.caption}</div>}{n > 0 && <div className={`mt-2 grid max-w-[460px] gap-1 ${grid}`}>{files.slice(0, 6).map((x) => <img key={x.url} src={x.url} alt="" className="h-24 w-full rounded object-cover" />)}</div>}</>}
            {!n && <p className="mt-2 text-[12px] text-[#949ba4]">Add images to see the post.</p>}
          </div></section>
      </div>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
