import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/media-videos.css";

export const metadata: Metadata = { title: "Videos - 505th EF" };

/** Converted 1:1 from the live media-videos.html (content after the shared shell). */
export default function MediaVideosPage() {
  return (
    <SiteShell styles={shellB}>
      <main className="media-page-content relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] [min-height:calc(100vh_-_110px)] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem] [.media-page-content_&]:[max-width:1400px] [.media-page-content_&]:[margin:0_auto] [.media-page-content_&]:[padding:3rem_2rem]">
          <div className="page-intro text-center [margin-bottom:3rem]">
            <h1>
              VIDEOS
            </h1>
            <p>
              505TH EXPEDITIONARY FORCE — GAMEPLAY &amp; OPERATIONS FOOTAGE
            </p>
          </div>
          <div className="media-count [color:var(--text-muted)] [font-size:0.85rem] [letter-spacing:2px] [margin-bottom:1.5rem]">
            VIDEOS:
            <span id="mediaItemCount">
              0
            </span>
          </div>
          <div className="dyn-video-grid grid [grid-template-columns:repeat(auto-fill,minmax(400px,1fr))] [gap:2rem] max-[768px]:[grid-template-columns:1fr]" id="dynamicMediaGrid">
            <div className="no-media-msg text-center [padding:4rem_2rem] [color:var(--text-muted)] [font-size:1rem] [letter-spacing:3px]">
              LOADING...
            </div>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
