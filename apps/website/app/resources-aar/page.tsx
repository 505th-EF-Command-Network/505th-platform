import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/resources-aar.css";

export const metadata: Metadata = { title: "After Action Reports — 505th Expeditionary Force" };

/** Converted 1:1 from the live resources-aar.html (content after the shared shell). */
export default function ResourcesAarPage() {
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
          <div className="aar-stats-bar flex [gap:2rem] [margin-bottom:2rem] [padding:1rem_1.5rem] [background:var(--bg-card)] [border-left:3px_solid_var(--accent)] max-[600px]:[flex-wrap:wrap] max-[600px]:[gap:1rem]" id="aarStatsBar">
            <div className="aar-stat flex flex-col items-center">
              <span className="aar-stat-num [font-size:1.6rem] [font-weight:700] [color:var(--accent)] [line-height:1]" id="statTotal">
                —
              </span>
              <span className="aar-stat-label [font-size:0.9rem] [letter-spacing:0.1em] [color:var(--text-secondary)] uppercase">
                Total Operations
              </span>
            </div>
            <div className="aar-stat flex flex-col items-center">
              <span className="aar-stat-num [font-size:1.6rem] [font-weight:700] [color:var(--accent)] [line-height:1]" id="statMajor">
                —
              </span>
              <span className="aar-stat-label [font-size:0.9rem] [letter-spacing:0.1em] [color:var(--text-secondary)] uppercase">
                Main Ops
              </span>
            </div>
            <div className="aar-stat flex flex-col items-center">
              <span className="aar-stat-num [font-size:1.6rem] [font-weight:700] [color:var(--accent)] [line-height:1]" id="statRegular">
                —
              </span>
              <span className="aar-stat-label [font-size:0.9rem] [letter-spacing:0.1em] [color:var(--text-secondary)] uppercase">
                Deployments
              </span>
            </div>
            <div className="aar-stat flex flex-col items-center">
              <span className="aar-stat-num [font-size:1.6rem] [font-weight:700] [color:var(--accent)] [line-height:1]" id="statPatrol">
                —
              </span>
              <span className="aar-stat-label [font-size:0.9rem] [letter-spacing:0.1em] [color:var(--text-secondary)] uppercase">
                Patrols
              </span>
            </div>
          </div>
          <div className="aar-filters flex [gap:1rem] [flex-wrap:wrap] [margin-bottom:2.5rem] items-center max-[600px]:[flex-direction:column] max-[600px]:[align-items:flex-start]">
            <label>
              UNIT
            </label>
            <select className="aar-filter-select [background:var(--bg-card)] [border:1px_solid_var(--accent)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [padding:0.4rem_0.8rem] [letter-spacing:0.05em] cursor-pointer [outline:none] focus:[border-color:var(--accent)] focus:[box-shadow:0_0_8px_var(--accent-glow)]" id="filterUnit">
              <option value="">
                All Units
              </option>
              <option value="alpha">
                Alpha Company
              </option>
              <option value="forcerecon">
                JTF-23 Force Recon
              </option>
              <option value="corpsman">
                Hospital Corpsman
              </option>
              <option value="airwing">
                54th Air Wing
              </option>
              <option value="combined">
                Combined Arms
              </option>
            </select>
            <label>
              TYPE
            </label>
            <select className="aar-filter-select [background:var(--bg-card)] [border:1px_solid_var(--accent)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [padding:0.4rem_0.8rem] [letter-spacing:0.05em] cursor-pointer [outline:none] focus:[border-color:var(--accent)] focus:[box-shadow:0_0_8px_var(--accent-glow)]" id="filterType">
              <option value="">
                All Types
              </option>
              <option value="main_op">
                Main Op
              </option>
              <option value="patrol">
                Patrol
              </option>
              <option value="deployment">
                Deployment
              </option>
              <option value="fun_op">
                Fun Op
              </option>
            </select>
            <label>
              RESULT
            </label>
            <select className="aar-filter-select [background:var(--bg-card)] [border:1px_solid_var(--accent)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [padding:0.4rem_0.8rem] [letter-spacing:0.05em] cursor-pointer [outline:none] focus:[border-color:var(--accent)] focus:[box-shadow:0_0_8px_var(--accent-glow)]" id="filterResult">
              <option value="">
                All Results
              </option>
              <option value="success">
                Mission Success
              </option>
              <option value="partial">
                Partial Success
              </option>
              <option value="failure">
                Mission Failure
              </option>
            </select>
            <input className="aar-search [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.3)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [padding:0.4rem_0.8rem] [width:220px] [letter-spacing:0.05em] [outline:none] [margin-left:auto] placeholder:[color:rgba(255,255,255,0.3)] focus:[border-color:var(--accent)] focus:[box-shadow:0_0_8px_var(--accent-glow)] max-[600px]:[margin-left:0] max-[600px]:[width:100%]" id="aarSearch" placeholder="Search operations..." type="text" />
          </div>
          <div className="aar-grid grid [grid-template-columns:repeat(auto-fill,minmax(340px,1fr))] [gap:1.5rem] [margin-bottom:3rem]" id="aarGrid">
            <div className="aar-loading text-center [padding:4rem] [color:var(--accent)] [letter-spacing:0.15em] [font-size:1.15rem] [grid-column:1_/_-1]">
              RETRIEVING OPERATIONAL DATA...
            </div>
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
    </SiteShell>
  );
}
