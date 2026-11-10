import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/resources-keybinds.css";

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
                Apply these in your Arma 3 options under the listed path. More keybinds will be added as documentation is completed.
            <br />
            <strong>
              Note:
            </strong>
            "Unbind" means remove the existing bind entirely to prevent conflicts.
          </div>
          <div style={{background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.15)', padding: '0.5rem 1.2rem', marginBottom: '2rem', fontSize: '0.78rem', letterSpacing: '0.08em', color: 'rgba(0,217,255,0.6)'}}>
            🚧  MORE KEYBINDS BEING DOCUMENTED — PAGE WILL BE UPDATED
          </div>
          <div style={{overflowX: 'auto'}}>
            <table className="kb-table w-full [border-collapse:collapse]" style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{borderBottom: '2px solid rgba(0,217,255,0.3)'}}>
                  <th style={{textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.68rem', letterSpacing: '0.15em', color: 'rgba(0,217,255,0.6)', fontWeight: '700', width: '90px'}}>
                    ACTION
                  </th>
                  <th style={{textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.68rem', letterSpacing: '0.15em', color: 'rgba(0,217,255,0.6)', fontWeight: '700', width: '200px'}}>
                    KEYBIND
                  </th>
                  <th style={{textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.68rem', letterSpacing: '0.15em', color: 'rgba(0,217,255,0.6)', fontWeight: '700'}}>
                    EXPLANATION
                  </th>
                  <th style={{textAlign: 'left', padding: '0.6rem 0.8rem', fontSize: '0.68rem', letterSpacing: '0.15em', color: 'rgba(0,217,255,0.6)', fontWeight: '700'}}>
                    WHERE TO FIND
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} style={{padding: '0.8rem 0.8rem 0.4rem', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: '700', borderBottom: '1px solid rgba(0,217,255,0.2)'}}>
                    ⚙ REQUIRED CHANGES
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-change inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:#FFD700] [&&]:[border-color:#FFD700]">
                      CHANGE
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    Throw =
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      G
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      G
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Double-tap G to throw grenade — prevents accidental mass casualty events
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-bind inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:#7FFF7F] [&&]:[border-color:#7FFF7F]">
                      BIND
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    Vehicle Quick Mount
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Easy and fast mounting of vehicles
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Addons → ACE Movement
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-bind inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:#7FFF7F] [&&]:[border-color:#7FFF7F]">
                      BIND
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    Webknights Melee =
                    <span style={{color: 'rgba(0,217,255,0.6)', fontStyle: 'italic', fontSize: '0.82rem'}}>
                      Your preferred key
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Set to any key of your choice — avoid F (fire mode) and G (grenade)
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Addons → Webknights Melee
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-unbind inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:#FF8888] [&&]:[border-color:#FF8888]">
                      UNBIND
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    Lago Melee
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Remove to prevent conflict with Webknights Melee
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Addons → Lago Melee
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{padding: '0.8rem 0.8rem 0.4rem', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: '700', borderBottom: '1px solid rgba(0,217,255,0.2)'}}>
                    ⬆ MOVEMENT
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      W
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      A
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      S
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      D
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Move forward, left, back, right
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Movement
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      Shift
                    </span>
                    <span style={{color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', margin: '0 2px'}}>
                      +
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      W
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Sprint — hold Shift while moving forward
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Movement
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      C
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      C
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Double-tap C — toggle between walk and jog speed
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Movement
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      Z
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Go prone — reduces profile, increases accuracy
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Movement
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      X
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Crouch
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Movement
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{padding: '0.8rem 0.8rem 0.4rem', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: '700', borderBottom: '1px solid rgba(0,217,255,0.2)'}}>
                    🎯 COMBAT &amp; WEAPONS
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      LMB
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Fire weapon
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      RMB
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Aim down sights / use optic
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      Ctrl
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      Ctrl
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Double-tap Ctrl — lower / raise weapon
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      R
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Reload
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      G
                    </span>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      G
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Throw grenade — double-tap to prevent accidents
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      8
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Cycle grenade / throw mode selection
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{padding: '0.8rem 0.8rem 0.4rem', fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: '700', borderBottom: '1px solid rgba(0,217,255,0.2)'}}>
                    🔫 WEAPON SLOTS
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      1
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Primary weapon (rifle / LMG)
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      2
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Secondary weapon (pistol / sidearm)
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      3
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Launcher (rocket / AT weapon)
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
                <tr style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '0.75rem 0.8rem'}}>
                    <span className="kb-action-badge kb-default inline-block [font-size:0.62rem] [font-weight:700] [letter-spacing:0.1em] [padding:0.2rem_0.55rem] [border:1px_solid] [font-family:'Rajdhani',sans-serif] whitespace-nowrap [color:rgba(0,217,255,0.7)] [&&]:[border-color:rgba(0,217,255,0.4)]">
                      DEFAULT
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600', letterSpacing: '0.03em'}}>
                    <span className="key inline-flex items-center justify-center [background:var(--bg-card)] [border:1px_solid_rgba(0,217,255,0.45)] [&&]:[border-bottom:2px_solid_rgba(0,217,255,0.6)] [color:var(--text-primary)] [font-family:'Rajdhani',sans-serif] [font-size:0.72rem] [font-weight:700] [letter-spacing:0.05em] [padding:0.18rem_0.45rem] [min-width:28px] text-center whitespace-nowrap">
                      0
                    </span>
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Holster — put weapon away to belt/sling
                  </td>
                  <td style={{padding: '0.75rem 0.8rem', fontSize: '0.82rem', color: 'rgba(0,217,255,0.55)', letterSpacing: '0.03em'}}>
                    Controls → Weapons
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
