import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MsgData } from "../../../preload/api";
import { askBox } from "../components/Confirm";
import { FileWindow } from "./Personnel";

/**
 * MESSAGES in the app (H3b, approved mock 2026-11-11) — the same chats as the website Terminal.
 * Chat list (pinned first, unread counts, online dots, ALL / UNREAD / GROUPS) · chat (day dividers, images, 👍 reactions,
 * ✓✓ SEEN, "typing…") · side panel (person, mute, pin, shared images). Live through the 505th Net ("conversations").
 */
const COLS = ["#00d9ff", "#22e07a", "#f59e0b", "#8b93f8", "#f472b6", "#2dd4bf", "#fb923c"];
const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🫡"];
const PICK = "😀 😂 🙂 😉 😎 🤔 😮 😢 😡 👍 👎 👏 🙏 💪 🫡 👋 🔥 ⭐ ✅ ❌ ⚠️ 🎉 🎖️ 🪖 🚁 🚀 💥 🛡️ 📢 📌 📅 ⏰ 📝 🟢 🔴 ❤️".split(" ");
const col = (uid: string) => COLS[[...uid].reduce((s, c) => s + c.charCodeAt(0), 0) % COLS.length]!;
const ini = (n: string) => (n.replace(/^[A-Za-z0-9]+\.\s*/, "").replace(/["“”]/g, "").match(/\b\w/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();
const hm = (iso: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const when = (iso: string) => { if (!iso) return ""; const d = new Date(iso), t = new Date(); const days = Math.floor((+new Date(t.toDateString()) - +new Date(d.toDateString())) / 864e5);
  return days === 0 ? hm(iso) : days === 1 ? "Yesterday" : days < 7 ? d.toLocaleDateString("en-GB", { weekday: "short" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const dayLabel = (iso: string) => { const d = new Date(iso), t = new Date(); const days = Math.floor((+new Date(t.toDateString()) - +new Date(d.toDateString())) / 864e5);
  return days === 0 ? "TODAY" : days === 1 ? "YESTERDAY" : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(); };

export function Messages(p: { me: string }) {
  const [d, setD] = useState<MsgData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "unread" | "groups">("all");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(true);
  const [emo, setEmo] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const lastType = useRef(0);
  const selRef = useRef(sel); selRef.current = sel;

  const load = useCallback(async (conv = selRef.current) => {
    try { const r = await window.cn.hub.messages(conv ?? undefined); if (!r || "error" in r) setError(r?.error ?? "No answer"); else { setD(r); setError(null); } }
    catch { setError("This page needs an app restart"); }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "conversations" || x === "presence_sessions") { clearTimeout(t); t = setTimeout(() => void load(), 250); } });
    const poll = setInterval(() => void load(), 30_000);
    return () => { off(); clearTimeout(t); clearInterval(poll); };
  }, [load]);
  // Open a chat → load its messages + mark read.
  useEffect(() => { if (!sel) return; void load(sel).then(() => window.cn.hub.messagesAction({ action: "read", convId: sel })); }, [sel, load]);
  const cur = d?.convs.find((c) => c.id === sel) ?? null;
  // New messages arriving in the open chat → mark read, scroll down.
  const count = d?.messages?.length ?? 0;
  useEffect(() => { body.current?.scrollTo({ top: body.current.scrollHeight }); if (cur?.unread) void window.cn.hub.messagesAction({ action: "read", convId: cur.id }); }, [count, cur?.id, cur?.unread]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const person = useCallback((uid: string) => d?.people.find((x) => x.uid === uid), [d]);
  const nameOf = (uid: string) => person(uid)?.name ?? "Unknown";
  const title = (c: MsgData["convs"][number]) => c.name || c.participants.filter((x) => x !== d?.me).map(nameOf).join(", ") || "Just you";
  const isGroup = (c: MsgData["convs"][number]) => c.participants.length > 2 || !!c.name;
  const Av = ({ uid, s = 34, dot = false }: { uid: string; s?: number; dot?: boolean }) => <span className="relative shrink-0" style={{ width: s, height: s }}>
    {person(uid)?.photo ? <img src={person(uid)!.photo!} alt="" className="h-full w-full rounded-full object-cover" /> : <i className="grid h-full w-full place-items-center rounded-full font-bold not-italic text-black" style={{ background: col(uid), fontSize: s * 0.33 }}>{ini(nameOf(uid))}</i>}
    {dot && <i className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-panel" style={{ background: person(uid)?.online ? "#22e07a" : "#4b5765" }} />}</span>;
  const list = useMemo(() => (d?.convs ?? []).filter((c) => (f === "all" || (f === "unread" ? c.unread > 0 : isGroup(c))) && (title(c) + " " + c.lastMessage).toLowerCase().includes(q.toLowerCase())), [d, f, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (img?: string) => {
    if (!cur || busy || (!text.trim() && !img)) return;
    setBusy(true);
    const r = await window.cn.hub.messagesAction({ action: "send", convId: cur.id, text: img ? "" : text, imageUrl: img });
    setBusy(false);
    if (r.error) setToast(r.error); else { if (!img) setText(""); void load(); }
  };
  const upload = async (fl: File | undefined) => {
    if (!fl || !cur) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(fl.type) || fl.size > 10e6) return setToast("Images only (PNG, JPG, WEBP, GIF), up to 10 MB");
    setBusy(true);
    const r = await window.cn.hub.upload("505th_msg", fl.name, fl.type, new Uint8Array(await fl.arrayBuffer()));
    setBusy(false);
    if (r.url) void send(r.url); else setToast(r.error ?? "Upload failed");
  };
  const act = async (b: Record<string, unknown>) => { const r = await window.cn.hub.messagesAction(b); if (r.error) setToast(r.error); void load(); return r; };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const totalUnread = d.convs.reduce((s, c) => s + c.unread, 0);
  const other = cur && !isGroup(cur) ? cur.participants.find((x) => x !== d.me) ?? null : null;
  const chip = (k: typeof f, l: string) => <button type="button" aria-pressed={f === k} onClick={() => setF(k)} className={`border px-2.5 py-0.5 text-[10px] tracking-[1.5px] ${f === k ? "border-cyan text-cyan" : "border-cyan/15 text-dim hover:text-white"}`}>{l}</button>;
  let lastDay = "";
  return (
    <main className={`grid min-h-0 min-w-0 flex-1 ${info && cur ? "grid-cols-[300px_1fr_260px]" : "grid-cols-[300px_1fr]"}`} aria-label="Messages">
      {/* list */}
      <section className="flex min-h-0 flex-col border-r border-cyan/15 bg-panel" aria-label="Chats">
        <div className="flex flex-col gap-2 border-b border-cyan/15 p-3">
          <div className="flex items-center gap-2"><b className="flex-1 font-head text-[15px] tracking-[3px] text-cyan">MESSAGES</b><button type="button" onClick={() => setNewChat(true)} title="New chat" className="border border-gold bg-gold/15 px-2.5 py-1 text-[11px] tracking-[1.5px] text-gold">✎ NEW</button></div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search chats…" aria-label="Search chats" className="border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
          <div className="flex gap-1.5">{chip("all", "ALL")}{chip("unread", `UNREAD${totalUnread ? " " + totalUnread : ""}`)}{chip("groups", "GROUPS")}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {list.map((c) => { const o = c.participants.find((x) => x !== d.me) ?? d.me; return (
            <button key={c.id} type="button" aria-current={c.id === sel} onClick={() => { setSel(c.id); setEmo(false); }}
              className={`flex w-full items-center gap-2.5 border-b border-white/5 px-3 py-2.5 text-left ${c.id === sel ? "bg-cyan/10 shadow-[inset_3px_0_0_#00d9ff]" : "hover:bg-cyan/5"}`}>
              {isGroup(c) ? <i className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gold font-bold not-italic text-black">#</i> : <Av uid={o} dot />}
              <span className="min-w-0 flex-1"><b className={`block truncate text-[12.5px] ${c.unread ? "font-semibold text-white" : "font-normal text-[#d6dde6]"}`}>{c.pinned && "📌 "}{c.muted && "🔕 "}{title(c)}{isGroup(c) && <span className="ml-1 text-[9px] text-dim">· {c.participants.length}</span>}</b>
                <small className="block truncate text-[11px] text-dim">{c.typing.length ? <span className="text-cyan">typing…</span> : <>{c.lastSenderUid === d.me ? "You: " : isGroup(c) && c.lastSenderUid ? `${nameOf(c.lastSenderUid).split(" ").pop()}: ` : ""}{c.lastMessage || "No messages yet"}</>}</small></span>
              <span className="shrink-0 text-right text-[10px] text-dimmer">{when(c.lastMessageAt)}{c.unread > 0 && <span className="mt-1 block"><span className="rounded-full bg-bad px-1.5 text-[10px] text-white">{c.unread}</span></span>}</span>
            </button>); })}
          {!list.length && <p className="px-4 py-10 text-center text-[11px] tracking-[2px] text-dimmer">{d.convs.length ? "NO CHATS MATCH" : "NO CHATS YET — PRESS ✎ NEW"}</p>}
        </div>
      </section>
      {/* chat */}
      <section className="flex min-h-0 min-w-0 flex-col" aria-label="Chat">
        {!cur ? <p className="m-auto text-[11px] tracking-[2px] text-dimmer">PICK A CHAT ON THE LEFT</p> : <>
          <div className="flex items-center gap-2.5 border-b border-cyan/15 px-4 py-2.5">
            {other ? <Av uid={other} dot /> : <i className="grid h-[34px] w-[34px] place-items-center rounded-full bg-gold font-bold not-italic text-black">#</i>}
            <div className="min-w-0 flex-1"><b className="block truncate font-head text-[15px] tracking-[1.5px] text-white">{title(cur).toUpperCase()}</b>
              <small className="text-[10.5px]">{other ? (person(other)?.online ? <span className="text-ok">● ONLINE</span> : <span className="text-dim">○ OFFLINE</span>) : <span className="text-dim">{cur.participants.length} PEOPLE</span>}</small></div>
            <button type="button" aria-label={cur.pinned ? "Unpin chat" : "Pin chat"} title={cur.pinned ? "Unpin" : "Pin to top"} onClick={() => void act({ action: "pin", convId: cur.id, on: !cur.pinned })} className={`h-8 w-8 border ${cur.pinned ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>📌</button>
            <button type="button" aria-label="Chat info" aria-pressed={info} onClick={() => setInfo(!info)} className={`h-8 w-8 border ${info ? "border-cyan text-cyan" : "border-cyan/20 text-dim"}`}>ⓘ</button>
          </div>
          <div ref={body} className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-5 py-3.5" aria-live="polite">
            {(d.messages ?? []).map((m, i, all) => {
              const mine = m.senderUid === d.me, day = dayLabel(m.at), showDay = day !== lastDay; lastDay = day;
              const seen = mine && i === all.length - 1 && m.readBy.some((u) => u !== d.me);
              return <div key={m.id} className="contents">
                {showDay && <div className="my-1 flex items-center gap-2.5 text-[10px] tracking-[2px] text-dimmer before:h-px before:flex-1 before:bg-cyan/15 after:h-px after:flex-1 after:bg-cyan/15">{day}</div>}
                <div className={`group flex max-w-[72%] gap-2 ${mine ? "flex-row-reverse self-end" : ""}`}>
                  {!mine && <Av uid={m.senderUid} s={28} />}
                  <div className="min-w-0">
                    <div className={`border px-3 py-1.5 text-[13px] ${mine ? "border-cyan/30 bg-cyan/10" : "border-white/5 bg-panel2"}`}>
                      {!mine && isGroup(cur) && <b className="block text-[11px] font-semibold" style={{ color: col(m.senderUid) }}>{nameOf(m.senderUid)}</b>}
                      {m.text && <span className="whitespace-pre-wrap break-words text-[#e3eaf0]">{m.text}</span>}
                      {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noreferrer"><img src={m.imageUrl} alt="Image" loading="lazy" className="mt-1 max-h-[260px] max-w-[300px] border border-cyan/15" /></a>}
                      <small className="mt-0.5 block text-[9.5px] text-dimmer">{hm(m.at)}{seen && " · ✓✓ SEEN"}</small>
                    </div>
                    <div className={`mt-0.5 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
                      {Object.entries(m.reactions).filter(([, u]) => u.length).map(([e, u]) => <button key={e} type="button" title={u.map(nameOf).join(", ")} onClick={() => void act({ action: "react", convId: cur.id, messageId: m.id, emoji: e })}
                        className={`rounded-full border px-1.5 text-[11px] ${u.includes(d.me) ? "border-cyan bg-cyan/10" : "border-cyan/20"}`}>{e} {u.length}</button>)}
                      <span className="invisible flex gap-0.5 group-hover:visible">{EMOJI.map((e) => <button key={e} type="button" aria-label={`React ${e}`} onClick={() => void act({ action: "react", convId: cur.id, messageId: m.id, emoji: e })} className="text-[13px] opacity-60 hover:opacity-100">{e}</button>)}</span>
                    </div>
                  </div>
                </div></div>; })}
            {!(d.messages ?? []).length && <p className="m-auto text-[11px] tracking-[2px] text-dimmer">SAY HELLO 👋</p>}
          </div>
          {cur.typing.length > 0 && <div className="px-5 pb-1 text-[11px] text-dim"><span className="mr-1 inline-flex gap-0.5">{[0, 1, 2].map((i) => <i key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" style={{ animationDelay: `${i * 150}ms` }} />)}</span>{cur.typing.map((u) => nameOf(u).split(" ").pop()).join(", ")} {cur.typing.length > 1 ? "are" : "is"} typing…</div>}
          <div className="relative flex items-end gap-1.5 border-t border-cyan/15 px-3.5 py-2.5">
            <label className="grid h-[34px] w-[34px] shrink-0 cursor-pointer place-items-center border border-cyan/20 text-[15px] text-dim hover:text-white" title="Send an image" aria-label="Send an image">🖼<input type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button type="button" aria-label="Emoji" aria-expanded={emo} onClick={() => setEmo(!emo)} className="h-[34px] w-[34px] shrink-0 border border-cyan/20 text-[15px]">😀</button>
            {emo && <div className="absolute bottom-[52px] left-12 z-20 grid w-[300px] grid-cols-9 gap-0.5 border border-cyan/40 bg-panel p-2 shadow-[0_14px_34px_rgba(0,0,0,.6)]">
              {PICK.map((e) => <button key={e} type="button" onClick={() => { setText((t) => t + e); setEmo(false); box.current?.focus(); }} className="grid h-8 place-items-center text-[17px] hover:bg-cyan/10">{e}</button>)}</div>}
            <textarea ref={box} value={text} rows={1} maxLength={4000} aria-label={`Message ${title(cur)}`} placeholder={`Message ${title(cur)}…  (Enter sends · Shift+Enter new line)`}
              onChange={(e) => { setText(e.target.value); if (Date.now() - lastType.current > 3000) { lastType.current = Date.now(); void window.cn.hub.messagesAction({ action: "typing", convId: cur.id }); } }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              onPaste={(e) => { const it = [...e.clipboardData.items].find((x) => x.type.startsWith("image/")); if (it) { e.preventDefault(); void upload(it.getAsFile() ?? undefined); } }}
              className="max-h-[140px] min-h-[34px] flex-1 resize-none border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none [field-sizing:content] focus:border-cyan" />
            <button type="button" disabled={busy || !text.trim()} onClick={() => void send()} className="h-[34px] border border-cyan bg-cyan/10 px-4 text-[11px] tracking-[2px] text-cyan disabled:opacity-40">{busy ? "…" : "SEND"}</button>
          </div>
        </>}
      </section>
      {/* info */}
      {info && cur && <aside className="min-h-0 overflow-auto border-l border-cyan/15 p-3.5" aria-label="Chat info">
        <div className="text-center">{other ? <span className="mx-auto mb-1.5 block w-16"><Av uid={other} s={64} /></span> : <i className="mx-auto mb-1.5 grid h-16 w-16 place-items-center rounded-full bg-gold text-[24px] font-bold not-italic text-black">#</i>}
          <b className="block text-[14px] text-white">{title(cur)}</b>
          {other && <small className="text-[11px] text-dim">{(person(other)?.role ?? "").replace("_", " ").toUpperCase()}{person(other)?.platoon ? ` · ${person(other)!.platoon}` : ""}</small>}
          {other && <button type="button" onClick={() => setFile(other)} className="mt-2 block w-full border border-cyan/25 px-2 py-1 text-[10.5px] tracking-[1.5px] text-white hover:bg-cyan/10">OPEN PERSONNEL FILE</button>}</div>
        <div className="mb-1.5 mt-4 text-[10px] tracking-[2px] text-dim">CHAT</div>
        {([["🔕 Mute", cur.muted, "mute"], ["📌 Pinned", cur.pinned, "pin"]] as const).map(([l, on, a]) => <div key={a} className="flex items-center justify-between py-1 text-[12px]"><span>{l}</span>
          <button type="button" role="switch" aria-checked={on} aria-label={l} onClick={() => void act({ action: a, convId: cur.id, on: !on })} className={`relative h-5 w-[38px] rounded-full ${on ? "bg-ok/35" : "bg-white/10"}`}><i className={`absolute top-[3px] h-[14px] w-[14px] rounded-full ${on ? "left-[21px] bg-ok" : "left-[3px] bg-dim"}`} /></button></div>)}
        {isGroup(cur) && <><div className="mb-1.5 mt-4 text-[10px] tracking-[2px] text-dim">PEOPLE · {cur.participants.length}</div>
          {cur.participants.map((u) => <div key={u} className="flex items-center gap-2 py-1 text-[12px] text-white"><Av uid={u} s={24} dot />{nameOf(u)}{u === d.me && <small className="text-dim">(you)</small>}</div>)}</>}
        <div className="mb-1.5 mt-4 text-[10px] tracking-[2px] text-dim">SHARED IMAGES</div>
        <div className="grid grid-cols-3 gap-1">{(d.messages ?? []).filter((m) => m.imageUrl).slice(-9).reverse().map((m) => <a key={m.id} href={m.imageUrl} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden border border-cyan/15"><img src={m.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /></a>)}</div>
        {!(d.messages ?? []).some((m) => m.imageUrl) && <p className="text-[11px] text-dimmer">None yet.</p>}
        <button type="button" onClick={async () => { if (await askBox(`REMOVE THIS CHAT?\n\nIt is removed from your list. The others keep it.`)) { await act({ action: "leave", convId: cur.id }); setSel(null); } }}
          className="mt-5 w-full border border-bad/50 px-2 py-1 text-[10.5px] tracking-[1.5px] text-bad hover:bg-bad/10">🗑 REMOVE CHAT</button>
      </aside>}
      {newChat && <NewChat d={d} Av={Av} onClose={() => setNewChat(false)} onDone={(id) => { setNewChat(false); setSel(id); void load(id); }} />}
      {file && <FileWindow id={file} me={p.me} onClose={() => setFile(null)} />}
      {toast && <div role="alert" className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 border border-bad bg-panel px-4 py-2 text-[12px] text-bad">⚠ {toast}</div>}
    </main>
  );
}

function NewChat(p: { d: MsgData; Av: (x: { uid: string; s?: number; dot?: boolean }) => React.JSX.Element; onClose: () => void; onDone: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  const list = p.d.people.filter((u) => u.uid !== p.d.me && u.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)).slice(0, 60);
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
    <div role="dialog" aria-modal="true" aria-label="New chat" className="cfm-pop flex max-h-[80vh] w-[460px] flex-col border border-cyan bg-panel shadow-[0_18px_50px_rgba(0,0,0,.7)]">
      <div className="flex items-center border-b border-cyan/10 px-4 py-3"><b className="font-head text-[17px] tracking-[2.5px] text-white">✎ NEW CHAT</b><button type="button" aria-label="Close" onClick={p.onClose} className="ml-auto text-dim hover:text-white">✕</button></div>
      <div className="px-4 pt-3"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Find members…" aria-label="Find members" className="w-full border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-cyan" />
        {picked.length > 1 && <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name (optional)" aria-label="Group name" className="mt-2 w-full border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-cyan" />}</div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">{list.map((u) => { const on = picked.includes(u.uid); return (
        <button key={u.uid} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== u.uid) : [...picked, u.uid])} className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[12.5px] ${on ? "bg-cyan/10 text-cyan" : "text-white hover:bg-cyan/5"}`}>
          <p.Av uid={u.uid} s={26} dot />{u.name}<small className="ml-auto text-[10px] tracking-[1px] text-dim">{on ? "✓ PICKED" : u.role.replace("_", " ").toUpperCase()}</small></button>); })}</div>
      <div className="flex justify-end gap-2 border-t border-cyan/10 bg-[#080b10] px-4 py-3">
        <button type="button" onClick={p.onClose} className="border border-cyan/25 px-3 py-1.5 text-[11px] tracking-[1.5px] text-white">CANCEL</button>
        <button type="button" disabled={!picked.length || busy} onClick={async () => { setBusy(true); const r = await window.cn.hub.messagesAction({ action: "create", uids: picked, name }); setBusy(false); if (r.id) p.onDone(r.id); }}
          className="border border-cyan bg-cyan/10 px-3.5 py-1.5 text-[11px] tracking-[2px] text-cyan disabled:opacity-40">{picked.length > 1 ? `START GROUP (${picked.length + 1})` : "START CHAT"}</button></div>
    </div></div>;
}
