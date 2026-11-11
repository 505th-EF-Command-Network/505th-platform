import { useEffect, useRef, useState } from "react";
import logo from "../../../../assets/logo.png";

/**
 * 505th confirm box (approved mock 2026-11-11) — replaces the grey Windows confirm() everywhere.
 * `await askBox("TITLE?\n\nBody…")` → true / false. First line = title, the rest = body.
 * Tone is picked from the words: delete / can't be undone → red · reset, cancel, unlock, end… → amber · else cyan.
 * Esc cancels. Enter confirms on cyan and amber boxes only — red boxes must be clicked. Focus starts on CANCEL for red.
 * Optional `typeToConfirm` ("DELETE") for big bulk deletes.
 */
export type AskOpts = { tone?: "danger" | "warn" | "info"; go?: string; cancel?: string; small?: string; typeToConfirm?: string };
type Req = { text: string; o: AskOpts; done: (ok: boolean) => void };
let push: ((r: Req) => void) | null = null;

export function askBox(text: string, o: AskOpts = {}): Promise<boolean> {
  return new Promise((done) => (push ? push({ text, o, done }) : done(window.confirm(text))));
}

const TONE = { danger: { c: "#ff4d4d", icon: "🗑", small: "THIS CAN'T BE UNDONE" }, warn: { c: "#f59e0b", icon: "⚠", small: "PLEASE CHECK" }, info: { c: "#00d9ff", icon: "?", small: "PLEASE CONFIRM" } };
function toneOf(t: string): keyof typeof TONE {
  if (/\b(DELETE|REMOVE|PURGE)\b|CAN'?T BE UNDONE|CANNOT BE UNDONE/i.test(t)) return "danger";
  if (/^(RESET|CANCEL|UNLOCK|END|MOVE|CLEAR|REPOST|PING|LOCK|GIVE|BACKFILL)/i.test(t.trim())) return "warn";
  return "info";
}
const goLabel = (title: string, tone: string) => {
  const w = title.replace(/[?!.]/g, "").trim().split(/\s+/);
  if (tone === "danger") return "🗑 " + (w[0] ?? "DELETE").toUpperCase();
  return (w.slice(0, 2).join(" ") || "CONFIRM").toUpperCase();
};

export function ConfirmHost() {
  const [q, setQ] = useState<Req[]>([]);
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { push = (r) => setQ((x) => [...x, r]); return () => { push = null; }; }, []);
  const cur = q[0];
  const tone = cur ? (cur.o.tone ?? toneOf(cur.text)) : "info";
  const lines = cur ? cur.text.split("\n") : [];
  const title = (lines[0] ?? "").trim();
  const body = lines.slice(1).join("\n").trim().replace(/\n?THIS CANNOT BE UNDONE\.?$/i, "").trim();
  const T = TONE[tone];
  const need = cur?.o.typeToConfirm;
  const ok = !need || typed.trim().toUpperCase() === need.toUpperCase();
  const close = (v: boolean) => { if (!cur) return; cur.done(v); setTyped(""); setQ((x) => x.slice(1)); };
  useEffect(() => {
    if (!cur) return;
    (tone === "danger" ? cancelRef : goRef).current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
      else if (e.key === "Enter" && tone !== "danger" && ok && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); close(true); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  if (!cur) return null;
  // Body: blank-line paragraphs; lines starting "•" or "-" become a bullet list.
  const paras = body ? body.split(/\n\s*\n/) : [];
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="cfm-t" aria-describedby="cfm-b"
        className="cfm-pop relative w-[400px] max-w-[92vw] overflow-hidden border bg-panel"
        style={{ borderColor: T.c, boxShadow: `0 0 0 1px #000, 0 18px 50px rgba(0,0,0,.7), 0 0 30px ${T.c}40` }}>
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${T.c},transparent)` }} />
        <div className="flex items-center gap-2 border-b border-cyan/10 px-3.5 py-2 font-head text-[10px] font-semibold tracking-[3px] text-dim" style={{ background: "linear-gradient(90deg,rgba(0,217,255,.06),transparent)" }}>
          <img src={logo} alt="505th" className="h-[22px] w-[22px] object-contain" />505TH COMMAND NETWORK
          <button type="button" aria-label="Close" onClick={() => close(false)} className="ml-auto text-[12px] tracking-normal text-dimmer hover:text-white">✕</button>
        </div>
        <img src={logo} alt="" aria-hidden="true" className="pointer-events-none absolute -right-4 bottom-10 w-[150px] opacity-[.06]" />
        <div className="flex items-center gap-3 px-[18px] pb-2.5 pt-4">
          <div className="grid h-[38px] w-[38px] shrink-0 place-items-center border text-[18px]" style={{ borderColor: T.c, color: T.c, background: `${T.c}1a`, clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)" }}>{T.icon}</div>
          <div><b id="cfm-t" className="block font-head text-[15px] font-bold tracking-[2.5px] text-white">{title}</b><small className="text-[10px] tracking-[2px]" style={{ color: T.c }}>{cur.o.small ?? T.small}</small></div>
        </div>
        <div id="cfm-b" className="relative px-[18px] pb-1 pl-[68px] text-[13px] text-[#aeb9c4]">
          {paras.map((p, i) => {
            const ls = p.split("\n");
            const bullets = ls.length > 1 && ls.every((l) => /^\s*[•-]/.test(l));
            const warn = /^⚠|numbers will repeat|still saved/i.test(p);
            return bullets ? <ul key={i} className="mb-2 list-none p-0">{ls.map((l, j) => <li key={j} className="relative py-0.5 pl-4"><span className="absolute left-0" style={{ color: T.c }}>▸</span>{l.replace(/^\s*[•-]\s*/, "")}</li>)}</ul>
              : warn ? <div key={i} className="mb-2 border-l-2 border-bad bg-bad/10 px-2.5 py-1.5 text-[11.5px] text-[#ff8a8a]">{p.startsWith("⚠") ? p : "⚠ " + p}</div>
              : <p key={i} className="mb-2 mt-0 whitespace-pre-line">{p}</p>;
          })}
          {need && <div className="mt-2"><label htmlFor="cfm-type" className="mb-1 block text-[9.5px] tracking-[2px] text-dim">TYPE <b className="text-bad">{need.toUpperCase()}</b> TO CONFIRM</label>
            <input id="cfm-type" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="w-full border border-bad/50 bg-[#070a0f] px-2.5 py-1.5 font-mono text-[13px] tracking-[2px] text-white outline-none focus:border-bad" /></div>}
        </div>
        <div className="relative mt-3 flex justify-end gap-2 border-t border-cyan/10 bg-[#080b10] px-[18px] py-3.5">
          <button ref={cancelRef} type="button" onClick={() => close(false)} className="border border-cyan/25 px-4 py-1.5 text-[11px] tracking-[2px] text-white hover:bg-cyan/10">
            {cur.o.cancel ?? "CANCEL"}<span className="ml-1.5 text-[9px] tracking-[1px] text-dimmer">ESC</span></button>
          <button ref={goRef} type="button" disabled={!ok} onClick={() => close(true)} className="border px-4 py-1.5 text-[11px] tracking-[2px] disabled:opacity-35"
            style={{ borderColor: T.c, color: T.c, background: `${T.c}24` }}>
            {cur.o.go ?? goLabel(title, tone)}{tone !== "danger" && <span className="ml-1.5 text-[9px] tracking-[1px] opacity-60">ENTER</span>}</button>
        </div>
      </div>
    </div>
  );
}
