"use client";
import { useEffect } from "react";

/**
 * About pages: photo slider (< > buttons, dots, auto-advance 6 s, pause on hover) + click-to-zoom lightbox.
 * Port of the old inline "Photo Slider" + "Lightbox" scripts that the 1:1 conversion dropped.
 * Works on the page's existing markup (#sliderTrack, #sliderPrev/#sliderNext, .slider-dot, #lightbox…).
 * Uses event delegation so images inserted later by CmsApply are clickable too.
 */
export default function AboutEnhance() {
  useEffect(() => {
    const $ = (id: string) => document.getElementById(id);
    const track = $("sliderTrack");
    const dots = Array.from(document.querySelectorAll<HTMLElement>(".slider-dot"));
    const total = dots.length;
    let current = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const go = (i: number) => {
      if (!track || !total) return;
      current = (i + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, n) => { d.classList.toggle("active", n === current); d.setAttribute("aria-current", String(n === current)); });
    };
    const start = () => { stop(); if (total > 1) timer = setInterval(() => go(current + 1), 6000); };
    const stop = () => { if (timer) clearInterval(timer); };

    const prev = () => { go(current - 1); start(); };
    const next = () => { go(current + 1); start(); };
    $("sliderPrev")?.addEventListener("click", prev);
    $("sliderNext")?.addEventListener("click", next);
    const onDot = (e: Event) => { go(Number((e.currentTarget as HTMLElement).dataset.slide || 0)); start(); };
    dots.forEach((d) => {
      d.addEventListener("click", onDot);
      d.setAttribute("role", "button"); d.setAttribute("tabindex", "0");
      d.setAttribute("aria-label", `Slide ${Number(d.dataset.slide || 0) + 1}`);
    });
    const onDotKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDot(e); } };
    dots.forEach((d) => d.addEventListener("keydown", onDotKey));
    const box = document.querySelector(".slider-container");
    box?.addEventListener("mouseenter", stop);
    box?.addEventListener("mouseleave", start);
    start();

    // lightbox
    const overlay = $("lightbox"), lbImg = $("lightboxImg") as HTMLImageElement | null;
    const lbTitle = $("lightboxTitle"), lbDesc = $("lightboxDesc");
    const open = (src: string, title: string, desc: string) => {
      if (!overlay || !lbImg || !src) return;
      lbImg.src = src;
      if (lbTitle) lbTitle.textContent = title;
      if (lbDesc) lbDesc.textContent = desc;
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
    };
    const close = () => { overlay?.classList.remove("active"); document.body.style.overflow = ""; };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element;
      if (overlay?.classList.contains("active")) { if (overlay.contains(t)) close(); return; }
      const w = t.closest?.(".slider-image-wrapper, .equipment-image");
      const img = w?.querySelector("img");
      if (!w || !img) return;
      const card = w.closest(".slider-slide, .equipment-card");
      const h = card?.querySelector(".slider-description h4, .equipment-info h4")?.textContent || "";
      const p = card?.querySelector(".slider-description p, .equipment-info p")?.textContent || "";
      open(img.src, h, p);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      stop();
      $("sliderPrev")?.removeEventListener("click", prev);
      $("sliderNext")?.removeEventListener("click", next);
      dots.forEach((d) => { d.removeEventListener("click", onDot); d.removeEventListener("keydown", onDotKey); });
      box?.removeEventListener("mouseenter", stop);
      box?.removeEventListener("mouseleave", start);
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  return null;
}
