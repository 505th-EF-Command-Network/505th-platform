import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellB } from "@/components/shell-styles";
import "@/styles/tw/home.css";

export const metadata: Metadata = { title: "505th Home Page" };

/** Converted 1:1 from the live home.html (content after the shared shell). */
export default function HomePage() {
  return (
    <SiteShell styles={shellB}>
      <main className="homepage-content [min-height:calc(100vh_-_110px)] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!" id="sharedMain">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [.media-page-content_&]:[position:relative] [.media-page-content_&]:[z-index:1] [.homepage-content_&]:[max-width:1400px] [.homepage-content_&]:[margin:0_auto] [.homepage-content_&]:[padding:3rem_2rem] [.homepage-content_&]:[position:relative] [.homepage-content_&]:[z-index:1] max-[768px]:[.homepage-content_&]:[padding:2rem_1rem]">
          <section className="hero-section text-center [margin-bottom:2rem] [padding:4rem_0] max-[768px]:[padding:2rem_0] max-[768px]:[margin-bottom:1.5rem] max-[480px]:[padding:1rem_0] mq1:[padding:1rem_0] mq1:[margin-bottom:2rem]">
            <div className="hero-content">
              <h1 className="hero-title [margin-bottom:1.5rem]">
                <span className="title-line block [font-size:3.5rem] [color:var(--accent)] [text-shadow:0_0_30px_var(--accent-glow)] [letter-spacing:8px] [margin-bottom:0.5rem] [animation:glow_3s_ease-in-out_infinite] max-[768px]:[font-size:2.5rem] max-[768px]:[letter-spacing:4px] max-[480px]:[font-size:1.8rem] max-[480px]:[letter-spacing:2px] mq1:[font-size:2rem]">
                  JOIN THE ELITE
                </span>
                <span className="title-subtitle block [font-size:1.5rem] [color:var(--text-secondary)] [letter-spacing:5px] [font-weight:500] max-[768px]:[font-size:1.1rem] max-[768px]:[letter-spacing:3px] max-[480px]:[font-size:0.9rem] max-[480px]:[letter-spacing:2px] mq1:[font-size:1rem]">
                  505TH EXPEDITIONARY FORCE
                </span>
              </h1>
              <p className="hero-tagline [font-size:1.3rem] [color:var(--text-primary)] [letter-spacing:2px] [margin-bottom:2rem] italic max-[768px]:[font-size:1.1rem] max-[480px]:[font-size:1rem] max-[480px]:[margin-bottom:2rem]">
                Where Legends Are Forged in Battle
              </p>
            </div>
          </section>
          <section className="about-section [margin-bottom:5rem]">
            <h2 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              WHO WE ARE
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h2>
            <div className="about-content [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:3rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[768px]:[padding:2rem] max-[480px]:[padding:1.5rem]">
              <p>
                "My goal with the 505th is to create a community where anyone can find people to call their own. To develop long-lasting friendships and meet new people. I want people to learn new things about leadership and responsibility.
              </p>
              <p>
                We are a semi-serious Halo Arma 3 unit with large ambitions and a welcoming community. Lead the charge on the ground with our Marines, stalk the enemies of Humanity in Force Recon, or rain down pain with our fighter squadrons. That's just the beginning, and there's so much more to come. What are you waiting for?"
              </p>
              <p className="about-quote [margin-top:1.2rem] [font-size:0.85rem] [color:var(--accent)] [letter-spacing:0.05em] [opacity:0.75] italic [text-align:right]!">
                - Lt General Drake P. Oliver, 505th Expeditionary Force Commander
              </p>
            </div>
          </section>
          <section className="video-section [margin-bottom:5rem]">
            <h2 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              SEE US IN ACTION
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h2>
            <div className="video-container [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:2rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[480px]:[padding:1.5rem]">
              <div className="video-placeholder [aspect-ratio:16/9] [background:var(--bg-elevated)] [border:2px_dashed_var(--accent)] flex flex-col items-center justify-center [gap:1rem]" data-cms-slot="hero_video" data-cms-type="video">
                <div className="video-icon [font-size:5rem] [color:var(--accent)] [text-shadow:0_0_20px_var(--accent-glow)] max-[480px]:[font-size:3rem]">
                  ▶
                </div>
                <p>
                  Gameplay Video Placeholder
                </p>
                <p className="video-note [font-size:1rem]! [color:var(--text-muted)]! italic">
                  [Embed YouTube/Twitch video - Set via Admin Panel]
                </p>
              </div>
            </div>
            <div className="video-description text-center">
              <p data-cms-slot="hero_video_description" data-cms-type="text">
                Description - Set via Admin Panel
              </p>
            </div>
          </section>
          <section className="gameplay-section [margin-bottom:5rem]">
            <h2 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              OUR GAMEPLAY
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h2>
            <div className="gameplay-grid grid [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] [gap:2rem] max-[768px]:[grid-template-columns:1fr] max-[768px]:[gap:1.5rem]">
              <div className="gameplay-feature [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] text-center [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:scale(1.05)] max-[480px]:[padding:1.5rem]">
                <div className="feature-icon [font-size:3.5rem] [margin-bottom:1rem] [filter:drop-shadow(0_0_10px_var(--accent-glow))] max-[480px]:[font-size:3rem]">
                  <img alt="Tactical Realism" src="/images/logos/Tactical Realism.png" style={{width: '80px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(0,217,255,0.4))'}} />
                </div>
                <h3>
                  Tactical Realism
                </h3>
                <p>
                  Experience the thrill of Halo in Arma 3 with intense battles, custom missions, and large-scale operations that put you right in the fight.
                </p>
              </div>
              <div className="gameplay-feature [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] text-center [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:scale(1.05)] max-[480px]:[padding:1.5rem]">
                <div className="feature-icon [font-size:3.5rem] [margin-bottom:1rem] [filter:drop-shadow(0_0_10px_var(--accent-glow))] max-[480px]:[font-size:3rem]">
                  <img alt="Regular Operations" src="/images/logos/Regular Operations.png" style={{width: '80px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(0,217,255,0.4))'}} />
                </div>
                <h3>
                  Regular Operations
                </h3>
                <p>
                  Weekly operations every Friday and Saturday nights, with monthly large-scale deployments and daily patrol opportunities.
                </p>
              </div>
              <div className="gameplay-feature [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] text-center [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:scale(1.05)] max-[480px]:[padding:1.5rem]">
                <div className="feature-icon [font-size:3.5rem] [margin-bottom:1rem] [filter:drop-shadow(0_0_10px_var(--accent-glow))] max-[480px]:[font-size:3rem]">
                  <img alt="Team-Focused" src="/images/logos/Team Focused.png" style={{width: '80px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(0,217,255,0.4))'}} />
                </div>
                <h3>
                  Team-Focused
                </h3>
                <p>
                  Build lasting friendships with dedicated teammates who value coordination and communication.
                </p>
              </div>
              <div className="gameplay-feature [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] text-center [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:scale(1.05)] max-[480px]:[padding:1.5rem]">
                <div className="feature-icon [font-size:3.5rem] [margin-bottom:1rem] [filter:drop-shadow(0_0_10px_var(--accent-glow))] max-[480px]:[font-size:3rem]">
                  <img alt="Progression System" src="/images/logos/Progression System.png" style={{width: '80px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(0,217,255,0.4))'}} />
                </div>
                <h3>
                  Progression System
                </h3>
                <p>
                  Advance through ranks, earn certifications, and take on leadership roles as you develop your skills and experience.
                </p>
              </div>
            </div>
          </section>
          <section className="requirements-section [margin-bottom:5rem]">
            <h2 className="section-header flex items-center justify-center [gap:2rem] [font-size:2.5rem] [color:var(--accent)] [letter-spacing:4px] [margin-bottom:3rem] [text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[font-size:1.8rem] max-[768px]:[gap:1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[font-size:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[gap:1rem]">
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
              REQUIREMENTS
              <span className="header-line flex-1 [height:2px] [background:linear-gradient(to_right,transparent,var(--accent),transparent)] [box-shadow:0_0_10px_var(--accent-glow)] max-[480px]:[width:100px]"></span>
            </h2>
            <div className="requirements-box [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:3rem] grid [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] [gap:2rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[768px]:[grid-template-columns:1fr] max-[768px]:[padding:2rem] max-[480px]:[padding:1.5rem]">
              <div className="requirement-item flex items-center [gap:1rem] [padding:1rem] [background:var(--bg-elevated)] [border-left:4px_solid_var(--accent)] [transition:all_0.3s_ease] hover:[transform:translateX(10px)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" style={{textAlign: 'center'}}>
                <span className="req-icon [color:var(--accent)] [font-size:1.8rem] [font-weight:700]">
                  ✓
                </span>
                <span className="req-text [color:var(--text-secondary)] [font-size:1.1rem] [letter-spacing:1px]">
                  18+ years of age
                </span>
              </div>
              <div className="requirement-item flex items-center [gap:1rem] [padding:1rem] [background:var(--bg-elevated)] [border-left:4px_solid_var(--accent)] [transition:all_0.3s_ease] hover:[transform:translateX(10px)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" style={{textAlign: 'center'}}>
                <span className="req-icon [color:var(--accent)] [font-size:1.8rem] [font-weight:700]">
                  ✓
                </span>
                <span className="req-text [color:var(--text-secondary)] [font-size:1.1rem] [letter-spacing:1px]">
                  Arma 3 with required mods
                </span>
              </div>
              <div className="requirement-item flex items-center [gap:1rem] [padding:1rem] [background:var(--bg-elevated)] [border-left:4px_solid_var(--accent)] [transition:all_0.3s_ease] hover:[transform:translateX(10px)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" style={{textAlign: 'center'}}>
                <span className="req-icon [color:var(--accent)] [font-size:1.8rem] [font-weight:700]">
                  ✓
                </span>
                <span className="req-text [color:var(--text-secondary)] [font-size:1.1rem] [letter-spacing:1px]">
                  Mic Comms preferred; Alternative can be agreed
                </span>
              </div>
              <div className="requirement-item flex items-center [gap:1rem] [padding:1rem] [background:var(--bg-elevated)] [border-left:4px_solid_var(--accent)] [transition:all_0.3s_ease] hover:[transform:translateX(10px)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" style={{textAlign: 'center'}}>
                <span className="req-icon [color:var(--accent)] [font-size:1.8rem] [font-weight:700]">
                  ✓
                </span>
                <span className="req-text [color:var(--text-secondary)] [font-size:1.1rem] [letter-spacing:1px]">
                  Attend 3+ operations per month
                </span>
              </div>
              <div className="requirement-item flex items-center [gap:1rem] [padding:1rem] [background:var(--bg-elevated)] [border-left:4px_solid_var(--accent)] [transition:all_0.3s_ease] hover:[transform:translateX(10px)] hover:[box-shadow:0_0_15px_var(--accent-glow)]" style={{textAlign: 'center'}}>
                <span className="req-icon [color:var(--accent)] [font-size:1.8rem] [font-weight:700]">
                  ✓
                </span>
                <span className="req-text [color:var(--text-secondary)] [font-size:1.1rem] [letter-spacing:1px]">
                  Mature, team-oriented attitude
                </span>
              </div>
            </div>
          </section>
          <section className="cta-section [margin-bottom:3rem]">
            <div className="cta-box [background:var(--bg-card)] [border:3px_solid_var(--accent)] [padding:4rem] text-center [box-shadow:0_0_50px_var(--accent-glow)] max-[768px]:[padding:2.5rem_1.5rem] max-[480px]:[padding:1.5rem]">
              <div data-cms-slot="enlist_photo" data-cms-type="image" style={{width: '100%', maxWidth: '900px', margin: '0 auto 1.5rem', overflow: 'hidden', display: 'none'}}></div>
              <h2>
                READY TO ENLIST?
              </h2>
              <p>
                Join our Discord to begin your journey with the 505th Expeditionary Force
              </p>
              <a className="cta-button inline-flex items-center [gap:1.5rem] [background:var(--primary)] [border:3px_solid_var(--accent)] [padding:1.5rem_3rem] [color:var(--text-primary)] [font-weight:700] [font-size:1.3rem] [letter-spacing:3px] [transition:all_0.3s_ease] [clip-path:polygon(15px_0,100%_0,100%_calc(100%_-_15px),calc(100%_-_15px)_100%,0_100%,0_15px)] [box-shadow:0_0_20px_var(--accent-glow)] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_40px_var(--accent-glow)] hover:[transform:translateY(-5px)] max-[768px]:[padding:1.2rem_2rem] max-[768px]:[font-size:1.1rem] max-[768px]:[letter-spacing:2px] max-[480px]:[width:100%] max-[480px]:[justify-content:center] max-[480px]:[padding:1rem_1.5rem]" href="https://discord.gg/uh8ax8MhNb" target="_blank">
                <span className="btn-icon [.cta-button_&]:[font-size:2rem]">
                  💬
                </span>
                <span className="btn-text">
                  JOIN DISCORD
                </span>
              </a>
              <p className="cta-note [margin-top:2rem] [color:var(--text-muted)] [font-size:0.95rem] italic">
                After joining Discord, check the recruitment channel for next steps
              </p>
            </div>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
