"use client";

/**
 * Control Reference keyboard (approved mock 2026-11-11). Same 18 keybinds as the old table.
 * Tap a glowing key or a list line → details. Filter chips fade other keys. Phone: keyboard scales to the width.
 * Colours: amber CHANGE · cyan BIND · red UNBIND · green DEFAULT. Keyboard-accessible (Tab / Enter).
 */
import { useMemo, useState } from "react";

type Act = "CHANGE" | "BIND" | "UNBIND" | "DEFAULT";
type Sec = "req" | "mov" | "cmb" | "slot";
type Bind = { s: Sec; a: Act; t: string; k: string[]; dbl?: boolean; or?: boolean; x: string; w: string; avoid?: string[] };

const B: Bind[] = [
  { s: "req", a: "CHANGE", t: "Throw", k: ["G", "G"], dbl: true, x: "Double-tap G to throw grenade — prevents accidental mass casualty events", w: "Controls → Weapons" },
  { s: "req", a: "BIND", t: "Vehicle Quick Mount", k: [], x: "Easy and fast mounting of vehicles — pick a free key", w: "Controls → Addons → ACE Movement" },
  { s: "req", a: "BIND", t: "Webknights Melee", k: [], x: "Set to any key of your choice — avoid F (fire mode) and G (grenade)", w: "Controls → Addons → Webknights Melee", avoid: ["F", "G"] },
  { s: "req", a: "UNBIND", t: "Lago Melee", k: [], x: "Remove to prevent conflict with Webknights Melee", w: "Controls → Addons → Lago Melee" },
  { s: "mov", a: "DEFAULT", t: "Move", k: ["W", "A", "S", "D"], or: true, x: "Move forward, left, back, right", w: "Controls → Movement" },
  { s: "mov", a: "DEFAULT", t: "Sprint", k: ["SHIFT", "W"], x: "Hold Shift while moving forward", w: "Controls → Movement" },
  { s: "mov", a: "DEFAULT", t: "Walk / jog", k: ["C", "C"], dbl: true, x: "Double-tap C — toggle between walk and jog speed", w: "Controls → Movement" },
  { s: "mov", a: "DEFAULT", t: "Prone", k: ["Z"], x: "Go prone — reduces profile, increases accuracy", w: "Controls → Movement" },
  { s: "mov", a: "DEFAULT", t: "Crouch", k: ["X"], x: "Crouch", w: "Controls → Movement" },
  { s: "cmb", a: "DEFAULT", t: "Fire", k: ["LMB"], x: "Fire weapon", w: "Controls → Weapons" },
  { s: "cmb", a: "DEFAULT", t: "Aim", k: ["RMB"], x: "Aim down sights / use optic", w: "Controls → Weapons" },
  { s: "cmb", a: "DEFAULT", t: "Lower / raise weapon", k: ["CTRL", "CTRL"], dbl: true, x: "Double-tap Ctrl — lower / raise weapon", w: "Controls → Weapons" },
  { s: "cmb", a: "DEFAULT", t: "Reload", k: ["R"], x: "Reload", w: "Controls → Weapons" },
  { s: "cmb", a: "DEFAULT", t: "Grenade mode", k: ["8"], x: "Cycle grenade / throw mode selection", w: "Controls → Weapons" },
  { s: "slot", a: "DEFAULT", t: "Primary weapon", k: ["1"], x: "Primary weapon (rifle / LMG)", w: "Controls → Weapons" },
  { s: "slot", a: "DEFAULT", t: "Secondary weapon", k: ["2"], x: "Secondary weapon (pistol / sidearm)", w: "Controls → Weapons" },
  { s: "slot", a: "DEFAULT", t: "Launcher", k: ["3"], x: "Launcher (rocket / AT weapon)", w: "Controls → Weapons" },
  { s: "slot", a: "DEFAULT", t: "Holster", k: ["0"], x: "Holster — put weapon away to belt/sling", w: "Controls → Weapons" },
];
const SECN: Record<Sec, string> = { req: "⚙ REQUIRED CHANGES", mov: "⬆ MOVEMENT", cmb: "🎯 COMBAT & WEAPONS", slot: "🔫 WEAPON SLOTS" };
const COL: Record<Act, string> = { CHANGE: "#f59e0b", BIND: "#00D9FF", UNBIND: "#ff4d4d", DEFAULT: "#22e07a" };
const RANK: Record<Act, number> = { CHANGE: 0, UNBIND: 1, BIND: 2, DEFAULT: 3 };
type K = string | [string, string];
const KB: K[][] = [
  ["ESC", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", ["BKSP", "w2"]],
  [["TAB", "w15"], "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", ["\\", "w15"]],
  [["CAPS", "w175"], "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", ["ENTER", "w2"]],
  [["SHIFT", "w225"], "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", ["SHIFT ", "w225"]],
  [["CTRL", "w15"], ["WIN", "w15"], ["ALT", "w15"], ["SPACE", "sp"], ["ALT ", "w15"], ["CTRL ", "w15"]],
];

function Caps({ b }: { b: Bind }) {
  if (!b.k.length) return <span className="cr-nokey">{b.a === "UNBIND" ? "— remove the bind" : "— your choice"}</span>;
  return (
    <>
      {b.k.map((k, n) => (
        <span key={n}>
          {n > 0 && <span className="cr-plus">{b.dbl ? "" : b.or ? "/" : "+"}</span>}
          <span className="cr-cap">{k}</span>
        </span>
      ))}
    </>
  );
}

export default function ControlReference() {
  const [f, setF] = useState<Sec | "">("");
  const [sel, setSel] = useState<number | null>(null);
  const binds = useMemo(() => (key: string) => B.map((b, i) => ({ ...b, i })).filter((b) => b.k.includes(key.trim()) && (!f || b.s === f)).sort((a, b) => RANK[a.a] - RANK[b.a]), [f]);

  const key = (lbl: string, cls = "") => {
    const bs = binds(lbl);
    const has = bs.length > 0;
    const dim = (f || sel != null) && !has;
    const on = sel != null && bs.some((b) => b.i === sel);
    return (
      <button
        key={lbl + cls}
        type="button"
        className={`cr-k ${cls}${has ? " has" : ""}${dim ? " dim" : ""}${on ? " sel" : ""}`}
        style={has ? ({ "--kc": COL[bs[0].a] } as React.CSSProperties) : undefined}
        data-n={bs.length > 1 ? bs.length : undefined}
        tabIndex={has ? 0 : -1}
        aria-label={`${lbl.trim()}: ${has ? bs.map((b) => b.t).join(", ") : "not used"}`}
        onClick={() => {
          if (!has) return;
          const at = sel != null ? bs.findIndex((b) => b.i === sel) : -1;
          setSel(bs[(at + 1) % bs.length].i);
        }}
      >
        {lbl.trim()}
      </button>
    );
  };
  const b = sel != null ? B[sel] : null;

  return (
    <div className="cr">
      <div className="cr-legend">
        {(Object.keys(COL) as Act[]).map((a) => (
          <span key={a}><i style={{ borderColor: COL[a] }} />{a === "BIND" ? "BIND (ADD)" : a === "DEFAULT" ? "DEFAULT (CHECK)" : a}</span>
        ))}
      </div>
      <div className="cr-chips" role="group" aria-label="Show">
        {([["", "ALL"], ...Object.entries(SECN)] as [Sec | "", string][]).map(([k, l]) => (
          <button key={k} type="button" className={`cr-chip${f === k ? " on" : ""}`} aria-pressed={f === k} onClick={() => { setF(k); setSel(null); }}>{l}</button>
        ))}
      </div>
      <div className="cr-kbwrap">
        <div className="cr-kbx">
          <div className="cr-kb">
            {KB.map((r, n) => (
              <div className="cr-r" key={n}>{r.map((k) => (Array.isArray(k) ? key(k[0], k[1]) : key(k)))}</div>
            ))}
          </div>
          <div className="cr-mouse">{key("LMB")}{key("RMB")}<div className="cr-mbody" /></div>
        </div>
        <div className="cr-hint">KEY WITH A NUMBER = MORE THAN ONE BIND · “G G” = DOUBLE-TAP · ON A PHONE, TURN SIDEWAYS FOR A BIGGER KEYBOARD</div>
      </div>
      <div className="cr-two">
        <div className="cr-det" aria-live="polite">
          {b ? (
            <>
              <h3>{SECN[b.s]}</h3>
              <span className={`cr-b ${b.a}`}>{b.a}</span>
              <div className="cr-dt">{b.t}</div>
              <div className="cr-dk"><Caps b={b} />{b.dbl && <span className="cr-dbl">DOUBLE-TAP</span>}</div>
              <p>{b.x}</p>
              <div className="cr-where">⚙ OPTIONS → {b.w.toUpperCase()}</div>
              {b.avoid && <div className="cr-avoid">✕ DON&apos;T USE: {b.avoid.join(" · ")}</div>}
            </>
          ) : (
            <><h3>SELECT A KEY</h3><p className="cr-dim">Tap a glowing key above, or a line in the list.</p></>
          )}
        </div>
        <div className="cr-list">
          {(Object.keys(SECN) as Sec[]).filter((s) => !f || f === s).map((s) => (
            <div key={s}>
              <div className="cr-sec">{SECN[s]}</div>
              {B.map((x, i) => ({ ...x, i })).filter((x) => x.s === s).map((x) => (
                <button type="button" key={x.i} className={`cr-item${sel === x.i ? " sel" : ""}`} onClick={() => setSel(x.i)}>
                  <span className={`cr-b ${x.a}`}>{x.a}</span>
                  <span className="cr-t">{x.t} <Caps b={x} /></span>
                  <span className="cr-x">{x.x}</span>
                  <span className="cr-w">{x.w}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
