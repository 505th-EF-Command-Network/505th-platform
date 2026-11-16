import { useCallback, useEffect, useMemo, useState } from "react";
import type { WebData } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * WORKSPACE → WEBSITE in the app (approved mock 2026-11-16). Same data + rules as the website Terminal's editor.
 * Edits are a DRAFT (amber) until PUBLISH CHANGES; DISCARD throws drafts away. Photos: Comms Library, Gallery or upload (→ Comms Library).
 * Access "web". Every publish → Audit Log.
 */
type Val = { url?: string; value?: string; mediaId?: string };
const SITE = "https://www.505expeditionaryforce.com";
const IMG = /^(enlist_photo|slider_\d|marine_\d|op_\d|equip_\d|air_\d)$/;
const isImg = (k: string) => IMG.test(k.split("__")[1] ?? "");
const v = (o: unknown) => { const x = (o ?? {}) as Val; return x.url || x.value || ""; };
const ytId = (u: string) => (u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/) ?? [])[1];
const day = (iso: unknown) => (typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export function Website() {
  const [d, setD] = useState<WebData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Val>>({});
  const [cur, setCur] = useState("home");
  const [pick, setPick] = useState<string | null>(null);
  const [tab, setTab] = useState<"lib" | "gal" | "up">("lib");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);

  const load = useCallback(async () => {
    try { const r = await window.cn.hub.website(); if (!r || "error" in r) setError(r?.error ?? "No answer"); else { setD(r); setError(null); } } catch { setError("This page needs an app restart"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if ((x === "settings" || x === "comms_media") && document.documentElement.dataset.page === "panel-website") { clearTimeout(t); t = setTimeout(() => void load(), 600); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const saved = (d?.content ?? {}) as Record<string, unknown>;
  const val = (k: string) => (k in draft ? v(draft[k]) : v(saved[k]));
  const changed = (k: string) => k in draft && v(draft[k]) !== v(saved[k]);
  const changedKeys = useMemo(() => Object.keys(draft).filter((k) => v(draft[k]) !== v(saved[k])), [draft, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const stats = (p: string) => { const s = d!.pages.find((x) => x.key === p)!.slots.map((x) => `${p}__${x}`); return { f: s.filter((k) => val(k).trim()).length, n: s.length, c: s.filter(changed).length }; };
  const setText = (k: string, value: string) => setDraft((x) => ({ ...x, [k]: value ? { value } : {} }));
  const setPhoto = (k: string, url: string, mediaId?: string) => { setDraft((x) => ({ ...x, [k]: url ? { url, ...(mediaId ? { mediaId } : {}) } : {} })); setPick(null); setToast([url ? "PHOTO SET — PUBLISH TO APPLY" : "PHOTO REMOVED — PUBLISH TO APPLY", true]); };

  const publish = async () => {
    if (!changedKeys.length) return;
    setBusy(true);
    const r = await window.cn.hub.websiteAction({ action: "publish", changes: Object.fromEntries(changedKeys.map((k) => [k, draft[k] ?? {}])) });
    setBusy(false);
    if (r.error) return setToast([r.error.toUpperCase(), false]);
    setDraft({}); setToast([`✓ PUBLISHED ${r.published} CHANGE${r.published === 1 ? "" : "S"} — LIVE ON THE PUBLIC PAGES`, true]); void load();
  };
  const discard = async () => { if (await askBox(`Throw away ${changedKeys.length} unpublished change${changedKeys.length === 1 ? "" : "s"}?`, { tone: "warn", go: "DISCARD" })) setDraft({}); };
  const upload = async (f: File | undefined, key: string) => {
    if (!f || !f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) return setToast(["IMAGES UP TO 10 MB ONLY", false]);
    setBusy(true);
    const r = await window.cn.hub.upload("505th_comms", f.name, f.type, new Uint8Array(await f.arrayBuffer()));
    if (r.error || !r.url) { setBusy(false); return setToast([(r.error ?? "Upload failed").toUpperCase(), false]); }
    const a = await window.cn.hub.websiteAction({ action: "addLib", url: r.url, name: f.name });
    setBusy(false);
    setPhoto(key, r.url, a.id);
    void load();
  };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const P = d.pages.find((x) => x.key === cur)!, st = stats(cur);
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const fld = (k: string) => `w-full border bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan ${changed(k) ? "border-amber/70" : "border-white/15"}`;
  const draft1 = (k: string) => changed(k) ? <span className="ml-1.5 text-[9px] tracking-[1px] text-amber">● DRAFT</span> : null;
  const text = (k: string, label: string, area?: boolean) => (
    <label key={k} className="mt-2 block text-[9.5px] tracking-[1.5px] text-dim">{label}{draft1(k)}
      {area ? <textarea rows={2} value={val(k)} onChange={(e) => setText(k, e.target.value)} className={`mt-1 resize-y ${fld(k)}`} />
        : <input value={val(k)} onChange={(e) => setText(k, e.target.value)} className={`mt-1 ${fld(k)}`} />}</label>);
  const photo = (k: string, label: string) => { const u = val(k); return (<div key={k}>
    <button type="button" onClick={() => { setTab("lib"); setPick(k); }} aria-label={`${u ? "Change" : "Add"} ${label}`}
      className={`group relative grid h-[130px] w-full place-items-center overflow-hidden border ${changed(k) ? "border-amber/80" : u ? "border-cyan/25" : "border-dashed border-cyan/30"}`}>
      {u ? <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-[11px] tracking-[1.5px] text-dim">+ ADD PHOTO</span>}
      {u && <span className="absolute inset-0 hidden place-items-center bg-black/60 text-[11px] tracking-[1.5px] text-white group-hover:grid group-focus-visible:grid">🖼 CHANGE PHOTO</span>}</button>
    <div className="mt-1 flex items-center gap-2 text-[10px]">{u && <button type="button" onClick={() => setPhoto(k, "")} className="text-bad hover:underline">✕ REMOVE</button>}{draft1(k)}</div></div>); };
  const card = (base: string, i: number, label: string) => (
    <div key={i} className="border border-cyan/15 bg-panel p-2.5">{photo(`${cur}__${base}_${i}`, `${label} ${i} photo`)}{text(`${cur}__${base}_${i}_title`, "TITLE")}{text(`${cur}__${base}_${i}_desc`, "TEXT", true)}</div>);
  const vid = val("home__hero_video"), yid = ytId(vid);
  const list = tab === "lib" ? d.library : d.gallery;

  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5 pb-24" aria-label="Website editor">
      <div className="flex flex-wrap items-end gap-3 border-b border-cyan/15 pb-3">
        <div><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">⌂ WEBSITE</h1>
          <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">EDIT THE PUBLIC 505TH PAGES · CHANGES ARE A DRAFT UNTIL YOU PUBLISH · SAME AS THE WEBSITE TERMINAL</p></div>
        <div className="flex-1" /><a href={SITE + P.url} target="_blank" rel="noreferrer" className={`${btn} border-cyan/30 text-dim no-underline hover:text-white`}>↗ VIEW LIVE PAGE</a>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[250px_1fr]">
        <nav aria-label="Pages" className="h-fit border border-cyan/15 bg-panel">
          {d.pages.map((p) => { const s = stats(p.key); return (
            <button key={p.key} type="button" aria-current={p.key === cur} onClick={() => setCur(p.key)} className={`block w-full border-b border-l-[3px] border-b-white/5 px-3.5 py-2.5 text-left ${p.key === cur ? "border-l-cyan bg-cyan/10" : "border-l-transparent hover:bg-cyan/5"}`}>
              <b className="block text-[11.5px] tracking-[1.5px] text-white">{s.c > 0 && <span className="mr-1 text-amber">●</span>}{p.name.toUpperCase()}</b>
              <small className="text-[10px] tracking-[1px] text-dim">{s.f}/{s.n} FILLED{s.c ? ` · ${s.c} UNSAVED` : ""}</small>
              <i className="mt-1.5 block h-[3px] bg-[#1d2630]"><i className="block h-full bg-ok" style={{ width: `${(s.f / s.n) * 100}%` }} /></i></button>); })}
        </nav>
        <section className="min-w-0">
          <h2 className="m-0 text-[17px] tracking-[3px] text-white">{P.name.toUpperCase()}</h2>
          <p className="m-0 text-[10.5px] tracking-[1px] text-dim">{st.f}/{st.n} FILLED{saved.__lastPublishedBy ? ` · LAST PUBLISHED BY ${String(saved.__lastPublishedBy).toUpperCase()} · ${day(saved.__lastPublishedAt)}` : ""}</p>
          {P.home ? (<>
            <h3 className="mb-2 mt-5 text-[10px] tracking-[3px] text-[#9cbf4a]">READY TO ENLIST CARD</h3>
            <div className="max-w-[420px]">{photo("home__enlist_photo", "Ready To Enlist photo")}</div>
            <h3 className="mb-2 mt-5 text-[10px] tracking-[3px] text-[#9cbf4a]">SEE US IN ACTION — VIDEO</h3>
            <div className="grid gap-3 border border-cyan/15 bg-panel p-3 md:grid-cols-[240px_1fr]">
              <div className="grid h-[135px] place-items-center overflow-hidden border border-cyan/15 bg-black">{yid ? <img src={`https://i.ytimg.com/vi/${yid}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" /> : <span className="text-[22px] text-dim">▶</span>}</div>
              <div>{text("home__hero_video", "YOUTUBE OR TWITCH LINK")}{text("home__hero_video_description", "TEXT BELOW THE VIDEO", true)}</div></div>
          </>) : (<>
            <h3 className="mb-2 mt-5 text-[10px] tracking-[3px] text-[#9cbf4a]">① PHOTO SLIDER</h3>
            <div className="max-w-[420px]">{text(`${cur}__slider_header`, "SLIDER HEADER")}</div>
            <div className="mt-2 grid gap-3 lg:grid-cols-3">{[1, 2, 3].map((i) => card("slider", i, "Slide"))}</div>
            <h3 className="mb-2 mt-5 text-[10px] tracking-[3px] text-[#9cbf4a]">② {P.cards}</h3>
            <div className="max-w-[420px]">{text(`${cur}__cards_header`, "CARDS HEADER")}</div>
            <div className="mt-2 grid gap-3 lg:grid-cols-3">{[1, 2, 3].map((i) => card(P.prefix!, i, P.card!.replace(" Card", "")))}</div>
          </>)}
          <p className="mt-4 text-[10.5px] text-dim">Empty text = the public page keeps its built-in default. Photos come from the Comms Library, the Gallery or a new upload.</p>
        </section>
      </div>

      {changedKeys.length > 0 && (
        <div role="region" aria-label="Unpublished changes" className="fixed bottom-0 left-0 right-0 z-40 flex flex-wrap items-center gap-3 border-t border-amber/60 bg-[#1a1408] px-6 py-3">
          <b className="text-[11.5px] tracking-[2px] text-amber">{changedKeys.length} UNSAVED CHANGE{changedKeys.length === 1 ? "" : "S"}</b>
          <span className="flex-1 text-[11px] text-[#c9b38a]">VISITORS STILL SEE THE OLD VERSION</span>
          <button type="button" onClick={() => void discard()} className={`${btn} border-cyan/30 text-dim`}>↺ DISCARD</button>
          <button type="button" disabled={busy} onClick={() => void publish()} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>{busy ? "PUBLISHING…" : "⇪ PUBLISH CHANGES"}</button>
        </div>)}

      {pick && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-labelledby="wp-t" onKeyDown={(e) => e.key === "Escape" && setPick(null)}>
          <div className="w-full max-w-[780px] border border-cyan/50 bg-[#0b0f15] p-4">
            <div className="mb-3 flex items-center gap-2"><h3 id="wp-t" className="m-0 text-[13px] tracking-[3px] text-cyan">PICK A PHOTO</h3><div className="flex-1" />
              {([["lib", "COMMS LIBRARY"], ["gal", "GALLERY"], ["up", "⤒ UPLOAD"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`${btn} ${tab === k ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>{l}</button>)}
              <button type="button" autoFocus onClick={() => setPick(null)} aria-label="Close" className={`${btn} border-cyan/30 text-dim`}>✕</button></div>
            {tab === "up" ? (
              <label className="grid h-[180px] cursor-pointer place-items-center border border-dashed border-cyan/40 text-center text-[12px] tracking-[1px] text-dim hover:border-cyan">
                <span>{busy ? "UPLOADING…" : <>CHOOSE A PHOTO<br /><small className="text-[10px]">ADDED TO THE COMMS LIBRARY TOO · WIDE PHOTOS (16:9) LOOK BEST · UP TO 10 MB</small></>}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={busy} onChange={(e) => void upload(e.target.files?.[0], pick)} /></label>
            ) : list.length ? (
              <div className="grid max-h-[420px] grid-cols-3 gap-2.5 overflow-auto md:grid-cols-5">{list.map((m) => (
                <button key={m.id} type="button" onClick={() => setPhoto(pick, m.url, m.id)} title={m.name} className="border border-cyan/15 bg-panel p-1.5 text-left hover:border-cyan">
                  <img src={m.url} alt="" loading="lazy" className="h-[70px] w-full object-cover" /><small className="mt-1 block truncate text-[9.5px] text-dim">{m.name || "Untitled"}</small></button>))}</div>
            ) : <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">{tab === "lib" ? "THE COMMS LIBRARY IS EMPTY — UPLOAD A PHOTO" : "NO VISIBLE GALLERY IMAGES"}</p>}
          </div></div>)}
      {toast && <div role="status" className={`fixed bottom-20 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-bad/50 bg-[#1a0a0a] text-bad"}`}>{toast[0]}</div>}
    </main>
  );
}
