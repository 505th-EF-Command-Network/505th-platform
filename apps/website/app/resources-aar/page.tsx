import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/resources-aar.css";
import AarLive from "@/components/AarLive";
import { getPublicAars } from "@/lib/aar/public";

export const metadata: Metadata = { title: "After Action Reports — 505th Expeditionary Force" };
export const dynamic = "force-dynamic";

/** Public AAR archive — redesign approved 2026-11-11 (stats + success rate, chip filters, featured latest, monthly archive). */
export default async function ResourcesAarPage() {
  const aars = await getPublicAars().catch(() => []);
  return (
    <SiteShell styles={shellB}>
      <main className="homepage-content [min-height:calc(100vh_-_110px)] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem]">
          <section className="aar-page-header [padding:3rem_0_2rem] text-center">
            <h1 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              AFTER ACTION REPORTS
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h1>
            <p>
              OPERATIONAL MISSION ARCHIVE // 505TH EXPEDITIONARY FORCE
            </p>
          </section>
          <div className="aar2-stats">
            <div className="aar2-stat"><b id="statTotal">0</b><span>TOTAL OPERATIONS</span></div>
            <div className="aar2-stat"><b id="statMajor">0</b><span>OPERATIONS</span></div>
            <div className="aar2-stat"><b id="statRegular">0</b><span>DEPLOYMENTS</span></div>
            <div className="aar2-stat ok"><b id="statRate">—</b><span>SUCCESS RATE</span></div>
          </div>
          <div className="aar2-filters" role="group" aria-label="Filter reports">
            <span className="aar2-k">UNIT</span>
            <button type="button" className="on" data-f="unit" data-v="">ALL</button>
            <button type="button" data-f="unit" data-v="combined">BATTALION</button>
            <button type="button" data-f="unit" data-v="alpha">ALPHA</button>
            <button type="button" data-f="unit" data-v="forcerecon">JTF-23</button>
            <button type="button" data-f="unit" data-v="corpsman">CORPSMAN</button>
            <button type="button" data-f="unit" data-v="airwing">54TH AIR</button>
            <span className="aar2-k">RESULT</span>
            <button type="button" className="on" data-f="result" data-v="">ALL</button>
            <button type="button" data-f="result" data-v="success">✓ SUCCESS</button>
            <button type="button" data-f="result" data-v="partial">◐ PARTIAL</button>
            <button type="button" data-f="result" data-v="failure">✕ FAILED</button>
            <input className="aar2-search" id="aarSearch" placeholder="Search operations..." type="search" aria-label="Search operations" />
          </div>
          <div id="aarGrid" aria-live="polite">
            <div className="aar-loading">RETRIEVING OPERATIONAL DATA...</div>
          </div>
        </div>
      </main>
      <div className="aar-modal-overlay hidden fixed [inset:0] [background:rgba(0,0,0,0.85)] [z-index:9000] [overflow-y:auto] [padding:2rem] [&.active]:[display:flex] [&.active]:[justify-content:center] [&.active]:[align-items:flex-start]" id="aarModal">
        <div className="aar-modal [background:var(--bg-secondary,#0D1117)] [border:1px_solid_var(--accent)] [box-shadow:0_0_40px_var(--accent-glow)] [max-width:780px] w-full [padding:2.5rem] relative [margin:auto] max-[600px]:[padding:1.5rem]" id="aarModalContent">
          <button className="aar-modal-close absolute [top:1rem] [right:1.5rem] [background:none] [border:none] [color:var(--text-secondary)] [font-size:1.4rem] cursor-pointer [line-height:1] hover:[color:var(--accent)]" id="aarModalClose">
            ✕
          </button>
        </div>
      </div>
      <AarLive aars={aars} />
    </SiteShell>
  );
}
