import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/resources-field-lexicon.css";

export const metadata: Metadata = { title: "Field Lexicon — 505th Expeditionary Force" };

/** Converted 1:1 from the live resources-field-lexicon.html (content after the shared shell). */
export default function ResourcesFieldLexiconPage() {
  return (
    <SiteShell styles={shellB}>
      <main className="homepage-content [min-height:calc(100vh_-_110px)] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem]">
          <section style={{padding: '3rem 0 1.5rem'}}>
            <h1 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              FIELD LEXICON
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h1>
            <p className="lexicon-header-sub text-center [color:var(--text-secondary)] [font-size:0.9rem] [letter-spacing:0.1em] [margin-bottom:2.5rem]">
              COMMONLY USED TERMS, ABBREVIATIONS &amp; DEFINITIONS // 505TH EXPEDITIONARY FORCE
            </p>
          </section>
          <div className="lexicon-search-bar flex items-center [gap:1rem] [margin-bottom:2rem]">
            <input className="lexicon-search flex-1 [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.35)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:1rem] [padding:0.6rem_1rem] [letter-spacing:0.05em] [outline:none] [max-width:480px] placeholder:[color:rgba(255,255,255,0.3)] focus:[border-color:var(--accent)] focus:[box-shadow:0_0_10px_var(--accent-glow)]" id="lexiconSearch" placeholder="Search terms or definitions..." type="text" />
            <span className="lexicon-count [font-size:0.78rem] [letter-spacing:0.1em] [color:rgba(255,255,255,0.35)] [margin-left:auto]" id="lexiconCount"></span>
          </div>
          <div className="lexicon-categories flex [gap:0.5rem] [flex-wrap:wrap] [margin-bottom:2rem]">
            <button className="cat-btn active [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="">
              All Categories
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="general">
              General Military
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="unsc">
              UNSC / Halo Lore
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="arma">
              Arma 3 / ACE
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="optre">
              OPTRE Mod
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="comms">
              Communications
            </button>
            <button className="cat-btn [background:none] [border:1px_solid_rgba(0,217,255,0.25)] [color:var(--text-secondary)] [font-family:'Rajdhani',sans-serif] [font-size:0.78rem] [font-weight:600] [letter-spacing:0.1em] [padding:0.3rem_0.8rem] cursor-pointer uppercase [transition:all_0.2s] hover:[border-color:var(--accent)] hover:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[color:var(--accent)]" data-cat="medical">
              Medical
            </button>
          </div>
          <div className="lexicon-alpha-nav flex [flex-wrap:wrap] [gap:0.4rem] [margin-bottom:2.5rem]" id="alphaNav"></div>
          <div id="lexiconBody"></div>
        </div>
      </main>
    </SiteShell>
  );
}
