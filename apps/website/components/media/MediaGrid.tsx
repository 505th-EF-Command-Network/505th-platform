import { getMedia } from "@/lib/public/content";
import { embedUrl } from "@/lib/public/embed";
import Lightbox from "./Lightbox";

/** Server-rendered Gallery / Videos grid (restores the old media-gallery / media-videos scripts). */
export default async function MediaGrid({ type }: { type: "image" | "video" }) {
  let items: Awaited<ReturnType<typeof getMedia>> = [];
  try { items = await getMedia(type); } catch { /* show empty state */ }
  const label = type === "image" ? "IMAGES" : "VIDEOS";
  const empty = (
    <div className="no-media-msg text-center [padding:4rem_2rem] [color:var(--text-muted)] [font-size:1rem] [letter-spacing:3px] [grid-column:1/-1]">
      NO {label} YET
    </div>
  );
  return (
    <>
      <div className="media-count [color:var(--text-muted)] [font-size:0.85rem] [letter-spacing:2px] [margin-bottom:1.5rem]">
        {label}: <span id="mediaItemCount">{items.length}</span>
      </div>
      {type === "image" ? (
        <>
          <Lightbox />
          <div className="dyn-gallery-grid grid [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] [gap:1.5rem] max-[768px]:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] max-[768px]:[gap:1rem]" id="dynamicMediaGrid">
            {items.length ? items.map((m, i) => (
              <button key={i} type="button" data-lightbox={m.url} aria-label={`Open ${m.name || "image"}`}
                className="dyn-gallery-item block w-full cursor-pointer overflow-hidden border border-[rgba(0,217,255,0.2)] bg-[rgba(10,20,30,0.6)] p-0 text-left transition hover:border-[rgba(0,217,255,0.6)] focus-visible:outline-2 focus-visible:outline-[#00D9FF]">
                <div className="dyn-gallery-img aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.name || "505th image"} loading="lazy" />
                </div>
                {(m.name || m.category) && (
                  <div className="px-3 py-2">
                    {m.name && <div className="text-[0.8rem] font-bold tracking-[1px] text-[#E8EEF2]">{m.name}</div>}
                    {m.category && <div className="text-[0.65rem] tracking-[2px] text-[#00D9FF]">{m.category.toUpperCase()}</div>}
                  </div>
                )}
              </button>
            )) : empty}
          </div>
        </>
      ) : (
        <div className="dyn-video-grid grid [grid-template-columns:repeat(auto-fill,minmax(400px,1fr))] [gap:2rem] max-[768px]:[grid-template-columns:1fr]" id="dynamicMediaGrid">
          {items.length ? items.map((m, i) => {
            const e = embedUrl(m.url);
            return (
              <div key={i} className="dyn-video-item border border-[rgba(0,217,255,0.2)] bg-[rgba(10,20,30,0.6)]">
                <div className="dyn-video-embed relative aspect-video">
                  {e?.kind === "iframe" ? (
                    <iframe src={e.src} title={m.name || "505th video"} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  ) : e?.kind === "video" ? (
                    <video src={e.src} controls preload="metadata" />
                  ) : (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center text-[#00D9FF]">OPEN VIDEO ↗</a>
                  )}
                </div>
                {(m.name || m.description) && (
                  <div className="video-description px-4 py-3">
                    {m.name && <h3 className="text-[0.9rem] tracking-[1px]">{m.name}</h3>}
                    {m.description && <p>{m.description}</p>}
                  </div>
                )}
              </div>
            );
          }) : empty}
        </div>
      )}
    </>
  );
}
