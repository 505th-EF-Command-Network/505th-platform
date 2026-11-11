import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellA } from "@/components/shell-styles";
import "@/styles/tw/about-505th.css";
import "@/styles/tw/unit-cards.css";
import UnitCards from "@/components/UnitCards";
import { getBattalionStats } from "@/lib/units/cards";

export const metadata: Metadata = { title: "505th Expeditionary Force - 505th" };

/** Converted 1:1 from the live about-505th.html (content after the shared shell). */
export const dynamic = "force-dynamic";

export default async function About505thPage() {
  const stats = await getBattalionStats().catch(() => null);
  return (
    <SiteShell styles={shellA}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div className="page-header text-center [margin-bottom:3rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)]">
            <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem]">
              UNITED NATIONS SPACE COMMAND
            </span>
            <h1>
              505TH EXPEDITIONARY FORCE
            </h1>
            <p className="version [color:var(--text-secondary)] [font-size:1rem] [letter-spacing:2px] [margin-top:0.5rem]">
              Established 2025 • Combined Arms Warfare
            </p>
            <div className="header-line [width:100px] [height:3px] [background:var(--accent)] [margin:1.5rem_auto_0] [box-shadow:0_0_10px_var(--accent-glow)]"></div>
          </div>
          <div className="patch-container text-center [margin:2rem_0] [padding:2rem] [background:var(--bg-card)] [border:2px_solid_var(--accent)] [box-shadow:0_4px_20px_rgba(0,217,255,0.2)]">
            <img alt="505th Expeditionary Force Logo" className="stalker-patch [width:300px] [height:auto] [filter:drop-shadow(0_0_20px_rgba(255,215,0,0.3))] [transition:all_0.3s_ease] hover:[transform:scale(1.05)] hover:[filter:drop-shadow(0_0_30px_rgba(255,215,0,0.5))] max-[768px]:[width:200px]" src="/images/logo.png" />
          </div>
          <div className="unit-intro [background:var(--bg-card)] [border-left:4px_solid_var(--accent)] [padding:2rem] [margin-bottom:3rem] [box-shadow:0_4px_20px_rgba(0,217,255,0.1)]">
            <h2>
              Our Legacy
            </h2>
            <p>
              The 505th Expeditionary Force was established in 2025 under the command of Lt. General Drake P. Oliver with a singular mission: to forge a combined-arms fighting force capable of decisive action across any theatre of operations. What began as a small cadre of dedicated operators has grown into a multi-branch expeditionary unit spanning infantry, special operations, medical, and aviation assets. Built on the principles of tactical realism, teamwork, and operational excellence, the 505th operates as a cohesive fighting force where every marine, corpsman, pilot, and operator plays a critical role in mission success.
            </p>
          </div>
          <section className="photo-slider-section [margin:3rem_0]">
            <h3 data-cms-slot="slider_header" data-cms-type="text">
              SLIDER HEADER TITLE - Set via Admin Panel
            </h3>
            <div className="slider-container relative [width:500px] [height:500px] overflow-hidden [background:var(--bg-card)] [border:2px_solid_var(--primary)] [margin:0_auto] max-[768px]:[width:100%] max-[768px]:[height:auto]">
              <div className="slider-track flex [transition:transform_0.5s_ease] [width:500px] max-[768px]:[width:100%]" id="sliderTrack">
                <div className="slider-slide [min-width:500px] [width:500px] flex flex-col max-[768px]:[min-width:100%] max-[768px]:[width:100%]">
                  <div className="slider-image-wrapper [width:500px] [height:500px] shrink-0 [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)] max-[768px]:[width:100%] max-[768px]:[height:auto] max-[768px]:[aspect-ratio:1_/_1]" data-cms-slot="slider_1" data-cms-type="image">
                    <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                      SLIDE 1 - Set via Admin Panel
                    </span>
                  </div>
                  <div className="slider-description [padding:1.5rem_2rem] [background:var(--bg-elevated)]">
                    <h4 data-cms-slot="slider_1_title" data-cms-type="text">
                      Title - Set via Admin Panel
                    </h4>
                    <p data-cms-slot="slider_1_desc" data-cms-type="text">
                      Description - Set via Admin Panel
                    </p>
                  </div>
                </div>
                <div className="slider-slide [min-width:500px] [width:500px] flex flex-col max-[768px]:[min-width:100%] max-[768px]:[width:100%]">
                  <div className="slider-image-wrapper [width:500px] [height:500px] shrink-0 [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)] max-[768px]:[width:100%] max-[768px]:[height:auto] max-[768px]:[aspect-ratio:1_/_1]" data-cms-slot="slider_2" data-cms-type="image">
                    <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                      SLIDE 2 - Set via Admin Panel
                    </span>
                  </div>
                  <div className="slider-description [padding:1.5rem_2rem] [background:var(--bg-elevated)]">
                    <h4 data-cms-slot="slider_2_title" data-cms-type="text">
                      Title - Set via Admin Panel
                    </h4>
                    <p data-cms-slot="slider_2_desc" data-cms-type="text">
                      Description - Set via Admin Panel
                    </p>
                  </div>
                </div>
                <div className="slider-slide [min-width:500px] [width:500px] flex flex-col max-[768px]:[min-width:100%] max-[768px]:[width:100%]">
                  <div className="slider-image-wrapper [width:500px] [height:500px] shrink-0 [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)] max-[768px]:[width:100%] max-[768px]:[height:auto] max-[768px]:[aspect-ratio:1_/_1]" data-cms-slot="slider_3" data-cms-type="image">
                    <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                      SLIDE 3 - Set via Admin Panel
                    </span>
                  </div>
                  <div className="slider-description [padding:1.5rem_2rem] [background:var(--bg-elevated)]">
                    <h4 data-cms-slot="slider_3_title" data-cms-type="text">
                      Title - Set via Admin Panel
                    </h4>
                    <p data-cms-slot="slider_3_desc" data-cms-type="text">
                      Description - Set via Admin Panel
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="slider-controls flex items-center justify-center [gap:1rem] [padding:1rem_0]">
              <button aria-label="Previous slide" className="slider-btn [background:var(--bg-elevated)] [color:var(--accent)] [border:2px_solid_var(--accent)] [width:40px] [height:40px] cursor-pointer [font-size:1.2rem] [font-family:var(--font-heading)] [font-weight:700] [transition:all_0.3s_ease] flex items-center justify-center hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" id="sliderPrev">
                &lt;
              </button>
              <div className="slider-dots flex [gap:0.5rem]" id="sliderDots">
                <div className="slider-dot active [width:12px] [height:12px] [border:2px_solid_var(--accent)] [background:transparent] cursor-pointer [transition:all_0.3s_ease] [&.active]:[background:var(--accent)] [&.active]:[box-shadow:0_0_8px_var(--accent-glow)] hover:[background:rgba(0,217,255,0.4)]" data-slide="0"></div>
                <div className="slider-dot [width:12px] [height:12px] [border:2px_solid_var(--accent)] [background:transparent] cursor-pointer [transition:all_0.3s_ease] [&.active]:[background:var(--accent)] [&.active]:[box-shadow:0_0_8px_var(--accent-glow)] hover:[background:rgba(0,217,255,0.4)]" data-slide="1"></div>
                <div className="slider-dot [width:12px] [height:12px] [border:2px_solid_var(--accent)] [background:transparent] cursor-pointer [transition:all_0.3s_ease] [&.active]:[background:var(--accent)] [&.active]:[box-shadow:0_0_8px_var(--accent-glow)] hover:[background:rgba(0,217,255,0.4)]" data-slide="2"></div>
              </div>
              <button aria-label="Next slide" className="slider-btn [background:var(--bg-elevated)] [color:var(--accent)] [border:2px_solid_var(--accent)] [width:40px] [height:40px] cursor-pointer [font-size:1.2rem] [font-family:var(--font-heading)] [font-weight:700] [transition:all_0.3s_ease] flex items-center justify-center hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" id="sliderNext">
                &gt;
              </button>
            </div>
          </section>
          <section className="specializations-section [margin:3rem_0]">
            <h3>
              FORCE STRUCTURE
            </h3>
            <div className="spec-grid grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] [gap:1.5rem] [margin-bottom:3rem] max-[768px]:[grid-template-columns:1fr]">
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Alpha Company
                </h4>
                <p>
                  The backbone of the 505th. Line infantry trained in combined arms warfare, urban operations, and sustained combat operations.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  JTF-23 Force Recon
                </h4>
                <p>
                  Special operations element specializing in deep reconnaissance, direct action, and precision strike operations behind enemy lines.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Hospital Corpsman
                </h4>
                <p>
                  Combat medical specialists providing life-saving care under fire and maintaining unit readiness through advanced trauma medicine.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  54th Air Wing
                </h4>
                <p>
                  Aviation assets providing close air support, transport, medevac, and air superiority across all operational theatres.
                </p>
              </div>
            </div>
          </section>
          <section className="equipment-section [margin:3rem_0]">
            <h3 data-cms-slot="cards_header" data-cms-type="text">
              PHOTO HEADER TITLE - Set via Admin Panel
            </h3>
            <div className="equipment-grid grid [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] [gap:2rem] max-[768px]:[grid-template-columns:1fr]">
              <div className="equipment-card [background:var(--bg-card)] [border:2px_solid_var(--primary)] overflow-hidden [transition:all_0.3s_ease] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.3)] hover:[transform:translateY(-5px)]">
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="marine_1" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="marine_1_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="marine_1_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
              <div className="equipment-card [background:var(--bg-card)] [border:2px_solid_var(--primary)] overflow-hidden [transition:all_0.3s_ease] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.3)] hover:[transform:translateY(-5px)]">
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="marine_2" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="marine_2_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="marine_2_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
              <div className="equipment-card [background:var(--bg-card)] [border:2px_solid_var(--primary)] overflow-hidden [transition:all_0.3s_ease] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.3)] hover:[transform:translateY(-5px)]">
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="marine_3" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="marine_3_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="marine_3_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
            </div>
          </section>
          <div className="motto-section [background:linear-gradient(135deg,var(--primary-dark)_0%,var(--bg-elevated)_100%)] [border:2px_solid_var(--accent)] [padding:3rem_2rem] [margin:3rem_0] text-center relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:100%] before:[background:radial-gradient(circle_at_center,rgba(0,217,255,0.05)_0%,transparent_70%)] before:[z-index:0]">
            <div className="content [.motto-section_&]:[position:relative] [.motto-section_&]:[z-index:1]">
              <h3>
                505TH EXPEDITIONARY FORCE
              </h3>
              <p>
                One Force. One Fight. One Victory.
              </p>
            </div>
          </div>
          <div className="stat-strip flex [gap:12px] [flex-wrap:wrap]" style={{marginBottom: '2rem'}}>
            <a className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] flex-1 [min-width:120px] text-center" href="/resources-roster" style={{textDecoration: 'none', cursor: 'pointer', transition: 'border-color .2s'}}>
              <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1]" id="statDaysService" style={{color: 'var(--accent)'}}>
                {stats?.days || "—"}
              </span>
              <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                DAYS IN SERVICE
              </span>
            </a>
            <a className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] flex-1 [min-width:120px] text-center" href="/resources-roster" style={{textDecoration: 'none', cursor: 'pointer', transition: 'border-color .2s'}}>
              <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1]" id="statActiveCount" style={{color: '#7FFF7F'}}>
                {stats?.active ?? "—"}
              </span>
              <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                ACTIVE
              </span>
            </a>
            <a className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] flex-1 [min-width:120px] text-center" href="resources-roster.html?platoon=Reserves" style={{textDecoration: 'none', cursor: 'pointer', transition: 'border-color .2s'}}>
              <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1]" id="statReserveCount" style={{color: '#FFD700'}}>
                {stats?.reserves ?? "—"}
              </span>
              <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                RESERVES
              </span>
            </a>
            <a className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] flex-1 [min-width:120px] text-center" href="/resources-roster" style={{textDecoration: 'none', cursor: 'pointer', transition: 'border-color .2s'}}>
              <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1]" id="statDetachCount" style={{color: 'var(--accent)'}}>
                {stats?.detachments ?? "—"}
              </span>
              <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                ACTIVE DETACHMENTS
              </span>
            </a>
          </div>
          <section style={{marginBottom: '3rem'}}>
            <h3 style={{fontFamily: "'Rajdhani',sans-serif", color: 'var(--accent)', fontSize: '1.8rem', letterSpacing: '4px', textAlign: 'center', marginBottom: '1.5rem', textShadow: '0 0 10px var(--accent-glow)'}}>
              BATTALION COMMAND
            </h3>
            <UnitCards id="bc" />
          </section>
          <div className="cta-box [background:var(--bg-elevated)] [border:2px_solid_var(--accent)] [padding:2rem] [margin:3rem_0] text-center">
            <h3>
              JOIN THE 505TH
            </h3>
            <p>
              Ready to be part of something greater? The 505th Expeditionary Force is always looking for dedicated operators. Join our Discord to begin your journey.
            </p>
            <a className="cta-button inline-flex items-center [gap:1rem] [background:var(--primary)] [color:var(--text-primary)] [padding:1rem_2rem] [border:2px_solid_var(--accent)] [font-weight:700] [font-size:1.1rem] [letter-spacing:2px] [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_20px_var(--accent-glow)] hover:[transform:translateY(-3px)]" href="https://discord.gg/uh8ax8MhNb" target="_blank">
              <span>
                JOIN DISCORD
              </span>
            </a>
          </div>
        </div>
      </main>
      <div className="lightbox-overlay fixed [top:0] [left:0] w-full h-full [background:rgba(5,7,9,0.95)] [backdrop-filter:blur(8px)] [z-index:5000] flex items-center justify-center [opacity:0] [visibility:hidden] [transition:all_0.3s_ease] [cursor:zoom-out] [&.active]:[opacity:1] [&.active]:[visibility:visible]" id="lightbox">
        <div className="lightbox-content relative [max-width:90vw] [max-height:85vh] flex flex-col items-center">
          <button className="lightbox-close absolute [top:-40px] [right:0] [background:transparent] [border:2px_solid_var(--accent)] [color:var(--accent)] [width:36px] [height:36px] [font-size:1.2rem] cursor-pointer [transition:all_0.3s_ease] [font-family:var(--font-heading)] flex items-center justify-center hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" id="lightboxClose">
            ×
          </button>
          <img alt="" id="lightboxImg" />
          <div className="lightbox-caption [margin-top:1rem] text-center">
            <h4 id="lightboxTitle"></h4>
            <p id="lightboxDesc"></p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
