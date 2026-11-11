import type { Metadata } from "next";
import MediaGrid from "@/components/media/MediaGrid";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/media-gallery.css";

export const metadata: Metadata = { title: "Gallery - 505th EF" };

/** Converted 1:1 from the live media-gallery.html (content after the shared shell). */
export const dynamic = "force-dynamic";

export default async function MediaGalleryPage() {
  return (
    <SiteShell styles={shellB}>
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
          <MediaGrid type="image" />
        </div>
      </main>
    </SiteShell>
  );
}
