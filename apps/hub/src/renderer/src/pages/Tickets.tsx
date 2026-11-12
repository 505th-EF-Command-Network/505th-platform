import { askBox } from "../components/Confirm";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ticket, TicketData } from "../../../preload/api";
import { FileWindow } from "./Personnel";

/**
 * COMMS → TICKETS in the app — same as the Terminal's tickets.js (approved mock 2026-11-11).
 * Members open tickets in Discord; staff reply / note / claim / close / reopen / transcript / delete here.
 * Replies post in the ticket channel as plain text signed `Rank. F. "Callsign"` (Cortana ticket.reply).
 * Ticket TYPES (panels) stay on the website (Ticket Settings).
 */
const pad = (n: number) => String(n ?? 0).padStart(4, "0");
const ago = (iso?: string) => { if (!iso) return ""; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const uk = (iso?: string, short = false) => (iso ? new Date(iso).toLocaleString("en-GB", short ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" } : { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).toUpperCase() : "—");
const state = (t: Ticket) => t.status === "closed" ? ["CLOSED", "border-dimmer text-dim"] : t.waiting === "staff" ? ((t.transcript?.length ?? 0) > 1 ? ["STAFF", "border-cyan text-cyan"] : ["NEW", "border-amber text-amber"]) : ["MEMBER", "border-ok text-ok"];

export function Tickets(p: { me: string }) {
  const [d, setD] = useState<TicketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [type, setType] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const chat = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { const r = await window.cn.hub.tickets(); if ("error" in r) setError(r.error); else { setD(r); setError(null); } }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (x === "tickets" || x === "ticket_types") { clearTimeout(t); t = setTimeout(() => void load(), 400); } });
    const poll = setInterval(() => void load(), 90_000);
    return () => { off(); clearTimeout(t); clearInterval(poll); };
  }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  const list = useMemo(() => (d?.tickets ?? []).filter((t) => (filter === "closed" ? t.status === "closed" : t.status === "open") && (!type || t.typeId === type)), [d, filter, type]);
  const cur = d?.tickets.find((t) => t.id === sel) ?? (sel === null ? list[0] : undefined);
  const msgs = cur?.transcript?.length ?? 0;
  useEffect(() => { chat.current?.scrollTo({ top: chat.current.scrollHeight }); }, [cur?.id, msgs]);

  const act = async (body: Record<string, unknown>, ask?: string) => {
    if ((!cur && body.action !== "resetnum") || busy || (ask && !await askBox(ask))) return false;
    setBusy(true);
    const r = await window.cn.hub.ticketsAction(cur && body.action !== "resetnum" ? { ticketId: cur.id, ...body } : body);
    if (body.action === "purge" && !r.error) setSel(null);
    setBusy(false);
    setToast(r.error ? [r.error, false] : [String(r.msg).toUpperCase(), !r.queued]);
    void load();
    return !r.error;
  };
  const send = async () => { if (draft.trim() && (await act({ action: note ? "note" : "reply", text: draft }))) setDraft(""); };

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const open = d.tickets.filter((t) => t.status === "open");
  const month = new Date().toISOString().slice(0, 7);
  const first = d.tickets.filter((t) => t.firstReplyMs != null && String(t.openedAtISO).slice(0, 7) === month).map((t) => t.firstReplyMs!);
  const avg = first.length ? first.reduce((a, b) => a + b, 0) / first.length / 60000 : null;
  const op = cur ? d.openers[cur.openerId] : undefined;
  const isOpen = cur?.status === "open";
  const chip = (on: boolean) => `whitespace-nowrap border px-2.5 py-1 text-[10.5px] tracking-[1.5px] ${on ? "border-cyan text-cyan" : "border-cyan/15 text-dim hover:text-white"}`;
  const btn = (red = false) => `border px-2.5 py-1.5 text-[10.5px] tracking-[1.5px] disabled:opacity-40 ${red ? "border-bad/60 text-bad hover:bg-bad/10" : "border-cyan/30 text-white hover:bg-cyan/10"}`;
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-5" aria-label="Tickets">
      <h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">TICKETS</h1>
      <p className="mb-0 mt-1 text-[11px] tracking-[2px] text-dim">MEMBERS OPEN TICKETS IN DISCORD · REPLY HERE AND CORTANA POSTS IT, SIGNED WITH YOUR NAME</p>
      {d.canReset && <div className="mt-2 flex items-center gap-2 text-[10.5px] tracking-[1px] text-dim">NEXT TICKET: <b className="font-normal text-white">#{pad(d.nextNumber)}</b>
        <button type="button" disabled={busy || d.nextNumber === 1} onClick={() => void act({ action: "resetnum" }, `RESET TICKET NUMBERS?\n\nThe next ticket will be #0001.${d.tickets.length ? `\n\n⚠ ${d.tickets.length} old ticket(s) are still saved — numbers will repeat.` : ""}`)}
          className="border border-amber/50 px-2 py-0.5 text-[10px] tracking-[1.5px] text-amber disabled:opacity-40">↺ RESET TO #0001</button></div>}
      <div className="my-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {([[open.length, "OPEN", "#f59e0b"], [open.filter((t) => t.waiting === "staff").length, "WAITING ON STAFF", "#00d9ff"],
          [avg == null ? "—" : avg < 60 ? Math.round(avg) + "m" : `${Math.floor(avg / 60)}h ${Math.round(avg % 60)}m`, "AVG FIRST REPLY (MONTH)", "#fff"],
          [d.tickets.filter((t) => t.status === "closed" && String(t.closedAtISO).slice(0, 7) === month).length, "CLOSED THIS MONTH", "#22e07a"]] as const).map(([v, l, c]) => (
          <div key={l} className="tile border border-cyan/15 bg-panel px-3.5 py-2.5"><b className="block font-head text-[24px]" style={{ color: c }}>{v}</b><span className="text-[9.5px] tracking-[2px] text-dim">{l}</span></div>))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[290px_1fr] gap-3 xl:grid-cols-[290px_1fr_250px]">
        <section className="flex min-h-0 flex-col border border-cyan/15 bg-panel" aria-label="Ticket list">
          <div className="flex flex-wrap gap-1.5 p-2.5">
            <button type="button" aria-pressed={filter === "open" && !type} onClick={() => { setFilter("open"); setType(""); setSel(null); }} className={chip(filter === "open" && !type)}>OPEN</button>
            {d.types.map((t) => <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => { setFilter("open"); setType(t.id); setSel(null); }} className={chip(type === t.id)}>{t.emoji} {t.name.toUpperCase()}</button>)}
            <button type="button" aria-pressed={filter === "closed"} onClick={() => { setFilter("closed"); setType(""); setSel(null); }} className={chip(filter === "closed")}>CLOSED</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {list.length ? list.map((t) => { const [l, c] = state(t); return (
              <button key={t.id} type="button" aria-current={t.id === cur?.id} onClick={() => { setSel(t.id); setClosing(false); }}
                className={`rrow flex w-full items-center gap-2.5 border-t border-white/5 px-3 py-2.5 text-left ${t.id === cur?.id ? "bg-cyan/10 shadow-[inset_3px_0_0_var(--color-cyan)]" : "hover:bg-cyan/5"}`}>
                <span className={`w-[58px] shrink-0 border py-0.5 text-center text-[9px] tracking-[1px] ${c}`}>{l}</span>
                <span className="min-w-0"><b className="block truncate text-[12.5px] font-normal text-white">#{pad(t.number)} · {t.openerName}</b>
                  <small className="block truncate text-[10.5px] text-dim">{t.typeEmoji} {t.typeName} · {ago(t.lastActivityISO || t.openedAtISO)}{t.claimedByName ? " · " + t.claimedByName : ""}</small></span>
              </button>); })
              : <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">NO TICKETS HERE</p>}
          </div>
        </section>
        <section className="flex min-h-0 flex-col border border-cyan/15 bg-panel" aria-label="Ticket chat">
          {!cur ? <p className="m-auto text-[11px] tracking-[2px] text-dimmer">PICK A TICKET ON THE LEFT</p> : <>
            <div className="flex items-start gap-3 border-b border-cyan/15 px-4 py-3">
              <div className="min-w-0 flex-1"><b className="font-head text-[16px] tracking-[2px] text-white">#{pad(cur.number)} · {cur.typeName.toUpperCase()}</b>
                <small className="block text-[10.5px] tracking-[1px] text-dim">OPENED {uk(cur.openedAtISO)} · {cur.openerName}{cur.claimedByName ? " · CLAIMED BY " + cur.claimedByName : ""}
                  {!isOpen && ` · CLOSED ${uk(cur.closedAtISO)}${cur.closedByName ? " BY " + cur.closedByName : ""}${cur.closeReason ? ` — “${cur.closeReason}”` : ""}`}{cur.channelDeleted ? " · CHANNEL DELETED" : ""}</small></div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {isOpen ? <>{!cur.claimedByName && <button type="button" disabled={busy} onClick={() => void act({ action: "claim" })} className={btn()}>✋ CLAIM</button>}
                  <button type="button" disabled={busy} onClick={() => setClosing(!closing)} className={btn(true)}>🔒 CLOSE</button></>
                  : <><button type="button" disabled={busy} onClick={() => void act({ action: "transcript" })} className={btn()}>📑 TRANSCRIPT</button>
                    <button type="button" disabled={busy} onClick={() => void act({ action: "purge" }, `DELETE TICKET #${pad(cur.number)}?\n\nThis will remove:\n\n• The ticket record\n• Its transcript post in #transcripts${cur.channelDeleted ? "" : "\n• Its Discord channel"}`)} className={btn(true)}>🗑 DELETE TICKET</button>
                    {!cur.channelDeleted && <><button type="button" disabled={busy} onClick={() => void act({ action: "reopen" })} className={btn()}>🔓 REOPEN</button>
                      <button type="button" disabled={busy} onClick={() => void act({ action: "delete" }, `DELETE THE DISCORD CHANNEL FOR TICKET #${pad(cur.number)}?\n\nThe transcript is saved first. This can't be undone.`)} className={btn(true)}>⛔ DELETE CHANNEL</button></>}</>}
              </div>
            </div>
            {closing && isOpen && <div className="flex gap-2 border-b border-bad/30 bg-bad/5 px-4 py-2.5">
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason for closing (shown in Discord)" aria-label="Reason for closing" className="flex-1 border border-cyan/20 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-cyan" />
              <button type="button" disabled={busy || !reason.trim()} onClick={async () => { if (await act({ action: "close", reason })) { setClosing(false); setReason(""); } }} className={btn(true)}>CLOSE TICKET</button></div>}
            <div ref={chat} className="min-h-0 flex-1 overflow-auto px-4 py-3">
              {(cur.transcript ?? []).map((m, i) => (
                <div key={i} className={`mb-3 flex gap-2.5 ${m.note ? "border-l-2 border-amber bg-amber/5 py-1.5 pl-2" : ""}`}>
                  <i className={`grid h-8 w-8 shrink-0 place-items-center text-[11px] not-italic ${m.staff ? "bg-cyan/15 text-cyan" : "bg-white/5 text-dim"}`}>{(m.who || "?").slice(0, 2).toUpperCase()}</i>
                  <div className="min-w-0"><b className={`text-[12.5px] font-normal ${m.staff ? "text-cyan" : "text-white"}`}>{m.who}</b>
                    <small className="ml-2 text-[10px] text-dimmer">{uk(m.atISO, true)}{m.note ? " · STAFF NOTE — ONLY STAFF SEE THIS" : ""}</small>
                    <div className="whitespace-pre-wrap break-words text-[13px] text-[#d6dde6]">{m.text}</div>
                    {(m.images ?? []).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Attached image" loading="lazy" className="mt-1.5 max-h-[220px] max-w-[320px] border border-cyan/15" /></a>)}
                  </div></div>))}
            </div>
            {isOpen && <div className="border-t border-cyan/15 p-3">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={1900} aria-label={note ? "Staff note" : "Reply"}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(); }}
                placeholder={note ? "Staff note — only staff see it" : `Reply to ${cur.openerName}… (Cortana posts it in the ticket, signed with your name)`}
                className={`w-full resize-none border bg-[#070a0f] px-3 py-2 text-[13px] text-white outline-none ${note ? "border-amber/50 focus:border-amber" : "border-cyan/20 focus:border-cyan"}`} />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" aria-pressed={note} onClick={() => setNote(!note)} className={chip(note)}>🔒 STAFF NOTE</button>
                <span className="flex-1 text-[10px] text-dimmer">CTRL + ENTER TO SEND</span>
                <button type="button" disabled={busy || !draft.trim()} onClick={() => void send()} className="border border-gold bg-gold/15 px-4 py-1.5 text-[11px] tracking-[2px] text-gold disabled:opacity-40">{busy ? "SENDING…" : note ? "SAVE NOTE" : "SEND REPLY"}</button>
              </div></div>}
          </>}
        </section>
        {cur && <aside className="hidden min-h-0 flex-col gap-3 overflow-auto xl:flex" aria-label="About this member">
          <div className="border border-cyan/15 bg-panel p-3.5">
            <div className="mb-2 text-[9.5px] tracking-[2px] text-dim">OPENED BY</div>
            <b className="block font-head text-[15px] text-white">{op?.name || cur.openerName}</b>
            <small className="block text-[10.5px] text-dim">{op?.uid ? (op.status === "pending" ? "REGISTERED · AWAITING BCT" : "505TH MEMBER") : "NOT REGISTERED ON THE WEBSITE"}</small>
            {op?.uid && <button type="button" onClick={() => setFile(op.uid)} className={`${btn()} mt-2.5 w-full`}>OPEN PERSONNEL FILE</button>}
          </div>
          <div className="border border-cyan/15 bg-panel p-3.5 text-[12px]">
            <div className="flex justify-between py-1"><span className="text-dim">Past tickets</span><b className="font-normal text-white">{op?.past ?? 0}</b></div>
            <div className="flex justify-between py-1"><span className="text-dim">Active warnings</span><b className={`font-normal ${op?.warns ? "text-bad" : "text-white"}`}>{op?.warns ?? 0}</b></div>
            <div className="flex justify-between py-1"><span className="text-dim">Type</span><b className="font-normal text-white">{cur.typeEmoji} {cur.typeName}</b></div>
          </div>
          {isOpen && d.types.length > 1 && <div className="border border-cyan/15 bg-panel p-3.5">
            <label htmlFor="tkMove" className="mb-2 block text-[9.5px] tracking-[2px] text-dim">MOVE TO ANOTHER TYPE</label>
            <select id="tkMove" value="" disabled={busy} onChange={(e) => e.target.value && void act({ action: "move", typeId: e.target.value })} className="w-full border border-cyan/20 bg-[#070a0f] px-2 py-1.5 text-[12px] text-white">
              <option value="">— pick —</option>{d.types.filter((t) => t.id !== cur.typeId).map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</select>
          </div>}
        </aside>}
      </div>
      {file && <FileWindow id={file} me={p.me} onClose={() => setFile(null)} />}
      {toast && <div role="status" className={`fixed bottom-3 left-1/2 -translate-x-1/2 border bg-panel px-4 py-2 text-[12px] ${toast[1] ? "border-ok text-ok" : "border-amber text-amber"}`}>{toast[1] ? "✓ " : "⚠ "}{toast[0]}</div>}
    </main>
  );
}
