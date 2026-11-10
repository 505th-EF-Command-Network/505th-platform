import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellC } from "@/components/shell-styles";
import "@/styles/tw/resources-handbook.css";

export const metadata: Metadata = { title: "General Handbook - 505th" };

/** Converted 1:1 from the live resources-handbook.html (content after the shared shell). */
export default function ResourcesHandbookPage() {
  return (
    <SiteShell styles={shellC}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div className="page-header text-center [margin-bottom:3rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)]">
            <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem]">
              CLASSIFIED: LEVEL 2
            </span>
            <h1>
              GENERAL HANDBOOK
            </h1>
            <p className="version [color:var(--text-secondary)] [font-size:1rem] [letter-spacing:2px] [margin-top:0.5rem]">
              Version 2.0
            </p>
            <div className="header-line [width:100px] [height:3px] [background:var(--accent)] [margin:1.5rem_auto_0] [box-shadow:0_0_10px_var(--accent-glow)]"></div>
          </div>
          <div className="intro-section [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:3rem] [box-shadow:0_0_20px_var(--accent-glow)] max-[480px]:[padding:1.5rem]">
            <p>
              This handbook contains information that will be referenced by administrators when addressing rules and regulations. You will find expected unit etiquette and infraction punishments in this handbook. You will be expected to know this information in order not to unknowingly break unit regulations. These rules may be updated at any time. Rule violations may result in client restrictions or bans.
            </p>
          </div>
          <div className="toc-section [background:var(--bg-elevated)] [border:2px_solid_var(--accent)] [padding:2.5rem] [margin-bottom:3rem] [box-shadow:0_0_30px_var(--accent-glow)] max-[480px]:[padding:1.5rem]">
            <h2>
              TABLE OF CONTENTS
            </h2>
            <div className="toc-grid grid [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))] [gap:1.5rem] max-[768px]:[grid-template-columns:1fr]">
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#community-guidelines">
                Community Guidelines
              </a>
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#etiquette">
                In-Game Etiquette
              </a>
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#infractions">
                Infractions
              </a>
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#attendance">
                Attendance
              </a>
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#enlisted-ranks">
                Enlisted Ranks
              </a>
              <a className="toc-item [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:1.5rem] [color:var(--text-secondary)] [font-weight:600] [letter-spacing:1px] text-center [transition:all_0.3s_ease] hover:[background:var(--accent)] hover:[color:var(--bg-dark)] hover:[transform:translateY(-3px)] hover:[box-shadow:0_0_20px_var(--accent-glow)]" href="#officer-ranks">
                Officer Ranks
              </a>
            </div>
          </div>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="community-guidelines">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                01
              </span>
              COMMUNITY GUIDELINES
            </h2>
            <div className="quote-block [background:var(--bg-elevated)] [border-left:6px_solid_var(--accent)] [padding:2rem] [margin:2rem_0] italic [box-shadow:0_0_20px_var(--accent-glow)]">
              <p>
                "Men, keep your eyes downrange, fingers on the triggers, and we all come home in one piece. Am I right, Marines?"
              </p>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Global Guidelines
              </h3>
              <p>
                The following apply to any instances you are with the 505th.
              </p>
              <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  You cannot be in multiple Halo units with the 505th.
                </li>
                <li>
                  Any form of harassment, racism, bullying, sexism, implied or otherwise, is strictly prohibited.
                </li>
                <li>
                  No arguing or fighting. If you have a disagreement, handle it like adults with conversation. If that cannot happen, contact your NCO.
                </li>
                <li>
                  Respect the rank of senior soldiers. Follow orders even if you disagree with them. You are encouraged to bring up grievances after the operation in a constructive way.
                </li>
                <li>
                  If there is an NCO abusing their power, please report them to an Officer immediately and a case will be opened.
                </li>
                <li>
                  Privates are not allowed to join 505th Combat Operations until they have passed Boot Camp.
                </li>
                <li>
                  The 505th TeamSpeak and Arma server are for members ONLY.
                </li>
              </ol>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Discord
              </h3>
              <p>
                When in our Discord server you must know the rules listed in the discord and abide by them. Additionally, Discord TOS will be strictly enforced as well within our server.
              </p>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                TeamSpeak
              </h3>
              <p>
                When in our Teamspeak you will abide by the rules following:
              </p>
              <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  All content shared on our TeamSpeak server must adhere to our Global guidelines.
                </li>
                <li>
                  Soundboarding is prohibited.
                </li>
                <li>
                  Malicious links are prohibited.
                </li>
                <li>
                  Advertising is prohibited.
                </li>
                <li>
                  Microphone spam is prohibited.
                </li>
                <li>
                  Entering unauthorized channels without the express permission of the channel admin is prohibited.
                </li>
              </ol>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                In-Game
              </h3>
              <p>
                The following is a list of the in-game rules you will be expected to abide by.
              </p>
              <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  Follow the instructions of your Squad leader and/or mission Commander.
                </li>
                <li>
                  No trolling or griefing.
                </li>
                <li>
                  No political or religious discussions or references including names.
                </li>
                <li>
                  Do not destroy the spirit of the Operation by commenting on Zeusing issues, poor performance, and other things that could break immersion during an operation.
                </li>
                <li>
                  Do not discharge or fire weapons on base unless you are at an appropriate location to do so.
                </li>
                <li>
                  Do not discharge or fire weapons to frighten or scare civilians unless given expressed orders.
                </li>
                <li>
                  Do not harm or kill any civilians. (Some extreme exceptions can bypass this rule but only for story purposes)
                </li>
                <li>
                  Do not lone wolf or separate from your squad without express orders.
                </li>
                <li>
                  SIDE channel is used for important zeus issues only. All other communications are to be done in the group channel or direct.
                </li>
              </ol>
            </div>
          </section>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="etiquette">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                02
              </span>
              IN-GAME ETIQUETTE
            </h2>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Asset Use
              </h3>
              <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800]">
                <strong>
                  What is an asset?
                </strong>
                <p>
                  An asset is any equipment that the unit may use on the battlefield. This may include mortars, tanks, ships, or planes.
                </p>
              </div>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  Not everyone is allowed to use them and
                  <strong>
                    certification is typically required
                  </strong>
                  beforehand.
                </li>
                <li>
                  If you are unsure whether you are authorized to use an asset,
                  <strong>
                    ask an NCO first
                  </strong>
                  to avoid receiving an infraction.
                </li>
              </ul>
              <h4>
                Usage Rules:
              </h4>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  <strong>
                    Artillery
                  </strong>
                  , including mortars, must remain
                  <strong>
                    silent until called to fire by infantry
                  </strong>
                  .
                </li>
                <li>
                  <strong>
                    Support assets
                  </strong>
                  —with the exception of tanks—
                  <strong>
                    must not engage the enemy on their own accord
                  </strong>
                  .
                </li>
                <li>
                  Assets in
                  <strong>
                    immediate danger
                  </strong>
                  may defend themselves, but
                  <strong>
                    must not initiate
                  </strong>
                  engagements.
                </li>
                <li>
                  All personnel using assets
                  <strong>
                    must have a working microphone
                  </strong>
                  for proper coordination.
                </li>
                <li>
                  <strong>
                    Yellow Tow Carts
                  </strong>
                  are
                  <strong>
                    reserved for Air Force use only
                  </strong>
                  . Unauthorized use is strictly prohibited.
                </li>
              </ul>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Fratricide
              </h3>
              <div className="info-box warning [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800]">
                <strong>
                  What is fratricide?
                </strong>
                <p>
                  It is the killing of one's own forces. This includes destroying friendly equipment.
                </p>
              </div>
              <p>
                Fratricide will trigger a
                <strong>
                  case to be opened by an NCO
                </strong>
                . An account of the incident will be created by gathering
                <strong>
                  eyewitness statements
                </strong>
                .
              </p>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  If the fratricide is deemed
                  <strong>
                    accidental
                  </strong>
                  , no punishment will occur.
                </li>
                <li>
                  If the fratricide affects
                  <strong>
                    more than 5 individuals
                  </strong>
                  , a
                  <strong>
                    mark will appear
                  </strong>
                  on the offender's record to track repeated offenses.
                </li>
                <li>
                  If repeated marks appear,
                  <strong>
                    retraining may be required
                  </strong>
                  .
                </li>
                <li>
                  If the fratricide is deemed
                  <strong>
                    intentional
                  </strong>
                  , the offender will receive infractions, depending on the severity.
                </li>
              </ul>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Loadouts
              </h3>
              <p>
                Upon entering an event, you'll have access to the
                <strong>
                  Loadout Locker
                </strong>
                , where all approved unit loadouts are available for selection.
              </p>
              <p>
                You are free to choose from the roles you're qualified for, but remember:
                <strong>
                  The Squad Leader has final authority
                </strong>
                and may override your selection to better suit the needs of the mission.
              </p>
              <div className="quote-block small [background:var(--bg-elevated)] [border-left:6px_solid_var(--accent)] [padding:2rem] [margin:2rem_0] italic [box-shadow:0_0_20px_var(--accent-glow)]">
                <p>
                  Mission first. Team always.
                </p>
              </div>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Squad Play
              </h3>
              <p>
                <strong>
                  Teamwork is the backbone of success.
                </strong>
                In the 505th, squads operate as tight-knit units where coordination, communication, and mutual support are non-negotiable.
              </p>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  <strong>
                    Follow your squad leader's instructions at all times.
                  </strong>
                </li>
                <li>
                  <strong>
                    Watch each other's backs
                  </strong>
                  —your survival often depends on it.
                </li>
                <li>
                  <strong>
                    Work as a team
                  </strong>
                  , not as individuals.
                </li>
              </ul>
              <p>
                You are highly encouraged to:
              </p>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  Discuss tactics and strategies with your fireteam
                </li>
                <li>
                  Share gameplay tips to elevate each other
                </li>
                <li>
                  Organize or attend extra training sessions to strengthen unit cohesion
                </li>
              </ul>
              <div className="quote-block small [background:var(--bg-elevated)] [border-left:6px_solid_var(--accent)] [padding:2rem] [margin:2rem_0] italic [box-shadow:0_0_20px_var(--accent-glow)]">
                <p>
                  A strong squad is built in downtime, tested in combat, and remembered in victory.
                </p>
              </div>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Insubordination
              </h3>
              <p>
                Disobeying orders undermines operational effectiveness and disrupts the immersive experience we aim to create.
              </p>
              <p>
                <strong>
                  Orders are to be followed.
                </strong>
                If you disagree with a directive, you are encouraged to
                <strong>
                  voice your concerns respectfully
                </strong>
                , but the
                <strong>
                  squad leader's decision is final
                </strong>
                during the mission.
              </p>
              <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
                <p>
                  If you believe a squad leader is abusing their authority or acting inappropriately,
                  <strong>
                    do not escalate the situation mid-mission.
                  </strong>
                  Instead, report the issue to an
                  <strong>
                    NCO
                  </strong>
                  after the operation.
                </p>
              </div>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Event Types
              </h3>
              <div className="event-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:1.5rem] [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
                <h4>
                  Deployment (Large-Scale Operation)
                </h4>
                <p>
                  Deployments are our most extensive missions, spanning entire regions and involving coordinated
                  <strong>
                    combined arms warfare
                  </strong>
                  .
                </p>
                <div className="event-details flex [flex-wrap:wrap] [gap:1.5rem] [margin-top:1rem] [padding-top:1rem] [border-top:1px_solid_rgba(0,217,255,0.2)] max-[768px]:[flex-direction:column] max-[768px]:[gap:0.5rem]">
                  <span>
                    <strong>
                      Duration:
                    </strong>
                    Up to 3 hours
                  </span>
                  <span>
                    <strong>
                      Frequency:
                    </strong>
                    Once per month
                  </span>
                  <span>
                    <strong>
                      Attendance:
                    </strong>
                    High-priority
                  </span>
                </div>
              </div>
              <div className="event-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:1.5rem] [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
                <h4>
                  Operations (Mid-Scale Combat Missions)
                </h4>
                <p>
                  Operations are medium-tier events hosted more frequently and are generally
                  <strong>
                    infantry-centric
                  </strong>
                  .
                </p>
                <div className="event-details flex [flex-wrap:wrap] [gap:1.5rem] [margin-top:1rem] [padding-top:1rem] [border-top:1px_solid_rgba(0,217,255,0.2)] max-[768px]:[flex-direction:column] max-[768px]:[gap:0.5rem]">
                  <span>
                    <strong>
                      Duration:
                    </strong>
                    Variable
                  </span>
                  <span>
                    <strong>
                      Frequency:
                    </strong>
                    Weekly (Fridays/Saturdays)
                  </span>
                  <span>
                    <strong>
                      Focus:
                    </strong>
                    Tactical, squad-based gameplay
                  </span>
                </div>
              </div>
              <div className="event-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:1.5rem] [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
                <h4>
                  Patrols (Low-Intensity Sector Engagements)
                </h4>
                <p>
                  Patrols are smaller, immersive events that emphasize
                  <strong>
                    roleplay
                  </strong>
                  ,
                  <strong>
                    sector control
                  </strong>
                  , and
                  <strong>
                    civilian interaction
                  </strong>
                  .
                </p>
                <div className="event-details flex [flex-wrap:wrap] [gap:1.5rem] [margin-top:1rem] [padding-top:1rem] [border-top:1px_solid_rgba(0,217,255,0.2)] max-[768px]:[flex-direction:column] max-[768px]:[gap:0.5rem]">
                  <span>
                    <strong>
                      Duration:
                    </strong>
                    Up to 1 hour
                  </span>
                  <span>
                    <strong>
                      Frequency:
                    </strong>
                    Any day of the week
                  </span>
                  <span>
                    <strong>
                      Limit:
                    </strong>
                    One Patrol per day
                  </span>
                </div>
              </div>
              <div className="event-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:1.5rem] [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
                <h4>
                  Field Trainings (FTX)
                </h4>
                <p>
                  Field Training Exercises (FTX) are designed to improve unit cohesion, communication, and tactical proficiency.
                </p>
                <div className="event-details flex [flex-wrap:wrap] [gap:1.5rem] [margin-top:1rem] [padding-top:1rem] [border-top:1px_solid_rgba(0,217,255,0.2)] max-[768px]:[flex-direction:column] max-[768px]:[gap:0.5rem]">
                  <span>
                    <strong>
                      Duration:
                    </strong>
                    Up to 2 hours
                  </span>
                  <span>
                    <strong>
                      Scheduling:
                    </strong>
                    One week in advance
                  </span>
                  <span>
                    <strong>
                      Host:
                    </strong>
                    Qualified Zeus required
                  </span>
                </div>
              </div>
            </div>
            <div className="subsection [margin-bottom:2.5rem]">
              <h3>
                Name Rules
              </h3>
              <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800]">
                <p>
                  Names must be your typical first and last names found in cultures around the world. You cannot use "usernames" for your name.
                </p>
                <div className="example-box [background:rgba(0,217,255,0.05)] [border-left:4px_solid_var(--accent)] [padding:1rem] [margin-top:1rem]">
                  <p>
                    <strong>
                      Discord User:
                    </strong>
                    Pvt John D. Doe
                  </p>
                  <p>
                    <strong>
                      In-Game User:
                    </strong>
                    Pvt J. Doe
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="infractions">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                03
              </span>
              INFRACTIONS
            </h2>
            <p>
              Infractions are issued as disciplinary action to individuals who violate unit rules, both in-game and within community spaces.
            </p>
            <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  <strong>
                    Three Infractions:
                  </strong>
                  Upon receiving a third infraction, the member will be demoted to
                  <strong>
                    Private
                  </strong>
                  , with all ranks and specialist roles revoked.
                </li>
                <li>
                  <strong>
                    Additional Infractions:
                  </strong>
                  Any infractions beyond this point will result in a
                  <strong>
                    permanent ban
                  </strong>
                  from the unit.
                </li>
              </ul>
            </div>
            <p>
              NCOs (Non-Commissioned Officers) may issue additional consequences based on the severity or context of the offense. These may include, but are not limited to:
            </p>
            <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
              <li>
                Temporary suspension from operations or deployments
              </li>
              <li>
                Loss of privileges
              </li>
              <li>
                Mandatory retraining or probation
              </li>
            </ul>
          </section>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="attendance">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                04
              </span>
              ATTENDANCE
            </h2>
            <p>
              Active participation is essential to maintaining unit cohesion and operational readiness. In the
              <strong>
                505th
              </strong>
              , all members are expected to:
            </p>
            <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
              <li>
                Attend
                <strong>
                  at least three official events per month
                </strong>
                , this includes Patrols, Field Trainings, and Operations.
              </li>
              <li>
                Remain
                <strong>
                  reasonably active on Discord
                </strong>
              </li>
            </ul>
            <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
              <p>
                Failure to meet these expectations may result in being placed on
                <strong>
                  inactive notice
                </strong>
                . If you are unable to attend due to personal circumstances (e.g., work, school, emergencies), it is your responsibility to
                <strong>
                  notify an NCO
                </strong>
                in advance to arrange an exemption or temporary leave.
              </p>
              <p>
                <strong>
                  Important:
                </strong>
                If you fail to communicate your absence, you will be reported
                <strong>
                  AWOL
                </strong>
                after three months of no activity. Being designated
                <strong>
                  AWOL
                </strong>
                will see you stripped of rank and removed from the unit.
              </p>
            </div>
          </section>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="enlisted-ranks">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                05
              </span>
              ENLISTED RANKS
            </h2>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Pvt – Private
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Enlistment into the UNSC
                </p>
                <p>
                  Entry-level rank. Starting point for all new members.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  PFC – Private First Class
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Passing Basic Training
                </p>
                <p>
                  The backbone of the core. Performs frontline duties and focuses on gaining combat and strategic experience.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  LCpl – Lance Corporal
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  2 months TIS or meritorious promotion
                </p>
                <p>
                  The first step into leadership. Leads by example, mentors juniors, and takes on higher tactical roles.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Cpl – Corporal
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  4 months TIS or meritorious promotion
                </p>
                <p>
                  First noncommissioned officer (NCO) rank. Responsible for small-unit leadership, supervising juniors, enforcing standards, and mission execution. Eligible to be Squad second-in-command.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Sgt – Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  8 months TIS, clean record, and good conduct
                </p>
                <p>
                  Leads entire squads, helps plan and execute missions, serves as liaison between junior Marines and command, and advises Platoon Commanders.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  SSgt – Staff Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  12 months TIS and passing evaluation
                </p>
                <p>
                  Staff Sergeants serve as experienced noncommissioned officers who provide critical leadership at the squad and platoon level. They are responsible for mentoring junior NCOs and enlisted personnel.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  GSgt – Gunnery Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  15 months TIS and passing evaluation
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Assistant Company Commander
                </p>
                <p>
                  Gunnery Sergeants are senior noncommissioned officers who serve as key leaders and tactical experts within the company.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  MSgt – Master Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  20 months TIS and selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Division Administration
                </p>
                <p>
                  Master Sergeants serve as senior enlisted advisors and administrators at the division level.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  First Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  25 months TIS and selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Assistant Battalion Commander
                </p>
                <p>
                  The First Sergeant is a senior noncommissioned officer who acts as the principal enlisted advisor to the Battalion Commander.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Master Gunnery Sergeant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Staff Leader
                </p>
                <p>
                  The Master Gunnery Sergeant is a senior enlisted leader responsible for overseeing the training, discipline, and professional development of enlisted personnel across the unit.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Sergeant Major
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Assistant Division Commander
                </p>
                <p>
                  The Sergeant Major is the highest enlisted rank and serves as the principal enlisted advisor to the Division Commander.
                </p>
              </div>
            </div>
          </section>
          <section className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none]" id="officer-ranks">
            <h2 className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
              <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem]">
                06
              </span>
              OFFICER RANKS
            </h2>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  2nd Lt – Second Lieutenant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Platoon Commander
                </p>
                <p>
                  Second Lieutenants are junior commissioned officers who lead platoons in combat and training operations.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  1st Lt – First Lieutenant
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Company Executive Officer (XO)
                </p>
                <p>
                  First Lieutenants serve as the Company Executive Officers, acting as the second-in-command within a company.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Captain
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Company Commander (CO)
                </p>
                <p>
                  Captains serve as the commanding officers of a company, responsible for the overall leadership, training, and combat effectiveness of their unit.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Major
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Battalion Executive Officer (XO)
                </p>
                <p>
                  Majors serve as the Executive Officers of battalions, assisting the Battalion Commander in managing the unit's operations, logistics, and administration.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Lt Col – Lieutenant Colonel
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Battalion Commander (CO)
                </p>
                <p>
                  Lieutenant Colonels serve as commanding officers of battalions, responsible for the overall leadership, strategic planning, and operational effectiveness of their units.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header senior-officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Colonel
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Brigade Commander (CO)
                </p>
                <p>
                  Colonels serve as commanding officers of brigades, overseeing multiple battalions and their subordinate units.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header general [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Brig Gen – Brigadier General
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Division Commander (CO)
                </p>
                <p>
                  Brigadier Generals command entire divisions, overseeing multiple brigades and coordinating large-scale operations.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header general [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Maj Gen – Major General
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Requirement:
                  </strong>
                  Selection
                </p>
                <p>
                  <strong>
                    Role:
                  </strong>
                  Task Force Commander (CO)
                </p>
                <p>
                  Major Generals lead task forces composed of multiple divisions or specialized units.
                </p>
              </div>
            </div>
            <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)]">
              <div className="rank-header general [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                <h3>
                  Lt Gen – Lieutenant General
                </h3>
              </div>
              <div className="rank-body [padding:1.5rem]">
                <p>
                  <strong>
                    Unit Leader:
                  </strong>
                  CENTCOM Commander Drake P. Oliver
                </p>
              </div>
            </div>
          </section>
          <div className="closing-quote [background:var(--bg-elevated)] [border:3px_solid_var(--accent)] [padding:3rem] [margin-top:4rem] text-center [box-shadow:0_0_40px_var(--accent-glow)] max-[768px]:[padding:2rem]">
            <p>
              "Men, here is where we show those split-chin, squid-head, sons of bitches that they could not have picked a worse enemy than the human race. We are going to blow the hell out of those dumb bugs until we don't have anything left to shoot 'em with! And then, we are going to strangle them with their own living guts! Am I right, Marines?"
            </p>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
