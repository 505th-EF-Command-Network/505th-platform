import { useState } from "react";

/**
 * My sign-up buttons (approved 2026-11-11): the event's own Discord buttons, my choice lit.
 * Click another = switch (Cortana updates the Discord post, no ping) · click mine again = remove me.
 * Same rules as Discord: full = waiting list, closed once the op starts.
 */
export type RsvpBtn = { key: string; emoji: string; label: string; style: string; limit: number; count: number; waiting: number };
const BG: Record<string, string> = { green: "#248046", red: "#da373c", blue: "#5865f2", grey: "#4e5058" };

export function Rsvp(p: { eventId: string; buttons: RsvpBtn[]; myChoice: string | null; myWaiting: boolean; open: boolean; linked: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(p.myChoice);
  const [note, setNote] = useState<[string, string] | null>(null);
  if (mine !== p.myChoice && !busy && !note) setMine(p.myChoice);
  if (!p.buttons?.length) return null;
  const click = async (key: string) => {
    if (busy || !p.open || !p.linked) return;
    setBusy(key); setNote(["◷ Updating Discord sign-up post…", "#f59e0b"]);
    const prev = mine;
    setMine(mine === key ? null : key);
    const r = await window.cn.hub.rsvp(p.eventId, key);
    setBusy(null);
    if (r.error) { setMine(prev); setNote([`⚠ ${r.error}`, "#ff4d4d"]); }
    else setNote([`✓ ${r.msg} — Discord post updated`, r.waiting ? "#f59e0b" : "#22e07a"]);
    p.onDone();
    setTimeout(() => setNote(null), 5000);
  };
  return (
    <div>
      <div className="flex gap-1.5">
        {p.buttons.map((b) => {
          const on = mine === b.key, c = BG[b.style] ?? BG.grey!, full = b.limit > 0 && b.count >= b.limit && !on;
          return (
            <button key={b.key} type="button" disabled={!!busy || !p.open || !p.linked} aria-pressed={on} onClick={() => void click(b.key)}
              title={!p.linked ? "Link your Discord account on the website first" : !p.open ? "Sign-up is closed" : on ? "Click again to remove yourself" : full ? "Full — you'd go on the waiting list" : ""}
              className="flex-1 border py-1.5 text-[11.5px] transition-shadow disabled:cursor-not-allowed"
              style={on ? { background: c, borderColor: c, color: "#fff", boxShadow: `0 0 14px -2px ${c}` } : { borderColor: c, color: full ? "#7d8a99" : "#c6d0da", opacity: !p.open ? 0.5 : 1 }}>
              {busy === b.key ? "◷" : b.emoji} {b.label} <b className="opacity-80">{b.count}{b.limit ? `/${b.limit}` : ""}</b>{b.waiting ? <small> +{b.waiting}⏳</small> : null}
            </button>);
        })}
      </div>
      <div className="mt-1.5 text-[10.5px]" style={{ color: note?.[1] ?? "#7d8a99" }}>
        {note?.[0] ?? (!p.linked ? "Link your Discord on the website to sign up from here" : !p.open ? "🔒 Sign-up closed" : p.myWaiting ? "⏳ You're on the waiting list" : mine ? "Your choice is lit · click it again to remove yourself" : "Same buttons as the Discord sign-up post")}
      </div>
    </div>
  );
}
