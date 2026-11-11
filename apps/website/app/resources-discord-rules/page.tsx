import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellA } from "@/components/shell-styles";
import "@/styles/tw/resources-discord-rules.css";

export const metadata: Metadata = { title: "Discord Rules - 505th" };

const RULES: [string, string][] = [
  ["No NSFW Content", "Includes text, images, links, and usernames."],
  ["Be Respectful", "Treat others respectfully. No trolling, harassment, or toxicity."],
  ["No Advertising", "No promotion of other servers, products, or services."],
  ["No Spam", "Avoid message spam, reaction spam, or disruptive behavior."],
  ["Zero Tolerance Policy", "Racism, sexism, homophobia, or hate speech results in a ban."],
  ["Access Limits", "TeamSpeak and Arma operations are for verified 505th members only."],
  ["Age Requirement", "Members must be 18 years or older."],
];
const LADDER: [string, string, string, string][] = [
  ["⚑", "WARNING", "First offence", "Warning and explanation of the rule broken"],
  ["⏱", "TIMEOUT", "Second offence", "Temporary mute or timeout"],
  ["⤴", "TEMP BAN", "Third offence", "Duration varies"],
  ["⛔", "PERMANENT BAN", "Severe violations", "Immediate, no warning"],
];
const ZERO = [
  "Racism, sexism, homophobia, or any hate speech",
  "Sharing NSFW content involving minors",
  "Doxxing or sharing personal information",
  "Threats of violence or harm",
  "Repeated ban evasion",
];

/** Discord rules — redesign approved 2026-11-11 (alert, numbered rule cards, enforcement ladder, appeals, join). */
export default function ResourcesDiscordRulesPage() {
  return (
    <SiteShell styles={shellA}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="rr">
          <h1 className="rr-h1">SERVER RULES</h1>
          <p className="rr-sub">505TH EXPEDITIONARY FORCE // DISCORD CODE OF CONDUCT · LAST UPDATED 7 MAY 2025</p>

          <div className="rr-alert" role="note">
            <span aria-hidden="true">⚠</span>
            <div><b>ZERO TOLERANCE</b><p>Some offences mean an instant permanent ban, with no warning and no appeal. See section 03.</p></div>
          </div>

          <h2 className="rr-s"><span>01</span> // RULES</h2>
          <p className="rr-lead">By joining, you agree to follow the rules below.</p>
          <ol className="rr-rules">
            {RULES.map(([t, d], i) => (
              <li key={t} className="rr-rule"><span className="rr-n">{String(i + 1).padStart(2, "0")}</span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>

          <h2 className="rr-s"><span>02</span> // ENFORCEMENT LADDER</h2>
          <ol className="rr-ladder">
            {LADDER.map(([i, t, w, d]) => (
              <li key={t}><i aria-hidden="true">{i}</i><b>{t}</b><small>{w}</small><p>{d}</p></li>
            ))}
          </ol>
          <p className="rr-k">STAFF MAY SKIP STEPS DEPENDING ON HOW SERIOUS THE VIOLATION IS.</p>

          <h2 className="rr-s"><span>03</span> // ZERO TOLERANCE OFFENCES</h2>
          <p className="rr-lead">The following result in an <strong>immediate permanent ban</strong> without warning:</p>
          <ul className="rr-zero">{ZERO.map((z) => <li key={z}>{z}</li>)}</ul>

          <h2 className="rr-s"><span>04</span> // APPEALS</h2>
          <div className="rr-appeal">
            <p>If you believe you were banned in error, you may appeal by:</p>
            <ol>
              <li>Contacting a Staff Member or Officer directly</li>
              <li>Providing your Discord username and case details</li>
              <li>Waiting for Staff review (may take 48–72 hours)</li>
            </ol>
            <p className="rr-note"><strong>Note:</strong> Zero Tolerance violations are not eligible for appeal.</p>
          </div>

          <div className="rr-cta">
            <div><b>JOIN OUR COMMUNITY</b><p>Ready to join the fight? Read the General Handbook, then join the Discord.</p></div>
            <div className="rr-btns">
              <a className="rr-btn" href="/resources-handbook">GENERAL HANDBOOK</a>
              <a className="rr-btn p" href="https://discord.gg/uh8ax8MhNb" target="_blank" rel="noopener noreferrer">JOIN DISCORD →</a>
            </div>
          </div>
          <p className="rr-k rr-foot">⚠ RULES ARE SUBJECT TO CHANGE AT STAFF DISCRETION.</p>
        </div>
      </main>
    </SiteShell>
  );
}
