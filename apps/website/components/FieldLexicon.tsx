"use client";

/**
 * Field Lexicon (approved mock 2026-11-11). The 83 terms from the old page (lib/lexicon-terms.json) —
 * the 1:1 conversion had lost them, so the page was empty.
 * Sticky search (matches highlighted), colour category chips with counts, A–Z jump bar, cards; click a card to copy.
 */
import { useMemo, useState } from "react";
import TERMS from "@/lib/lexicon-terms.json";

type Term = { abbr: string; full: string; def: string; cat: string };
const CATS: [string, string, string][] = [
  ["", "All", ""], ["general", "General Military", "#00D9FF"], ["unsc", "UNSC / Halo Lore", "#a78bfa"], ["arma", "Arma 3 / ACE", "#22e07a"],
  ["optre", "OPTRE Mod", "#f59e0b"], ["comms", "Communications", "#2dd4bf"], ["medical", "Medical", "#ff4d4d"],
];
const CC = Object.fromEntries(CATS.map((c) => [c[0], c[2]]));
const CN = Object.fromEntries(CATS.map((c) => [c[0], c[1]]));

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default function FieldLexicon() {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const all = TERMS as Term[];
  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return all.filter((t) => (!cat || t.cat === cat) && (!ql || t.abbr.toLowerCase().includes(ql) || t.full.toLowerCase().includes(ql) || t.def.toLowerCase().includes(ql)))
      .sort((a, b) => a.abbr.localeCompare(b.abbr));
  }, [all, cat, q]);
  const groups = useMemo(() => {
    const g: Record<string, Term[]> = {};
    list.forEach((t) => (g[t.abbr[0].toUpperCase()] ??= []).push(t));
    return g;
  }, [list]);
  const copy = (t: Term) => {
    const s = `${t.abbr} — ${t.full}`;
    void navigator.clipboard?.writeText(s).catch(() => {});
    setToast(`COPIED: ${t.abbr}`);
    setTimeout(() => setToast(""), 1400);
  };

  return (
    <div className="fl">
      <div className="fl-bar">
        <div className="fl-srow">
          <input className="fl-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a term, e.g. QRF, medevac, over…" aria-label="Search terms" />
          <span className="fl-count">{list.length} TERM{list.length === 1 ? "" : "S"}</span>
        </div>
        <div className="fl-cats" role="group" aria-label="Category">
          {CATS.map(([k, l, c]) => (
            <button key={k} type="button" className={`fl-cat${cat === k ? " on" : ""}`} style={{ "--cc": c || "#00D9FF" } as React.CSSProperties} aria-pressed={cat === k} onClick={() => setCat(k)}>
              {c && <i style={{ background: c }} />}{l} <small>{all.filter((t) => !k || t.cat === k).length}</small>
            </button>
          ))}
        </div>
        <div className="fl-az" aria-label="Jump to letter">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => (
            <button key={L} type="button" className={groups[L] ? "" : "off"} disabled={!groups[L]} aria-label={`Jump to ${L}`}
              onClick={() => document.getElementById(`fl-${L}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{L}</button>
          ))}
        </div>
      </div>
      <div aria-live="polite">
        {list.length ? Object.keys(groups).sort().map((L) => (
          <section key={L}>
            <div className="fl-letter" id={`fl-${L}`}><b>{L}</b></div>
            <div className="fl-grid">
              {groups[L].map((t) => (
                <button key={t.abbr + t.cat} type="button" className="fl-t" style={{ "--cc": CC[t.cat] } as React.CSSProperties} onClick={() => copy(t)} title="Click to copy">
                  <span className="fl-tag">{CN[t.cat].toUpperCase()}</span>
                  <span className="fl-ab"><Hl text={t.abbr} q={q} /></span>
                  <span className="fl-fu"><Hl text={t.full} q={q} /></span>
                  <span className="fl-df"><Hl text={t.def} q={q} /></span>
                  <span className="fl-cp">⧉ COPY</span>
                </button>
              ))}
            </div>
          </section>
        )) : <div className="fl-empty">No terms match. Try fewer letters, or pick “All”.</div>}
      </div>
      <div className={`fl-toast${toast ? " on" : ""}`} role="status">{toast}</div>
    </div>
  );
}
