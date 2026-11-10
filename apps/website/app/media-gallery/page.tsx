import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/media-gallery.css";

export const metadata: Metadata = { title: "Gallery - 505th EF" };

/** Converted 1:1 from the live media-gallery.html (content after the shared shell). */
export default function MediaGalleryPage() {
  return (
    <SiteShell styles={shellB}>
      <div className="lightbox fixed [top:0] [left:0] [right:0] [bottom:0] [background:rgba(0,0,0,0.92)] [z-index:3000] hidden items-center justify-center cursor-pointer [&.active]:[display:flex]" id="lightbox">
        <span className="lightbox-close absolute [top:20px] [right:30px] [color:#fff] [font-size:2rem] cursor-pointer [z-index:3001]">
          ×
        </span>
        <img alt="" id="lightboxImg" />
      </div>
      <main className="media-page-content relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] [min-height:calc(100vh_-_110px)] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem] [.media-page-content_&]:[max-width:1400px] [.media-page-content_&]:[margin:0_auto] [.media-page-content_&]:[padding:3rem_2rem]">
          <div className="page-intro text-center [margin-bottom:3rem]">
            <h1>
              GALLERY
            </h1>
            <p>
              505TH EXPEDITIONARY FORCE — OPERATIONS &amp; EVENTS
            </p>
          </div>
          <div className="media-count [color:var(--text-muted)] [font-size:0.85rem] [letter-spacing:2px] [margin-bottom:1.5rem]">
            IMAGES:
            <span id="mediaItemCount">
              0
            </span>
          </div>
          <div className="dyn-gallery-grid grid [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] [gap:1.5rem] max-[768px]:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))] max-[768px]:[gap:1rem]" id="dynamicMediaGrid">
            <div className="no-media-msg text-center [padding:4rem_2rem] [color:var(--text-muted)] [font-size:1rem] [letter-spacing:3px]">
              LOADING...
            </div>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
