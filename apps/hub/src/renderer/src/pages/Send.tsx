import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SendData, SentMsg } from "../../../preload/api";

/**
 * COMMS → SEND MESSAGE in the app — same as the Terminal's send-message.js, plus (approved mock 2026-11-11):
 * type @ for people / roles, # for channels, : for server emoji — picked from a list, sent as Discord codes.
 * 😀 emoji picker (server emoji + common emoji) · GIF from a link or the Media gallery.
 * Cortana posts as itself (bot_jobs message.send / edit / delete).
 */
const COLORS: [string, number][] = [["505 BLUE", 0x194a77], ["CYAN", 0x00d9ff], ["GREEN", 0x22e07a], ["AMBER", 0xf59e0b], ["RED", 0xff4d4d]];
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const EMOJI = "😀 😂 🙂 😉 😎 🤔 😮 😢 😡 👍 👎 👏 🙏 💪 🫡 👋 🔥 ⭐ ✅ ❌ ⚠️ ❗ ❓ 🎉 🎖️ 🏅 🎯 🪖 🚁 ✈️ 🚀 💥 🛡️ ⚔️ 🔫 📢 📌 📅 ⏰ 🕐 📝 📑 🔒 🔓 ➡️ ⬆️ 🟢 🟡 🔴 🔵 ❤️ 💙 🇬🇧 🏴󠁧󠁢󠁳󠁣󠁴󠁿".split(" ");
type Btn = { label: string; url: string };
type V = { channelId: string; kind: "text" | "embed"; content: string; title: string; description: string; color: number; image: string; thumbnail: boolean; buttons: Btn[]; everyone: boolean; roles: string[]; runAt: string };
type Field = "content" | "title" | "description";
type Opt = { label: string; code: string; sub?: string; img?: string; color?: string };
const blank = (): V => ({ channelId: "", kind: "embed", content: "", title: "", description: "", color: 0x194a77, image: "", thumbnail: true, buttons: [], everyone: false, roles: [], runAt: "" });
const isGif = (u: string) => /^https:\/\/\S+$/.test(u);

