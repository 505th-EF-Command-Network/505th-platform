import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellA } from "@/components/shell-styles";
import "@/styles/tw/about-54th-air-wing.css";
import "@/styles/tw/unit-cards.css";
import UnitCards from "@/components/UnitCards";

export const metadata: Metadata = { title: "54th Air Wing - 505th" };

/** Converted 1:1 from the live about-54th-air-wing.html (content after the shared shell). */
export const dynamic = "force-dynamic";

export default async function About54thAirWingPage() {
  return (
    <SiteShell styles={shellA}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div className="page-header text-center [margin-bottom:3rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)]">
            <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem]">
              AVIATION
            </span>
            <h1>
              54TH AIR WING
            </h1>
            <p className="version [color:var(--text-secondary)] [font-size:1rem] [letter-spacing:2px] [margin-top:0.5rem]">
              Air Support &amp; Transport • 505th Expeditionary Force
            </p>
            <div className="header-line [width:100px] [height:3px] [background:var(--accent)] [margin:1.5rem_auto_0] [box-shadow:0_0_10px_var(--accent-glow)]"></div>
          </div>
          <div className="patch-container text-center [margin:2rem_0] [padding:2rem] [background:var(--bg-card)] [border:2px_solid_var(--accent)] [box-shadow:0_4px_20px_rgba(0,217,255,0.2)]">
            <img alt="54th Air Wing Logo" className="stalker-patch [width:300px] [height:auto] [filter:drop-shadow(0_0_20px_rgba(255,215,0,0.3))] [transition:all_0.3s_ease] hover:[transform:scale(1.05)] hover:[filter:drop-shadow(0_0_30px_rgba(255,215,0,0.5))] max-[768px]:[width:200px]" src="/images/logos/54th Air Wing.png" />
          </div>
          <div className="unit-intro [background:var(--bg-card)] [border-left:4px_solid_var(--accent)] [padding:2rem] [margin-bottom:3rem] [box-shadow:0_4px_20px_rgba(0,217,255,0.1)]">
            <h2>
              Dominance From Above
            </h2>
            <p>
              The 54th Air Wing provides the 505th Expeditionary Force with rotary and fixed-wing aviation capabilities spanning close air support, troop transport, casualty evacuation, and air superiority. Our pilots and crew are the backbone of rapid deployment and fire support, ensuring ground forces are never without the umbrella of air power. From precision strikes to hot extractions under fire, the 54th delivers when it matters most. Every mission is flown with discipline, coordination, and an unwavering commitment to the marines on the ground.
            </p>
          </div>
          <div className="philosophy-section [background:var(--bg-card)] [padding:2rem] [margin:3rem_0] [border-left:4px_solid_var(--primary)]">
            <h3>
              Aviation Doctrine
            </h3>
            <p>
              The 54th operates under a doctrine of responsive air support — maintaining aircraft on station, pre-positioned for rapid tasking. Our pilots train extensively in low-altitude flying, nap-of-the-earth navigation, and precision weapons delivery. We integrate seamlessly with ground controllers through standardized 9-line CAS procedures and real-time coordination with JTF-23 Force Recon forward air controllers.
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
                      Photo - Set via Admin Panel
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
                      Photo - Set via Admin Panel
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
                      Photo - Set via Admin Panel
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
              AIR CAPABILITIES
            </h3>
            <div className="spec-grid grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] [gap:1.5rem] [margin-bottom:3rem] max-[768px]:[grid-template-columns:1fr]">
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Close Air Support
                </h4>
                <p>
                  Precision weapons delivery in direct support of ground forces engaged in combat operations.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Troop Transport
                </h4>
                <p>
                  Rapid insertion and extraction of personnel via rotary-wing assets into hostile and contested zones.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  MEDEVAC
                </h4>
                <p>
                  Priority medical evacuation flights for critically wounded personnel under any conditions.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Air Superiority
                </h4>
                <p>
                  Establishing and maintaining control of the airspace to protect ground operations from aerial threats.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Aerial Reconnaissance
                </h4>
                <p>
                  Surveillance and intelligence gathering from the air to provide real-time battlefield awareness.
                </p>
              </div>
              <div className="spec-card [background:var(--bg-card)] [padding:1.5rem] [border:1px_solid_var(--primary)] [transition:all_0.3s_ease] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:3px] before:[background:var(--accent)] before:[transform:scaleX(0)] before:[transition:transform_0.3s_ease] [&:hover::before]:[transform:scaleX(1)] hover:[background:var(--bg-elevated)] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)]">
                <h4>
                  Logistics &amp; Resupply
                </h4>
                <p>
                  Aerial delivery of ammunition, supplies, and equipment to forward operating positions.
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
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="air_1" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="air_1_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="air_1_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
              <div className="equipment-card [background:var(--bg-card)] [border:2px_solid_var(--primary)] overflow-hidden [transition:all_0.3s_ease] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.3)] hover:[transform:translateY(-5px)]">
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="air_2" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="air_2_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="air_2_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
              <div className="equipment-card [background:var(--bg-card)] [border:2px_solid_var(--primary)] overflow-hidden [transition:all_0.3s_ease] hover:[border-color:var(--accent)] hover:[box-shadow:0_4px_20px_rgba(0,217,255,0.3)] hover:[transform:translateY(-5px)]">
                <div className="equipment-image w-full [height:220px] [background:linear-gradient(135deg,var(--bg-elevated)_0%,var(--primary-dark)_100%)] flex items-center justify-center overflow-hidden [border-bottom:2px_solid_var(--accent)]" data-cms-slot="air_3" data-cms-type="image">
                  <span className="placeholder-text [.slider-image-wrapper_&]:[color:var(--text-muted)] [.slider-image-wrapper_&]:[font-size:1.1rem] [.slider-image-wrapper_&]:[letter-spacing:1px] [.slider-image-wrapper_&]:[text-transform:uppercase] [.equipment-image_&]:[color:var(--text-muted)] [.equipment-image_&]:[font-size:1rem] [.equipment-image_&]:[letter-spacing:1px] [.equipment-image_&]:[text-transform:uppercase]">
                    Photo - Set via Admin Panel
                  </span>
                </div>
                <div className="equipment-info [padding:1.5rem] [background:var(--bg-elevated)]">
                  <h4 data-cms-slot="air_3_title" data-cms-type="text">
                    Title - Set via Admin Panel
                  </h4>
                  <p data-cms-slot="air_3_desc" data-cms-type="text">
                    Description - Set via Admin Panel
                  </p>
                </div>
              </div>
            </div>
          </section>
          <div className="motto-section [background:linear-gradient(135deg,var(--primary-dark)_0%,var(--bg-elevated)_100%)] [border:2px_solid_var(--accent)] [padding:3rem_2rem] [margin:3rem_0] text-center relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:0] before:[left:0] before:[width:100%] before:[height:100%] before:[background:radial-gradient(circle_at_center,rgba(0,217,255,0.05)_0%,transparent_70%)] before:[z-index:0]">
            <div className="content [.motto-section_&]:[position:relative] [.motto-section_&]:[z-index:1]">
              <h3>
                54TH AIR WING
              </h3>
              <p>
                First to arrive. Last to leave. Always overhead.
              </p>
            </div>
          </div>
          <section className="unit-cards-section [margin:3rem_0]">
            <h3>
              54TH AIR WING — UNIT STRENGTH
            </h3>
            <UnitCards id="air" />
          </section>
          <div className="cta-box [background:var(--bg-elevated)] [border:2px_solid_var(--accent)] [padding:2rem] [margin:3rem_0] text-center">
            <h3>
              JOIN THE 54TH
            </h3>
            <p>
              The 54th Air Wing needs skilled pilots and crew. Whether you fly CAS or transport, there is a seat waiting for you. Join our Discord to learn more.
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
