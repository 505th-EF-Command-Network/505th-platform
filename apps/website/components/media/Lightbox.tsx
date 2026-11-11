"use client";
import { useEffect, useState } from "react";

/** Click any [data-lightbox] → full-size view. Click / Escape closes. */
export default function Lightbox() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element).closest?.("[data-lightbox]");
      if (b) setSrc(b.getAttribute("data-lightbox"));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSrc(null); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);
  if (!src) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Image viewer" onClick={() => setSrc(null)}
      className="fixed inset-0 z-[3000] flex cursor-pointer items-center justify-center bg-[rgba(0,0,0,0.92)]">
      <button type="button" aria-label="Close" className="absolute right-[30px] top-[20px] z-[3001] text-[2rem] text-white">×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-[90vh] max-w-[92vw] object-contain" />
    </div>
  );
}
