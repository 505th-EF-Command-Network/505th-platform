import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellA } from "@/components/shell-styles";
import "@/styles/tw/resources-discord-rules.css";

export const metadata: Metadata = { title: "Discord Rules - 505th" };

/** Converted 1:1 from the live resources-discord-rules.html (content after the shared shell). */
export default function ResourcesDiscordRulesPage() {
  return (
    <SiteShell styles={shellA}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div className="page-header text-center [margin-bottom:3rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)]">
            <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem]">
              DISCORD SERVER POLICY
            </span>
            <h1>
              SERVER RULES
            </h1>
            <div className="header-line [width:100px] [height:3px] [background:var(--accent)] [margin:1.5rem_auto_0] [box-shadow:0_0_10px_var(--accent-glow)]"></div>
          </div>
          <div className="intro-box [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [margin-bottom:3rem] text-center [box-shadow:0_0_20px_var(--accent-glow)]">
            <p>
              By joining, you agree to follow the rules below:
            </p>
          </div>
          <div className="rules-grid grid [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))] [gap:2rem] [margin-bottom:3rem] max-[768px]:[grid-template-columns:1fr] max-[768px]:[gap:1.5rem]">
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                1
              </div>
              <div className="rule-content">
                <h3>
                  No NSFW Content
                </h3>
                <p>
                  Includes text, images, links, and usernames.
                </p>
              </div>
            </div>
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                2
              </div>
              <div className="rule-content">
                <h3>
                  Be Respectful
                </h3>
                <p>
                  Treat others respectfully. No trolling, harassment, or toxicity.
                </p>
              </div>
            </div>
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                3
              </div>
              <div className="rule-content">
                <h3>
                  No Advertising
                </h3>
                <p>
                  No promotion of other servers, products, or services.
                </p>
              </div>
            </div>
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                4
              </div>
              <div className="rule-content">
                <h3>
                  No Spam
                </h3>
                <p>
                  Avoid message spam, reaction spam, or disruptive behavior.
                </p>
              </div>
            </div>
            <div className="rule-card warning [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                5
              </div>
              <div className="rule-content">
                <h3>
                  Zero Tolerance Policy
                </h3>
                <p>
                  Racism, sexism, homophobia, or hate speech results in a ban.
                </p>
              </div>
            </div>
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                6
              </div>
              <div className="rule-content">
                <h3>
                  Access Limits
                </h3>
                <p>
                  TeamSpeak and Arma operations are for verified 505th members only.
                </p>
              </div>
            </div>
            <div className="rule-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] flex [gap:1.5rem] [align-items:flex-start] [transition:all_0.3s_ease] [box-shadow:0_0_10px_rgba(0,217,255,0.2)] hover:[transform:translateY(-5px)] hover:[box-shadow:0_0_30px_var(--accent-glow)] [&.warning]:[border-color:#FFB800] [&.warning]:[box-shadow:0_0_10px_rgba(255,184,0,0.3)] [&.warning:hover]:[box-shadow:0_0_30px_rgba(255,184,0,0.5)] max-[768px]:[padding:1.5rem] max-[480px]:[flex-direction:column] max-[480px]:[align-items:center] max-[480px]:[text-align:center] max-[480px]:[padding:1.5rem]">
              <div className="rule-number [font-size:2.5rem] [font-weight:700] [color:var(--accent)] [text-shadow:0_0_15px_var(--accent-glow)] [min-width:60px] text-center [.rule-card.warning_&]:[color:#FFB800] [.rule-card.warning_&]:[text-shadow:0_0_15px_rgba(255,184,0,0.5)] max-[768px]:[font-size:2rem] max-[768px]:[min-width:50px] max-[480px]:[font-size:3rem] max-[480px]:[margin-bottom:1rem]">
                7
              </div>
              <div className="rule-content">
                <h3>
                  Age Requirement
                </h3>
                <p>
                  Members must be 18 years or older.
                </p>
              </div>
            </div>
          </div>
          <div className="additional-info [background:var(--bg-elevated)] [border:2px_solid_var(--accent)] [padding:3rem] [margin-bottom:3rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[768px]:[padding:2rem] max-[480px]:[padding:1.5rem]">
            <h2>
              Enforcement
            </h2>
            <div className="info-section [margin-bottom:2.5rem] last:[margin-bottom:0]">
              <h3>
                Violation Consequences
              </h3>
              <ul className="consequence-list [list-style:none] [padding:0]">
                <li>
                  <strong>
                    First Offense:
                  </strong>
                  Warning and explanation of violated rule
                </li>
                <li>
                  <strong>
                    Second Offense:
                  </strong>
                  Temporary mute or timeout
                </li>
                <li>
                  <strong>
                    Third Offense:
                  </strong>
                  Temporary ban (duration varies)
                </li>
                <li>
                  <strong>
                    Severe Violations:
                  </strong>
                  Immediate permanent ban
                </li>
              </ul>
            </div>
            <div className="info-section [margin-bottom:2.5rem] last:[margin-bottom:0]">
              <h3>
                Zero Tolerance Offenses
              </h3>
              <p>
                The following result in
                <strong>
                  immediate permanent ban
                </strong>
                without warning:
              </p>
              <ul className="zero-tolerance-list [list-style:none] [padding:0]">
                <li>
                  Racism, sexism, homophobia, or any hate speech
                </li>
                <li>
                  Sharing NSFW content involving minors
                </li>
                <li>
                  Doxxing or sharing personal information
                </li>
                <li>
                  Threats of violence or harm
                </li>
                <li>
                  Repeated ban evasion
                </li>
              </ul>
            </div>
            <div className="info-section [margin-bottom:2.5rem] last:[margin-bottom:0]">
              <h3>
                Appeals Process
              </h3>
              <p>
                If you believe you were banned in error, you may appeal by:
              </p>
              <ul className="appeal-list [list-style:none] [padding:0]">
                <li>
                  Contacting a Staff Member or Officer directly
                </li>
                <li>
                  Providing your Discord username and case details
                </li>
                <li>
                  Waiting for Staff review (may take 48-72 hours)
                </li>
              </ul>
              <p className="note [background:rgba(255,184,0,0.1)] [border-left:4px_solid_#FFB800] [padding:1rem] [margin-top:1rem] [color:var(--text-secondary)]">
                <strong>
                  Note:
                </strong>
                Zero Tolerance violations are not eligible for appeal.
              </p>
            </div>
          </div>
          <div className="discord-cta text-center [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:3rem] [margin-bottom:3rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[768px]:[padding:2rem]">
            <h2>
              Join Our Community
            </h2>
            <p>
              Ready to join the fight? Click below to access our Discord server.
            </p>
            <a className="discord-btn inline-flex items-center [gap:1rem] [background:var(--primary)] [border:2px_solid_var(--accent)] [padding:1rem_2.5rem] [color:var(--text-primary)] [font-weight:700] [font-size:1.1rem] [letter-spacing:2px] [transition:all_0.3s_ease] [clip-path:polygon(10px_0,100%_0,100%_calc(100%_-_10px),calc(100%_-_10px)_100%,0_100%,0_10px)] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[box-shadow:0_0_20px_var(--accent-glow)] hover:[transform:translateY(-3px)] max-[480px]:[width:100%] max-[480px]:[justify-content:center]" href="https://discord.gg/uh8ax8MhNb" target="_blank">
              <span className="btn-icon [font-size:1.5rem]">
                💬
              </span>
              <span className="btn-text">
                JOIN DISCORD
              </span>
            </a>
          </div>
          <div className="rules-footer text-center [background:var(--bg-elevated)] [border:2px_solid_#FFB800] [padding:2rem] [box-shadow:0_0_20px_rgba(255,184,0,0.3)]">
            <p>
              ⚠️ Rules are subject to change at staff discretion.
            </p>
            <p className="last-updated [color:var(--text-muted)] [font-size:0.85rem] italic">
              Last Updated: May 7, 2025
            </p>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
