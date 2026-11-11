import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/resources-keybinds.css";
import "@/styles/tw/control-reference.css";
import ControlReference from "@/components/ControlReference";

export const metadata: Metadata = { title: "Control Reference — 505th Expeditionary Force" };

/** Converted 1:1 from the live resources-keybinds.html (content after the shared shell). */
export default function ResourcesKeybindsPage() {
  return (
    <SiteShell styles={shellB}>
      <main className="homepage-content [min-height:calc(100vh_-_110px)] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem]">
          <section style={{padding: '3rem 0 1.5rem'}}>
            <h1 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              CONTROL REFERENCE
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h1>
            <p className="keybind-header-sub text-center [color:var(--text-secondary)] [font-size:0.9rem] [letter-spacing:0.1em] [margin-bottom:2.5rem]">
              REQUIRED CONTROL CHANGES FOR 505TH OPERATIONS // ARMA 3 + ACE3 + OPTRE
            </p>
          </section>
          <div className="keybind-note [background:rgba(0,217,255,0.06)] [border-left:3px_solid_var(--accent)] [padding:0.8rem_1.2rem] [font-size:0.82rem] [color:var(--text-secondary)] [letter-spacing:0.04em] [margin-bottom:2.5rem] [line-height:1.6]">
            This page lists the keybind changes required before joining 505th operations.
                Apply these in your Arma 3 options under the listed path. Tap a glowing key (or a line in the list) to see what it does. More keybinds will be added as documentation is completed.
            <br />
            <strong>
              Note:
            </strong>
            "Unbind" means remove the existing bind entirely to prevent conflicts.
          </div>
          <div style={{background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.15)', padding: '0.5rem 1.2rem', marginBottom: '2rem', fontSize: '0.78rem', letterSpacing: '0.08em', color: 'rgba(0,217,255,0.6)'}}>
            🚧  MORE KEYBINDS BEING DOCUMENTED — PAGE WILL BE UPDATED
          </div>
          <ControlReference />
        </div>
      </main>
    </SiteShell>
  );
}