export function Send() {
  const [d, setD] = useState<SendData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<V>(blank);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<SentMsg | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [pick, setPick] = useState<{ f: Field; ch: string; q: string; at: number; i: number } | null>(null);
  const [emojiFor, setEmojiFor] = useState<Field | null>(null);
  const [gif, setGif] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const boxes = useRef<Partial<Record<Field, HTMLTextAreaElement | HTMLInputElement | null>>>({});
  const load = useCallback(async () => { const r = await window.cn.hub.send(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (["discord_messages", "discord_channels", "discord_roles", "discord_emojis"].includes(x)) { clearTimeout(t); t = setTimeout(() => void load(), 500); } });
    return () => { off(); clearTimeout(t); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  const set = (k: Partial<V>) => setV((x) => ({ ...x, ...k }));

  /** Everything you can pick after @ / # / : */
  const opts = useMemo(() => {
    if (!d) return { "@": [], "#": [], ":": [] } as Record<string, Opt[]>;
    return {
      "@": [...d.members.map((m) => ({ label: "@" + m.name, code: `<@${m.discordId}>`, sub: "MEMBER" })), ...d.roles.map((r) => ({ label: "@" + r.name, code: `<@&${r.id}>`, sub: "ROLE", color: r.color }))],
      "#": d.channels.map((c) => ({ label: "#" + c.name, code: `<#${c.id}>`, sub: c.parentName.toUpperCase() })),
      ":": d.emojis.map((e) => ({ label: `:${e.name}:`, code: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`, img: e.url })),
    } as Record<string, Opt[]>;
  }, [d]);
  const matches = pick ? opts[pick.ch]!.filter((o) => o.label.slice(1).toLowerCase().includes(pick.q.toLowerCase())).slice(0, 8) : [];

  /** Watch typing for @ # : and open the picker. */
  const onType = (f: Field, val: string, caret: number) => {
    set({ [f]: val } as Partial<V>);
    const m = /(^|\s)([@#:])([^\s@#:]{0,30})$/.exec(val.slice(0, caret));
    setPick(m && (m[2] !== ":" || m[3]!.length >= 1) ? { f, ch: m[2]!, q: m[3]!, at: caret - m[3]!.length - 1, i: 0 } : null);
  };
  /** Put text at the caret (or replace the @query) and remember its Discord code. */
  const insert = (f: Field, label: string, code: string | null, from?: number) => {
    const el = boxes.current[f];
    const cur = v[f];
    const s = from ?? el?.selectionStart ?? cur.length, e = el?.selectionEnd ?? cur.length;
    const end = from != null ? (pick ? from + 1 + pick.q.length : e) : e;
    const next = cur.slice(0, s) + label + " " + cur.slice(end);
    set({ [f]: next } as Partial<V>);
    if (code) setRefs((r) => ({ ...r, [label]: code }));
    setPick(null);
    requestAnimationFrame(() => { el?.focus(); const p = s + label.length + 1; el?.setSelectionRange(p, p); });
  };
  /** Readable tokens → Discord codes (longest first so "@Sgt. S. Raven" beats "@Sgt"). */
  const toCodes = (t: string) => Object.keys(refs).sort((a, b) => b.length - a.length).reduce((s, k) => s.split(k).join(refs[k]!), t);
  const keyNav = (e: React.KeyboardEvent) => {
    if (!pick || !matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setPick({ ...pick, i: (pick.i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length }); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); const o = matches[pick.i]!; insert(pick.f, o.label, o.code, pick.at); }
    else if (e.key === "Escape") setPick(null);
  };

  const problem = (() => {
    if (!editing && !v.channelId) return "Pick a channel.";
    if (v.kind === "text" && !v.content.trim()) return "Type a message.";
    if (v.kind === "embed" && !v.title.trim() && !v.description.trim() && !v.image) return "Add a title, message or image.";
    if (v.image && !/^https:\/\//.test(v.image)) return "Image link must start with https://";
    for (const b of v.buttons) if (b.label || b.url) { if (!b.label.trim()) return "A button needs a label."; if (!/^https:\/\/\S+$/.test(b.url)) return `Button "${b.label}" needs an https:// link.`; }
    if (v.runAt && Date.parse(v.runAt) < Date.now() - 60000) return "Schedule time is in the past.";
    return "";
  })();

  const submit = async () => {
    if (problem || busy) return;
    if (!editing && v.everyone && !confirm("PING @EVERYONE?\n\nThis notifies every member of the Discord server.")) return;
    const body = { content: toCodes(v.content), embed: v.kind === "embed" ? { title: toCodes(v.title).trim(), description: toCodes(v.description), color: v.color, image: v.image.trim(), thumbnail: v.thumbnail } : null,
      buttons: v.buttons.filter((b) => b.label.trim()).map((b) => ({ label: b.label.trim(), url: b.url.trim() })) };
    setBusy(true);
    const r = await window.cn.hub.sendAction(editing ? { action: "edit", recordId: editing.id, ...body }
      : { action: "send", channelId: v.channelId, ping: { everyone: v.everyone, roles: v.roles }, runAtISO: v.runAt ? new Date(v.runAt).toISOString() : null, ...body });
    setBusy(false);
    setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]);
    if (!r.error) { setV(blank()); setRefs({}); setEditing(null); void load(); }
  };
  const del = async (m: SentMsg) => {
    if (!confirm(`DELETE THIS MESSAGE FROM #${m.channelName.toUpperCase()}?\n\nIt is removed from Discord. This can't be undone.`)) return;
    const r = await window.cn.hub.sendAction({ action: "delete", recordId: m.id });
    setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), true]); void load();
  };
  const edit = (m: SentMsg) => {
    setEditing(m); setRefs({});
    setV({ ...blank(), kind: m.embed ? "embed" : "text", content: m.content, title: m.embed?.title ?? "", description: m.embed?.description ?? "", color: m.embed?.color ?? 0x194a77, image: m.embed?.image ?? "", thumbnail: m.embed?.thumbnail ?? true, buttons: m.buttons });
  };
  const addGif = (url: string) => {
    if (!isGif(url)) return setToast(["Link must start with https://", false]);
    if (v.kind === "embed") set({ image: url }); else set({ content: (v.content.trim() ? v.content.trimEnd() + "\n" : "") + url });
    setGif(false); setGifUrl("");
  };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;

  const fld = "w-full border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-cyan";
  const lbl = "mb-1.5 mt-3.5 block text-[9.5px] tracking-[2px] text-dim";
  const chip = (on: boolean) => `border px-2.5 py-1 text-[10.5px] tracking-[1.5px] ${on ? "border-cyan text-cyan" : "border-cyan/15 text-dim hover:text-white"}`;
  const btn = "border border-cyan/30 px-2.5 py-1 text-[10.5px] tracking-[1.5px] text-white hover:bg-cyan/10";
  const groups = new Map<string, typeof d.channels>();
  for (const c of d.channels) { const k = c.parentName || "NO CATEGORY"; groups.set(k, [...(groups.get(k) ?? []), c]); }
  /** A text box with @ # : picking, plus 😀 and GIF buttons. */
  const box = (f: Field, label: string, rows: number, max: number) => (
    <div className="relative">
      <div className="flex items-end justify-between"><label htmlFor={`sm-${f}`} className={lbl}>{label}</label>
        <span className="mb-1.5 flex gap-1"><button type="button" onClick={() => setEmojiFor(emojiFor === f ? null : f)} aria-label="Add emoji" className={btn}>😀</button>
          {f !== "title" && <button type="button" onClick={() => setGif(true)} className={btn}>GIF</button>}</span></div>
      {rows > 1
        ? <textarea id={`sm-${f}`} ref={(el) => { boxes.current[f] = el; }} value={v[f]} rows={rows} maxLength={max} onKeyDown={keyNav} onBlur={() => setTimeout(() => setPick(null), 150)}
            onChange={(e) => onType(f, e.target.value, e.target.selectionStart)} placeholder="Type @ to tag someone, # for a channel, : for server emoji" className={`${fld} resize-y`} />
        : <input id={`sm-${f}`} ref={(el) => { boxes.current[f] = el; }} value={v[f]} maxLength={max} onKeyDown={keyNav} onBlur={() => setTimeout(() => setPick(null), 150)}
            onChange={(e) => onType(f, e.target.value, e.target.selectionStart ?? e.target.value.length)} className={fld} />}
      {pick?.f === f && <div role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-[260px] overflow-auto border border-cyan/40 bg-panel shadow-[0_14px_34px_rgba(0,0,0,.6)]">
        {matches.length ? matches.map((o, i) => (
          <button key={o.code} type="button" role="option" aria-selected={i === pick.i} onMouseDown={(e) => { e.preventDefault(); insert(f, o.label, o.code, pick.at); }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] ${i === pick.i ? "bg-cyan/15 text-white" : "text-[#d6dde6] hover:bg-cyan/10"}`}>
            {o.img && <img src={o.img} alt="" className="h-5 w-5" />}<span style={o.color && o.color !== "#000000" ? { color: o.color } : undefined}>{o.label}</span>
            {o.sub && <small className="ml-auto text-[9px] tracking-[1.5px] text-dimmer">{o.sub}</small>}</button>))
          : <p className="px-3 py-2 text-[11px] text-dimmer">No match for “{pick.q}”{pick.ch === ":" && !d.emojis.length ? " — restart Cortana to sync server emoji" : ""}</p>}
      </div>}
      {emojiFor === f && <div className="absolute right-0 z-30 mt-1 w-[330px] border border-cyan/40 bg-panel p-2.5 shadow-[0_14px_34px_rgba(0,0,0,.6)]">
        {d.emojis.length > 0 && <><div className="mb-1 text-[9px] tracking-[2px] text-dim">505TH SERVER</div>
          <div className="mb-2 flex max-h-[120px] flex-wrap gap-1 overflow-auto">{d.emojis.map((e) => (
            <button key={e.id} type="button" title={`:${e.name}:`} onClick={() => { insert(f, `:${e.name}:`, `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`); setEmojiFor(null); }} className="grid h-8 w-8 place-items-center hover:bg-cyan/10"><img src={e.url} alt={e.name} className="h-6 w-6" /></button>))}</div></>}
        <div className="mb-1 text-[9px] tracking-[2px] text-dim">COMMON</div>
        <div className="flex flex-wrap gap-1">{EMOJI.map((e) => <button key={e} type="button" onClick={() => { insert(f, e, null); setEmojiFor(null); }} className="grid h-8 w-8 place-items-center text-[18px] hover:bg-cyan/10">{e}</button>)}</div>
      </div>}
    </div>);
  /** Preview: show tagged names as blue Discord pills. */
  const pretty = (t: string) => {
    const keys = Object.keys(refs).filter((k) => refs[k]!.startsWith("<@") || refs[k]!.startsWith("<#")).sort((a, b) => b.length - a.length);
    const emo = Object.keys(refs).filter((k) => /^<a?:/.test(refs[k]!));
    if (!keys.length && !emo.length) return t;
    const re = new RegExp(`(${[...keys, ...emo].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
    return t.split(re).map((part, i) => keys.includes(part) ? <span key={i} className="rounded-sm bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">{part}</span>
      : emo.includes(part) ? <img key={i} src={d.emojis.find((e) => refs[part]!.includes(e.id))?.url} alt={part} className="inline h-5 w-5 align-text-bottom" /> : part);
  };
  const pings = [v.everyone ? "@everyone" : "", ...v.roles.map((r) => "@" + (d.roles.find((x) => x.id === r)?.name ?? "role"))].filter(Boolean);
  const emb = v.kind === "embed" && (v.title || v.description || v.image);
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Send Message">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">SEND MESSAGE</h1>
      <p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">POST OR EDIT A MESSAGE AS CORTANA · PLAIN TEXT OR EMBED · @ TAGS, EMOJI AND GIFS · LIVE PREVIEW</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <section className="border border-cyan/15 bg-panel p-4" aria-label="Compose">
          {editing ? <div className="flex items-center gap-2 border border-amber/50 bg-amber/5 px-3 py-2 text-[11px] tracking-[1px] text-amber">✎ EDITING A MESSAGE IN #{editing.channelName.toUpperCase()} · PINGS ARE NOT SENT AGAIN
              <button type="button" onClick={() => { setEditing(null); setV(blank()); setRefs({}); }} className={`${btn} ml-auto`}>CANCEL EDIT</button></div>
            : <><label htmlFor="sm-ch" className={`${lbl} mt-0`}>CHANNEL</label>
              <select id="sm-ch" value={v.channelId} onChange={(e) => set({ channelId: e.target.value })} className={fld}>
                <option value="">— pick a channel —</option>{[...groups].map(([g, cs]) => <optgroup key={g} label={g.toUpperCase()}>{cs.map((c) => <option key={c.id} value={c.id} disabled={!c.canSend}># {c.name}{c.canSend ? "" : " (Cortana can't post)"}</option>)}</optgroup>)}</select>
              {!d.channels.length && <p className="mt-1 text-[11px] text-dimmer">No channels yet — Cortana syncs them when it starts.</p>}</>}
          <span className={lbl}>TYPE</span>
          <div className="flex gap-1.5" role="radiogroup">{(["text", "embed"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={v.kind === k} onClick={() => set({ kind: k })} className={chip(v.kind === k)}>{k.toUpperCase()}</button>)}</div>
          {!editing && <><span className={lbl}>PING</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => set({ everyone: false, roles: [] })} className={chip(!v.everyone && !v.roles.length)}>NONE</button>
              <button type="button" aria-pressed={v.everyone} onClick={() => set({ everyone: !v.everyone })} className={v.everyone ? "border border-amber px-2.5 py-1 text-[10.5px] text-amber" : chip(false)}>@everyone</button>
              {v.roles.map((r) => <span key={r} className="border border-cyan px-2.5 py-1 text-[10.5px] text-cyan">@{d.roles.find((x) => x.id === r)?.name ?? "role"} <button type="button" aria-label="Remove role" onClick={() => set({ roles: v.roles.filter((x) => x !== r) })}>✕</button></span>)}
              <select value="" aria-label="Add a role to ping" onChange={(e) => e.target.value && set({ roles: [...v.roles, e.target.value] })} className="border border-cyan/15 bg-[#070a0f] px-2 py-1 text-[10.5px] text-dim">
                <option value="">＋ ROLE</option>{d.roles.filter((r) => !v.roles.includes(r.id)).map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}</select>
            </div></>}
          {box("content", v.kind === "embed" ? "TEXT ABOVE THE EMBED (OPTIONAL)" : "MESSAGE · **bold** *italic*", v.kind === "embed" ? 2 : 6, 1900)}
          {v.kind === "embed" && <>
            {box("title", "TITLE", 1, 256)}
            {box("description", "MESSAGE · **bold** *italic*", 6, 4000)}
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <div><span className={lbl}>COLOUR</span><div className="flex flex-wrap gap-1.5">{COLORS.map(([l, c]) => <button key={c} type="button" aria-pressed={v.color === c} onClick={() => set({ color: c })} className={chip(v.color === c)} style={v.color === c ? { borderColor: hex(c), color: hex(c) } : undefined}>{l}</button>)}</div></div>
              <div><span className={lbl}>505 LOGO</span><button type="button" aria-pressed={v.thumbnail} onClick={() => set({ thumbnail: !v.thumbnail })} className={chip(v.thumbnail)}>{v.thumbnail ? "ON" : "OFF"}</button></div>
            </div>
            <label htmlFor="sm-img" className={lbl}>IMAGE OR GIF (OPTIONAL)</label>
            <div className="flex gap-1.5"><input id="sm-img" value={v.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://… or pick from Media" className={fld} />
              <button type="button" onClick={() => setGif(true)} className={btn}>🖼 MEDIA</button>{v.image && <button type="button" aria-label="Remove image" onClick={() => set({ image: "" })} className={btn}>✕</button>}</div></>}
          <span className={lbl}>LINK BUTTONS (OPTIONAL · UP TO 5)</span>
          {v.buttons.map((b, i) => <div key={i} className="mb-1.5 grid grid-cols-[1fr_1.4fr_auto] gap-1.5">
            <input value={b.label} maxLength={80} aria-label="Button label" placeholder="Label" onChange={(e) => set({ buttons: v.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={fld} />
            <input value={b.url} aria-label="Button link" placeholder="https://…" onChange={(e) => set({ buttons: v.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} className={fld} />
            <button type="button" aria-label="Remove button" onClick={() => set({ buttons: v.buttons.filter((_, j) => j !== i) })} className={btn}>✕</button></div>)}
          {v.buttons.length < 5 && <button type="button" onClick={() => set({ buttons: [...v.buttons, { label: "", url: "" }] })} className={btn}>＋ BUTTON</button>}
          {!editing && <><label htmlFor="sm-run" className={lbl}>⏰ SCHEDULE (OPTIONAL · UK TIME)</label>
            <input id="sm-run" type="datetime-local" value={v.runAt} onChange={(e) => set({ runAt: e.target.value })} className={`${fld} max-w-[260px]`} /></>}
          <div className="mt-4 flex items-center gap-2 border-t border-cyan/15 pt-3">
            <span role="status" className="flex-1 text-[11px] text-amber">{problem ? "▲ " + problem : ""}</span>
            <button type="button" onClick={() => { setV(blank()); setRefs({}); setEditing(null); }} className={btn}>CLEAR</button>
            <button type="button" disabled={!!problem || busy} onClick={() => void submit()} className="border border-gold bg-gold/15 px-4 py-1.5 text-[11px] tracking-[2px] text-gold disabled:opacity-40">
              {busy ? "SENDING…" : editing ? "SAVE EDIT" : v.runAt ? "SCHEDULE" : "SEND AS CORTANA"}</button>
          </div>
        </section>
        <div>
          <span className={`${lbl} mt-0`}>LIVE PREVIEW</span>
          <div className="rounded-md bg-[#313338] p-3.5 font-sans text-[14px] leading-snug text-[#dbdee1]">
            <div className="mb-1 flex items-center gap-2"><i className="h-9 w-9 rounded-full bg-cyan/30" /><b className="text-white">Cortana</b><span className="rounded-sm bg-[#5865f2] px-1 text-[10px] text-white">APP</span></div>
            {pings.length > 0 && !editing && <div className="mb-1 ml-11">{pings.map((x) => <span key={x} className="mr-1 rounded-sm bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">{x}</span>)}</div>}
            {v.content && <div className="mb-1 ml-11 whitespace-pre-wrap break-words">{pretty(v.content)}</div>}
            {emb && <div className="ml-11 max-w-[440px] rounded border-l-4 bg-[#2b2d31] p-3" style={{ borderColor: hex(v.color) }}>
              <div className="flex gap-2.5"><div className="min-w-0 flex-1">{v.title && <div className="mb-1 font-semibold text-white">{pretty(v.title)}</div>}{v.description && <div className="whitespace-pre-wrap break-words text-[13.5px]">{pretty(v.description)}</div>}</div>
                {v.thumbnail && <div className="h-14 w-14 shrink-0 rounded bg-cyan/20" />}</div>
              {v.image && <img src={v.image} alt="" className="mt-2 max-h-[260px] rounded" />}
              <div className="mt-2 text-[11px] text-[#949ba4]">505th Expeditionary Force · sent by you</div></div>}
            {v.buttons.some((b) => b.label) && <div className="ml-11 mt-1.5 flex flex-wrap gap-1.5">{v.buttons.filter((b) => b.label).map((b, i) => <span key={i} className="rounded bg-[#4e5058] px-3 py-1 text-[13px] text-white">{b.label} ↗</span>)}</div>}
            {!v.content && !emb && <div className="ml-11 text-[#949ba4]">Nothing to send yet.</div>}
          </div>
          <section className="mt-4 border border-cyan/15 bg-panel" aria-label="Recently sent">
            <div className="border-b border-cyan/15 px-3.5 py-2.5 font-head text-[13px] font-bold tracking-[3px] text-cyan">RECENTLY SENT</div>
            {d.sent.length ? <table className="w-full border-collapse text-[11.5px]"><tbody>{d.sent.slice(0, 15).map((m) => (
              <tr key={m.id} className="rrow border-b border-white/5"><td className="max-w-[200px] truncate px-3 py-2 text-white">{(m.embed?.title || m.content || "(image)").slice(0, 50)}</td><td className="px-2 text-dim">#{m.channelName}</td><td className="px-2 text-dim">{m.sentByName}</td>
                <td className="whitespace-nowrap px-2 text-dimmer">{m.sentAtISO ? new Date(m.sentAtISO).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : ""}</td>
                <td className="whitespace-nowrap px-2 text-right">{m.kind !== "upload" && <button type="button" onClick={() => edit(m)} className={btn}>EDIT</button>} <button type="button" aria-label="Delete" onClick={() => void del(m)} className="border border-bad/60 px-2 py-1 text-[10.5px] text-bad">🗑</button></td></tr>))}</tbody></table>
              : <p className="py-8 text-center text-[11px] tracking-[2px] text-dimmer">NOTHING SENT YET</p>}
          </section>
        </div>
      </div>
      {gif && <div role="dialog" aria-modal="true" aria-label="Add a GIF or image" className="fixed inset-0 z-40 grid place-items-center bg-black/70" onClick={() => setGif(false)}>
        <div className="max-h-[80vh] w-[760px] overflow-auto border border-cyan/40 bg-panel p-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center"><b className="font-head text-[16px] tracking-[3px] text-cyan">ADD A GIF OR IMAGE</b><button type="button" aria-label="Close" onClick={() => setGif(false)} className="ml-auto text-dim hover:text-white">✕</button></div>
          <label htmlFor="sm-gif" className="mb-1.5 block text-[9.5px] tracking-[2px] text-dim">PASTE A LINK (TENOR, GIPHY OR ANY https:// IMAGE)</label>
          <div className="mb-4 flex gap-1.5"><input id="sm-gif" autoFocus value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGif(gifUrl.trim())} placeholder="https://tenor.com/view/…" className={fld} />
            <button type="button" onClick={() => addGif(gifUrl.trim())} className="border border-gold bg-gold/15 px-3 text-[11px] tracking-[1.5px] text-gold">ADD</button></div>
          <div className="mb-1.5 text-[9.5px] tracking-[2px] text-dim">OR PICK FROM MEDIA</div>
          <div className="grid grid-cols-4 gap-2">{d.gallery.length ? d.gallery.map((g) => <button key={g.id} type="button" onClick={() => addGif(g.url)} aria-label={g.name || "image"} className="tile aspect-video overflow-hidden border border-cyan/15 hover:border-cyan"><img src={g.url} alt="" loading="lazy" className="h-full w-full object-cover" /></button>)
            : <p className="col-span-4 py-6 text-center text-[11px] text-dimmer">No images in Media yet.</p>}</div>
          {v.kind === "text" && <p className="mt-3 text-[10.5px] text-dimmer">In a TEXT message the link is added to the end — Discord shows it as a GIF.</p>}
        </div></div>}
      {toast && <div role="status" className={`fixed bottom-3 left-1/2 z-50 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] ${toast[1] ? "border-ok text-ok" : "border-bad text-bad"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
