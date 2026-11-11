"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { embedUrl } from "@/lib/public/embed";

/** Port of old js/cms.js: editable page slots (image / video / text) + live Discord invite on every link. */
const PAGE_BY_PATH: Record<string, string> = {
  "/": "home", "/home": "home",
  "/about-505th": "about-505th", "/about-alpha-company": "about-alpha", "/about-stalker": "about-stalker",
  "/about-corpsman": "about-corpsman", "/about-54th-air-wing": "about-54th",
};
const safeUrl = (v: unknown) => { const s = String(v ?? ""); return /^https:\/\//.test(s) ? s : null; };

export default function CmsApply() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    const page = PAGE_BY_PATH[pathname] ?? null;
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="discord.gg"], a[href*="discord.com/invite"]');
    const hasSlots = !!page && !!document.querySelector("[data-cms-slot]");
    if (!links.length && !hasSlots) return;
    let dead = false;
    fetch(`/api/public/site${hasSlots ? `?page=${page}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { slots: Record<string, unknown>; discordInvite: string | null } | null) => {
        if (dead || !d) return;
        if (d.discordInvite) document.querySelectorAll<HTMLAnchorElement>('a[href*="discord.gg"], a[href*="discord.com/invite"]').forEach((a) => (a.href = d.discordInvite!));
        if (!hasSlots) return;
        document.querySelectorAll<HTMLElement>("[data-cms-slot]").forEach((el) => {
          const v = d.slots[el.dataset.cmsSlot || ""] as string | { url?: string; name?: string; value?: string; text?: string } | undefined;
          if (!v) return;
          const type = el.dataset.cmsType || "image";
          const raw = typeof v === "string" ? v : v.url;
          if (type === "text") {
            const t = typeof v === "string" ? v : v.value || v.text || v.url || "";
            if (t) el.textContent = t;
          } else if (type === "image") {
            const url = safeUrl(raw); if (!url) return;
            const img = new Image();
            img.alt = (typeof v === "object" && v.name) || el.dataset.cmsSlot || "";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
            img.onload = () => { if (dead) return; el.replaceChildren(img); Object.assign(el.style, { background: "none", border: "1px solid rgba(0,217,255,.15)", display: "block" }); };
            img.src = url;
          } else if (type === "video") {
            const url = safeUrl(raw); if (!url) return;
            const e = embedUrl(url); if (!e) return;
            const m = document.createElement(e.kind === "iframe" ? "iframe" : "video");
            m.setAttribute("src", e.src);
            if (e.kind === "iframe") { m.setAttribute("allowfullscreen", ""); m.setAttribute("allow", "encrypted-media; picture-in-picture; fullscreen"); m.setAttribute("title", el.dataset.cmsSlot || "video"); }
            else m.setAttribute("controls", "");
            m.style.cssText = "width:100%;height:100%;position:absolute;top:0;left:0;border:0;";
            el.replaceChildren(m);
            Object.assign(el.style, { position: "relative", paddingBottom: "56.25%", height: "0", overflow: "hidden", background: "none", border: "none", display: "block" });
          }
        });
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [pathname]);
  return null;
}
