import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "../../../preload/api";
import { SHORTCUT_GROUPS, checkPin } from "../settings";
import logo from "../../../../assets/logo.png";

/**
 * Settings v2 overlays: Hub lock screen (PIN), shortcut cheat sheet (?), "while you were away" banner, sound captions.
 */

/** Hub lock — covers everything until the right Hub PIN (5 wrong = 60 s wait). */
export function LockScreen(p: { pinHash: string; name: string; onUnlock: () => void; onSignOut: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [, tick] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const wait = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
  const go = async () => {
    if (wait || pin.length < 4) return;
    if (await checkPin(pin, p.pinHash)) { p.onUnlock(); return; }
    const n = tries + 1;
    setTries(n); setPin("");
    if (n >= 5) { setWaitUntil(Date.now() + 60_000); setTries(0); setErr("Too many wrong tries — wait 60 seconds."); } else setErr(`Wrong PIN (${5 - n} tries left)`);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Hub locked" className="fixed inset-0 z-[200] grid place-items-center bg-[#05070a]/95 backdrop-blur-md">
      <div className="w-[340px] border border-cyan/30 bg-panel p-6 text-center shadow-[0_0_40px_rgb(var(--accent-rgb)/.15)]">
        <img src={logo} alt="" className="mx-auto h-14 w-14" />
        <div className="mt-3 font-head text-[18px] font-bold tracking-[3px] text-cyan">🔒 HUB LOCKED</div>
        <div className="mt-1 text-[12px] text-dim">{p.name} — enter your Hub PIN</div>
        <input ref={box} type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} disabled={!!wait} aria-label="Hub PIN"
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && void go()}
          className="mt-4 w-full border border-cyan/30 bg-black/40 px-3 py-2.5 text-center text-[22px] tracking-[10px] text-white outline-none focus:border-cyan" />
        <div role="alert" className="mt-2 min-h-[18px] text-[12px] text-bad">{wait ? `Wait ${wait} s` : err}</div>
        <button type="button" onClick={() => void go()} disabled={!!wait || pin.length < 4} className="mt-2 w-full border border-cyan bg-cyan/15 py-2 text-[12px] tracking-[2px] text-white disabled:opacity-40">UNLOCK</button>
        <button type="button" onClick={p.onSignOut} className="mt-3 text-[11px] text-dim underline hover:text-white">Forgot PIN? Sign out and sign in with Discord</button>
      </div>
    </div>
  );
}

/** "?" — every shortcut on one sheet. */
export function CheatSheet(p: { s: AppSettings; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()} className="fixed inset-0 z-[150] grid place-items-center bg-black/70">
      <div className="max-h-[80vh] w-[640px] overflow-auto border border-cyan/30 bg-panel p-5">
        <div className="mb-3 flex items-center font-head text-[16px] font-bold tracking-[3px] text-cyan">⌨ KEYBOARD SHORTCUTS<button type="button" aria-label="Close" onClick={p.onClose} className="ml-auto text-dim hover:text-white">✕</button></div>
        <div className="grid grid-cols-2 gap-4">
          {SHORTCUT_GROUPS.map(([g, list]) => (
            <div key={g}>
              <div className="mb-1.5 text-[10.5px] tracking-[2px] text-dim">{g.toUpperCase()}</div>
              {list.map(([id, label]) => (
                <div key={id} className={`flex items-center justify-between border-b border-cyan/10 py-1.5 text-[12.5px] ${p.s.keysOff.includes(id) ? "opacity-40" : ""}`}>
                  {label}<kbd className="border border-cyan/30 bg-black/40 px-1.5 py-px text-[11px] text-cyan">{p.s.keysOff.includes(id) ? "OFF" : p.s.keys[id]}</kbd>
                </div>
              ))}
            </div>
          ))}
          {p.s.pageKeys && <div><div className="mb-1.5 text-[10.5px] tracking-[2px] text-dim">PINNED PAGES</div><div className="text-[12.5px] text-[#aeb9c4]">Ctrl + 1 … 9 opens your ★ pinned pages in order.</div></div>}
        </div>
      </div>
    </div>
  );
}

/** Banner shown when you come back after 2+ minutes and something new arrived. */
export function AwayBanner(p: { count: number; onOpen: () => void; onClose: () => void }) {
  return (
    <div role="status" className="flex items-center gap-3 border-b border-amber/40 bg-amber/10 px-4 py-2 text-[12.5px] text-white">
      <span className="text-amber">⏰</span> While you were away: <b>{p.count}</b> new alert{p.count === 1 ? "" : "s"}
      <button type="button" onClick={p.onOpen} className="ml-2 border border-amber/50 px-2 py-px text-[11px] tracking-[1px] hover:bg-amber/20">VIEW</button>
      <button type="button" aria-label="Dismiss" onClick={p.onClose} className="ml-auto text-dim hover:text-white">✕</button>
    </div>
  );
}

/** Text for every sound (Accessibility → "Text for every sound"). */
export function Captions() {
  const [list, setList] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => { const id = Date.now() + Math.random(); setList((l) => [...l.slice(-2), { id, text: String((e as CustomEvent).detail) }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 5000); };
    addEventListener("hub:caption", on);
    return () => removeEventListener("hub:caption", on);
  }, []);
  if (!list.length) return null;
  return <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 space-y-1">{list.map((c) => <div key={c.id} className="border border-cyan/40 bg-black/85 px-3 py-1.5 text-[12.5px] text-white">{c.text}</div>)}</div>;
}
