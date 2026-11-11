"use client";
import { useEffect, useState } from "react";

/**
 * Handbook side contents (sticky on desktop, scrolling bar on mobile).
 * Built from the page's own sections (.hb2-body .handbook-section[id]) so the content stays in the page markup.
 * Also: reading progress, current-section highlight, and open/close for every sub-topic.
 */
type Item = { id: string; n: string; title: string };

export default function HandbookToc() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState("");
  const [pct, setPct] = useState(0);
  const [allOpen, setAllOpen] = useState(true);

  useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>(".hb2-body .handbook-section[id]"));
    setItems(secs.map((s, i) => {
      const t = s.querySelector(".section-title");
      const num = t?.querySelector(".section-number")?.textContent?.trim();
      const title = (t?.textContent || s.id).replace(num || "", "").trim();
      return { id: s.id, n: num || String(i + 1).padStart(2, "0"), title };
    }));

    // sub-topics: heading toggles its own content
    const heads = Array.from(document.querySelectorAll<HTMLElement>(".hb2-body .subsection > h3:first-child"));
    const toggle = (h: HTMLElement) => {
      const sub = h.parentElement!;
      const closed = sub.classList.toggle("hb2-closed");
      h.setAttribute("aria-expanded", String(!closed));
    };
    const onClick = (e: Event) => toggle(e.currentTarget as HTMLElement);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(e.currentTarget as HTMLElement); } };
    heads.forEach((h) => {
      h.setAttribute("role", "button"); h.setAttribute("tabindex", "0"); h.setAttribute("aria-expanded", "true");
      h.addEventListener("click", onClick); h.addEventListener("keydown", onKey);
    });

    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    secs.forEach((s) => io.observe(s));

    const onScroll = () => {
      const body = document.querySelector(".hb2-body") as HTMLElement | null;
      if (!body) return;
      const r = body.getBoundingClientRect();
      const total = r.height - innerHeight;
      setPct(total > 0 ? Math.min(100, Math.max(0, (-r.top / total) * 100)) : 100);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect(); removeEventListener("scroll", onScroll);
      heads.forEach((h) => { h.removeEventListener("click", onClick); h.removeEventListener("keydown", onKey); });
    };
  }, []);

  const setAll = (open: boolean) => {
    document.querySelectorAll<HTMLElement>(".hb2-body .subsection").forEach((s) => {
      s.classList.toggle("hb2-closed", !open);
      s.querySelector(":scope > h3:first-child")?.setAttribute("aria-expanded", String(open));
    });
    setAllOpen(open);
  };

  return (
    <nav className="hb2-toc" aria-label="Contents">
      <div className="hb2-k">CONTENTS</div>
      <div className="hb2-prog" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      {items.map((it) => (
        <a key={it.id} href={`#${it.id}`} className={active === it.id ? "on" : ""} aria-current={active === it.id ? "location" : undefined}>
          <span>{it.n}</span>{it.title}
        </a>
      ))}
      <button type="button" className="hb2-all" onClick={() => setAll(!allOpen)}>{allOpen ? "COLLAPSE ALL" : "EXPAND ALL"}</button>
    </nav>
  );
}
