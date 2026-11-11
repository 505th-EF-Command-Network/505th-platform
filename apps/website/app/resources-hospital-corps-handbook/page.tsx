import type { Metadata } from "next";
import HandbookToc from "@/components/handbook/HandbookToc";
import SiteShell from "@/components/SiteShell";
import { shellC } from "@/components/shell-styles";
import "@/styles/tw/resources-hospital-corps-handbook.css";
import "@/styles/tw/handbook2.css";

export const metadata: Metadata = { title: "Hospital Corps Handbook - 505th" };

/** Handbook redesign approved 2026-11-11 (sticky contents, section cards, collapsible topics, rank grid). Originally converted 1:1 from the live resources-hospital-corps-handbook.html (content after the shared shell). */
export default function ResourcesHospitalCorpsHandbookPage() {
  return (
    <SiteShell styles={shellC}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] [.hc-tab-content_&.section-title]:[font-size:1.4rem] [.hc-tab-content_&.section-title]:[gap:1rem] [.hc-tab-content_&.section-title]:[margin-bottom:1.5rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div className="page-header text-center [margin-bottom:3rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)]">
            <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem]">
              HOSPITAL CORPS // MEDICAL DIVISION
            </span>
            <h1>
              HOSPITAL CORPS HANDBOOK
            </h1>
            <p className="version [color:var(--text-secondary)] [font-size:1rem] [letter-spacing:2px] [margin-top:0.5rem]">
              v1.0 — 505th Expeditionary Force Medical Guide
            </p>
            <div className="header-line [width:100px] [height:3px] [background:var(--accent)] [margin:1.5rem_auto_0] [box-shadow:0_0_10px_var(--accent-glow)]"></div>
          </div>
          <div className="intro-section [background:var(--bg-card)] [border:2px_solid_var(--accent)] [padding:2rem] [margin-bottom:3rem] [box-shadow:0_0_20px_var(--accent-glow)] max-[480px]:[padding:1.5rem]">
            <p>
              The mission of the
              <strong>
                UNSC Marine Hospital Corps
              </strong>
              is to preserve the fighting strength of Marine forces across all theaters of conflict. We provide rapid, skillful, and effective medical care on the battlefield; stabilize and evacuate the wounded. Through unwavering professionalism, advanced medical expertise, and fearless commitment under fire, the Marine Hospital Corps stands as the frontline shield between life and death — saving Marines, sustaining missions, and upholding the highest ideals of service to humanity.
            </p>
          </div>
          <div className="hb2 hc">
            <HandbookToc />
            <div className="hb2-body">
          <div className="hc-tabs flex justify-center [gap:0] [margin:2rem_0_2.5rem]">
            <button className="hc-tab active [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [font-weight:700] [letter-spacing:3px] uppercase [background:rgba(0,0,0,.3)] [border:2px_solid_rgba(0,217,255,.15)] [color:#aaa] [padding:14px_32px] cursor-pointer [transition:all_.2s] first:[border-right:none] hover:[background:rgba(0,217,255,.06)] hover:[color:#ddd] [&.active]:[background:rgba(0,217,255,.08)] [&.active]:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[text-shadow:0_0_10px_rgba(0,217,255,.3)]" id="tabHandbook">
              HOSPITAL CORPS HANDBOOK
            </button>
            <button className="hc-tab [font-family:'Rajdhani',sans-serif] [font-size:1.1rem] [font-weight:700] [letter-spacing:3px] uppercase [background:rgba(0,0,0,.3)] [border:2px_solid_rgba(0,217,255,.15)] [color:#aaa] [padding:14px_32px] cursor-pointer [transition:all_.2s] first:[border-right:none] hover:[background:rgba(0,217,255,.06)] hover:[color:#ddd] [&.active]:[background:rgba(0,217,255,.08)] [&.active]:[color:var(--accent)] [&.active]:[border-color:var(--accent)] [&.active]:[text-shadow:0_0_10px_rgba(0,217,255,.3)]" id="tabMedical">
              MEDICAL BOOK
            </button>
          </div>
          <div className="hc-tab-content active hidden text-center [&.active]:[display:block]" id="tab-handbook">
            <div className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none] [.hc-tab-content_&]:[text-align:left] [.hc-tab-content_&]:[max-width:900px] [.hc-tab-content_&]:[margin:0_auto]" id="structure">
              <div className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
                <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem] [.hc-tab-content_.page-content.section-title_&]:[font-size:1rem] [.hc-tab-content_.page-content.section-title_&]:[padding:0.3rem_0.8rem]">
                  I
                </span>
                CORPS STRUCTURE
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  Enlisted Ranks
                </h3>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HR</div>

                    <h3>
                      E1 — HR Hospitalman Recruit
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      Submitted Hospital Corps Application
                    </p>
                    <p>
                      Learning key medical principles. Recruits are not allowed to perform Corpsman duties without supervision.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HA</div>

                    <h3>
                      E2 — HA Hospitalman Apprentice
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      Passed all required exams
                    </p>
                    <p>
                      Novice Corpsman still gaining experience.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header enlisted [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HM</div>

                    <h3>
                      E3 — HM Hospitalman
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      2 months of service in the corps
                    </p>
                    <p>
                      Experienced corpsman that can reliably handle most medical situations.
                    </p>
                  </div>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  NCO Ranks
                </h3>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HM3</div>

                    <h3>
                      E4 — HM3 Hospital Corpsman Third Class
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      4 months of service in the corps
                    </p>
                    <p>
                      Experienced corpsman gaining leadership skills in coordinating other enlisted corpsmen.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HM2</div>

                    <h3>
                      E5 — HM2 Hospital Corpsman Second Class
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      8 months of service and a clean record
                    </p>
                    <p>
                      Trustworthy and reliable. Experienced in leading and organizing corpsman teams.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HM1</div>

                    <h3>
                      E6 — HM1 Hospital Corpsman First Class
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      12 months of service and a clean record
                    </p>
                    <p>
                      Highest NCO rank. Mentors and trains NCOs and Corpsmen. The backbone of the corps.
                    </p>
                  </div>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  Staff NCO Ranks
                </h3>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HMC</div>

                    <h3>
                      E7 — HMC Chief Hospital Corpsman
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      15 months of service + evaluation
                    </p>
                    <p>
                      Handles creation of new training and FTXs to strengthen faults found in the corps.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HMCS</div>

                    <h3>
                      E8 — HMCS Senior Chief Hospital Corpsman
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      20 months of service + evaluation
                    </p>
                    <p>
                      Monitors NCOs and mentors new Staff NCOs ensuring the corps runs smoothly.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header senior-nco [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">HMCM</div>

                    <h3>
                      E9 — HMCM Master Chief Hospital Corpsman
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      25 months of service + evaluation
                    </p>
                    <p>
                      Head Staff NCO. Monitors all ranks, handles training scheduling and administrative duties.
                    </p>
                  </div>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  Officer Ranks
                </h3>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">ENS</div>

                    <h3>
                      O1 — ENS Ensign
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
                      Junior Officer learning administrative duties for the corps.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">LT</div>

                    <h3>
                      O3 — LT Lieutenant
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
                      Full officer assisting in Staff NCO selections and promotions. Participates in procedure creation.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header senior-officer [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">CAPT</div>

                    <h3>
                      O6 — CAPT Captain
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
                      Experienced officer creating procedures and managing officers beneath them.
                    </p>
                  </div>
                </div>
                <div className="rank-card [background:var(--bg-card)] [border:2px_solid_var(--accent)] [margin-bottom:1.5rem] overflow-hidden [transition:all_0.3s_ease] hover:[box-shadow:0_0_30px_var(--accent-glow)] hover:[transform:translateX(10px)] [.hc-tab-content_&]:[text-align:left]">
                  <div className="rank-header general [padding:1.5rem] [border-bottom:2px_solid_var(--accent)] [&.enlisted]:[background:linear-gradient(90deg,var(--bg-elevated),var(--bg-card))] [&.nco]:[background:linear-gradient(90deg,var(--primary-dark),var(--bg-card))] [&.senior-nco]:[background:linear-gradient(90deg,var(--primary),var(--bg-card))] [&.officer]:[background:linear-gradient(90deg,#1a3d5c,var(--bg-card))] [&.senior-officer]:[background:linear-gradient(90deg,#2a4d6c,var(--bg-card))] [&.general]:[background:linear-gradient(90deg,#3a5d7c,var(--bg-card))]">
                    <div className="rk-ins" aria-hidden="true">RDML</div>

                    <h3>
                      O7 — RDML Rear Admiral
                    </h3>
                  </div>
                  <div className="rank-body [padding:1.5rem]">
                    <p>
                      <strong>
                        Requirement:
                      </strong>
                      Selection by the Lieutenant General
                    </p>
                    <p>
                      Head of the Corps.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hc-tab-content hidden text-center [&.active]:[display:block]" id="tab-medical">
            <div className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none] [.hc-tab-content_&]:[text-align:left] [.hc-tab-content_&]:[max-width:900px] [.hc-tab-content_&]:[margin:0_auto]" id="ch1">
              <div className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
                <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem] [.hc-tab-content_.page-content.section-title_&]:[font-size:1rem] [.hc-tab-content_.page-content.section-title_&]:[padding:0.3rem_0.8rem]">
                  1
                </span>
                INTRODUCTION
              </div>
              <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                <strong>
                  505th Medical Guide
                </strong>
                <p>
                  Created by HMC John H. Burns — Version 0.25
                </p>
                <p>
                  <em>
                    The materials provided in this training document are intended solely for use within the virtual game Arma 3. This document does not contain real-world medical information. For any real-life emergencies, please contact your local emergency response services immediately.
                  </em>
                </p>
              </div>
              <p>
                The 505th uses
                <strong>
                  KAT Advanced Medical
                </strong>
                on its servers due to its advanced medical features. KAM introduces a whole new world to the ACE medical system — simulating airways, breathing and circulation with different blood types, a full pharmacy, field surgery, MEDEVACs, and Zeus integration.
              </p>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  1.1 Hospitalman Recruit (HR)
                </h3>
                <p>
                  When an enlisted has interest in the corpsman or requires certifications for specialized roles, they become a
                  <strong>
                    Hospitalman Recruit
                  </strong>
                  . These are trainees limited to attending classes with an
                  <strong>
                    HM1
                  </strong>
                  . Once they pass their checks they may take the final exam to become a
                  <strong>
                    HA Hospitalman Apprentice
                  </strong>
                  , who may then join operations as a combat medic.
                </p>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  1.2 In-Game Setup
                </h3>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Medical Menu
                  </strong>
                  <p>
                    ESC → Controls → Common → scroll to 'Last Help' → Remove H as a keybind.
                  </p>
                </div>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    C-Tab Setup
                  </strong>
                  <p>
                    ESC → Controls → Advance Addons → Ctab → Set main interface to any key other than default (e.g. J).
                  </p>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  1.3 Equipment
                </h3>
                <div className="equip-grid grid [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))] [gap:1rem] [margin:1rem_0_1.5rem] [.hc-tab-content_&]:[text-align:left]">
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Consumables
                    </h4>
                    <ul>
                      <li>
                        Naloxone
                      </li>
                      <li>
                        Morphine
                      </li>
                      <li>
                        Epinephrine
                      </li>
                      <li>
                        Adenosine
                      </li>
                      <li>
                        TXA
                      </li>
                      <li>
                        EACA
                      </li>
                      <li>
                        Painkiller Boxes
                      </li>
                      <li>
                        Carbonate Boxes
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Blood &amp; Circulation
                    </h4>
                    <ul>
                      <li>
                        16g IV
                      </li>
                      <li>
                        Saline IV (1000ML)
                      </li>
                      <li>
                        Saline IV (500ML)
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Bandage &amp; Others
                    </h4>
                    <ul>
                      <li>
                        Bandage Elastic
                      </li>
                      <li>
                        Bandage Packing
                      </li>
                      <li>
                        Bandage QuickClot
                      </li>
                      <li>
                        Splints
                      </li>
                      <li>
                        Tourniquets
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Airway &amp; Breathing
                    </h4>
                    <ul>
                      <li>
                        Pulse Oximeter
                      </li>
                      <li>
                        AAT Kit
                      </li>
                      <li>
                        Chest Seal
                      </li>
                      <li>
                        King LT
                      </li>
                      <li>
                        Oxygen Tank 150L
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Non-Consumable — Surgery
                    </h4>
                    <ul>
                      <li>
                        Surgical Kit
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Non-Consumable — Airway
                    </h4>
                    <ul>
                      <li>
                        Stethoscope
                      </li>
                      <li>
                        Accuvac
                      </li>
                      <li>
                        BVM
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Non-Consumable — Circulation
                    </h4>
                    <ul>
                      <li>
                        AED X-Series
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
                  <p>
                    <strong>
                      Abuse of medication
                    </strong>
                    can result in punishments from loss of Certification to Dishonourable Discharge.
                  </p>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  1.4 Medical Communications
                </h3>
                <p>
                  <strong>
                    Main Medical Short Range (SR-333)
                  </strong>
                  — used by medics to communicate with each other.
                </p>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Use Medical Comms For:
                  </strong>
                  <p>
                    Checking medical status of other squads. Requesting medical assistance. Relaying medical resupply information.
                  </p>
                </div>
                <div className="info-box warning [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Do NOT Use Medical Comms For:
                  </strong>
                  <p>
                    Ammo checks, idle chatter, or anything unrelated to medical.
                  </p>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  1.5 Medical Menu
                </h3>
                <p>
                  Press
                  <strong>
                    H
                  </strong>
                  to open the ACE Medical menu. KAT uses the same system and adds Airways and Surgery tabs.
                </p>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Examine &amp; Treatment Tabs:
                  </strong>
                  <p>
                    <strong>
                      Triage Tab
                    </strong>
                    — View past medication and injection timers.
                  </p>
                  <p>
                    <strong>
                      Examine
                    </strong>
                    — Check heart rate, blood pressure, breathing, response.
                  </p>
                  <p>
                    <strong>
                      Bandage &amp; Fractures
                    </strong>
                    — Apply bandages, tourniquets, splints.
                  </p>
                  <p>
                    <strong>
                      Medications
                    </strong>
                    — Auto injectors and oral pills.
                  </p>
                  <p>
                    <strong>
                      Airway Management
                    </strong>
                    — O2 management (chest and head only).
                  </p>
                  <p>
                    <strong>
                      Advanced Treatment
                    </strong>
                    — IVs, blood, wound stitching, CPR, recovery position.
                  </p>
                  <p>
                    <strong>
                      Drag/Carry
                    </strong>
                    — Move downed troopers.
                  </p>
                  <p>
                    <strong>
                      Toggle Self/Person
                    </strong>
                    — Switch between self and patient.
                  </p>
                </div>
                <table className="med-table w-full [border-collapse:collapse] [margin:1rem_0_1.5rem] [font-family:'Rajdhani',sans-serif] [.hc-tab-content_&]:[text-align:left]">
                  <thead>
                    <tr>
                      <th>
                        BODY COLOUR
                      </th>
                      <th>
                        MEANING
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{color: '#e8e8e8'}}>
                        White
                      </td>
                      <td>
                        No injury or fully healed
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#5599dd'}}>
                        Blue
                      </td>
                      <td>
                        Bandaged / bruised / O2 issues
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#ddcc55'}}>
                        Light Yellow
                      </td>
                      <td>
                        Light damage
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#dd8833'}}>
                        Orange
                      </td>
                      <td>
                        Medium damage
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#dd4444'}}>
                        Red
                      </td>
                      <td>
                        Heavy damage
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#5599dd'}}>
                        Blue Bones
                      </td>
                      <td>
                        Splint applied
                      </td>
                    </tr>
                    <tr>
                      <td style={{color: '#dd4444'}}>
                        Red Bones
                      </td>
                      <td>
                        Broken bones
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none] [.hc-tab-content_&]:[text-align:left] [.hc-tab-content_&]:[max-width:900px] [.hc-tab-content_&]:[margin:0_auto]" id="ch2">
              <div className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
                <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem] [.hc-tab-content_.page-content.section-title_&]:[font-size:1rem] [.hc-tab-content_.page-content.section-title_&]:[padding:0.3rem_0.8rem]">
                  2
                </span>
                BASIC MEDICAL
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  2.0 Introduction
                </h3>
                <p>
                  The goal of basic medical training is to refresh everyone on first aid. You will learn how to assist unconscious troopers during combat using bandages, tourniquets, head turning, hyperextending the head, and recovery position.
                </p>
                <p>
                  Those who complete the steps properly can bring a trooper back up without a medic. Failure can happen due to time, blood loss, or past injuries.
                  <strong>
                    A stabilized trooper is a trooper not bleeding with cleared airways.
                  </strong>
                  Always call a corpsman when able.
                </p>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  2.1 Basic First Aid Equipment &amp; Actions
                </h3>
                <div className="equip-grid grid [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))] [gap:1rem] [margin:1rem_0_1.5rem] [.hc-tab-content_&]:[text-align:left]">
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Equipment
                    </h4>
                    <ul>
                      <li>
                        Bandage Elastic
                      </li>
                      <li>
                        Bandage Packing
                      </li>
                      <li>
                        Bandage QuickClot
                      </li>
                      <li>
                        Tourniquets
                      </li>
                    </ul>
                  </div>
                  <div className="equip-group [background:rgba(0,0,0,.2)] [border:1px_solid_rgba(0,217,255,.1)] [padding:1rem_1.2rem]">
                    <h4>
                      Actions
                    </h4>
                    <ul>
                      <li>
                        Airway — Head Turning
                      </li>
                      <li>
                        Airways — Hyperextending Head
                      </li>
                      <li>
                        Chest — Recovery Position
                      </li>
                      <li>
                        Heart Rate Check
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  2.2 Step by Step Guide to First Aid
                </h3>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    A Stabilized Trooper Means:
                  </strong>
                  <p>
                    No bleeding. No blocked airways. Blood loss at "lost some blood" or none. Has a heart rate.
                  </p>
                </div>
                <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter] [.hc-tab-content_&]:[text-align:left]">
                  <li>
                    <strong>
                      Secure the area.
                    </strong>
                    Depending on contact level, engage or provide first aid. Your first priority is making sure the area is clear.
                  </li>
                  <li>
                    <strong>
                      Check trooper status
                    </strong>
                    and relay down trooper status to medic and squad leader.
                  </li>
                  <li>
                    <strong>
                      Place tourniquets then bandage wounds
                    </strong>
                    until there is no more bleeding. Heavy wounds require tourniquets first. Note: tourniquets block EVERYTHING including auto injectors, IV blood, TXA and EACA.
                  </li>
                  <li>
                    <strong>
                      Check airways.
                    </strong>
                    Occlusion → head turning until removed. Obstruction → hyperextend head or place in recovery position and await medic.
                  </li>
                  <li>
                    <strong>
                      Check heart rate.
                    </strong>
                    If bleeding stopped, airways clear, and blood loss is minimal, the trooper has the best chance of waking up.
                  </li>
                </ol>
                <div className="quote-block small [background:var(--bg-elevated)] [border-left:6px_solid_var(--accent)] [padding:2rem] [margin:2rem_0] italic [box-shadow:0_0_20px_var(--accent-glow)]">
                  <p>
                    The basics are important. Use what you learn to assist other enlisted and increase the survivability of your squad.
                  </p>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  2.3 Final Test
                </h3>
                <p>
                  You will provide basic first aid to either:
                  <strong>
                    A
                  </strong>
                  — Stabilize the patient and allow them to wake up without further aid, or
                  <strong>
                    B
                  </strong>
                  — Prep the patient for a medic (stabilized = not bleeding).
                </p>
                <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
                  <p>
                    Failure is missing any vital stabilization steps or the patient dying.
                  </p>
                </div>
              </div>
            </div>
            <div className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none] [.hc-tab-content_&]:[text-align:left] [.hc-tab-content_&]:[max-width:900px] [.hc-tab-content_&]:[margin:0_auto]" id="ch3">
              <div className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
                <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem] [.hc-tab-content_.page-content.section-title_&]:[font-size:1rem] [.hc-tab-content_.page-content.section-title_&]:[padding:0.3rem_0.8rem]">
                  3
                </span>
                ADVANCED MEDICAL
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.0 Introduction
                </h3>
                <p>
                  You will learn
                  <strong>
                    C.A.C.B
                  </strong>
                  — Circulation, Airways, Circulation (Advanced) and Breathing. You must resolve each section before moving to the next. Sometimes you may need to backtrack due to reopening bandages or the patient vomiting.
                </p>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.1 Circulation
                </h3>
                <p>
                  Associated with
                  <strong>
                    bleeding, blood loss, and the heart
                  </strong>
                  . At fatal blood loss, the patient loses heart rate and enters cardiac arrest — you have less than 5 minutes.
                </p>
                <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter] [.hc-tab-content_&]:[text-align:left]">
                  <li>
                    <strong>
                      Stop the bleeding
                    </strong>
                    — Use TXA (auto bandage) and EACA (auto stitch) on heavy wounds. These won't work on tourniqueted limbs.
                  </li>
                  <li>
                    <strong>
                      Apply tourniquets
                    </strong>
                    to arms and legs to block bleeding. Note: tourniquets block ALL medications on that limb.
                  </li>
                  <li>
                    <strong>
                      Bandage priority:
                    </strong>
                    Head → Chest → Least damaged untourniqueted limb.
                  </li>
                  <li>
                    <strong>
                      Insert IV
                    </strong>
                    on an open limb (or IO IV) → provide blood 500ML-1000ML. Keep topping up until patient reaches "lost some blood".
                  </li>
                  <li>
                    <strong>
                      Stitch
                    </strong>
                    all bandaged wounds (head, chest, untourniqueted limb).
                  </li>
                </ol>
                <div className="warning-box [background:rgba(255,184,0,0.1)] [border:2px_solid_#FFB800] [padding:1.5rem] [margin:1.5rem_0] [box-shadow:0_0_15px_rgba(255,184,0,0.3)]">
                  <p>
                    Skipping any of these steps may result in delayed recovery, supply waste, or death.
                  </p>
                </div>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.2 Airways
                </h3>
                <p>
                  Associated with
                  <strong>
                    oxygen and lungs
                  </strong>
                  . Always watch blood levels and top off when low.
                </p>
                <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter] [.hc-tab-content_&]:[text-align:left]">
                  <li>
                    <strong>
                      Confirm circulation is complete.
                    </strong>
                  </li>
                  <li>
                    <strong>
                      Check airways
                    </strong>
                    — Is there an occlusion? An obstruction?
                  </li>
                  <li>
                    <strong>
                      Occlusion
                    </strong>
                    → Use
                    <strong>
                      Airway Suction
                    </strong>
                    (replaces head turning for medics).
                  </li>
                  <li>
                    <strong>
                      Obstruction
                    </strong>
                    → Use
                    <strong>
                      King LT
                    </strong>
                    . Without it, hyperextend head or use recovery position as alternatives.
                  </li>
                </ol>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.3 Circulation (Advanced) — Heart Restart
                </h3>
                <p>
                  Caused by fatal blood loss, overdose, or heavy impact wounds. Uses
                  <strong>
                    AED with heart rate monitor
                  </strong>
                  , manual HR check, and Epinephrine.
                </p>
                <p>
                  Patient blood loss must be at "lost some blood" before attempting heart restart.
                </p>
                <table className="med-table w-full [border-collapse:collapse] [margin:1rem_0_1.5rem] [font-family:'Rajdhani',sans-serif] [.hc-tab-content_&]:[text-align:left]">
                  <thead>
                    <tr>
                      <th>
                        EKG RHYTHM
                      </th>
                      <th>
                        TREATMENT
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          Asystole
                        </strong>
                        (flatline)
                      </td>
                      <td>
                        CPR + Epinephrine
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          PEA
                        </strong>
                        (fake electrical activity)
                      </td>
                      <td>
                        CPR + Epinephrine (check HR manually — if none but monitor shows activity, it's PEA)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          VT / VF
                        </strong>
                        (shockable)
                      </td>
                      <td>
                        Defibrillator Shock
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>
                          Normal Sinus
                        </strong>
                      </td>
                      <td>
                        No action needed — heart is restored
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    No AED available?
                  </strong>
                  <p>
                    Treat all cardiac arrest as asystole — CPR until heart rate is restored. Timer to death slows by 50% during CPR.
                  </p>
                </div>
                <ol className="rule-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter] [.hc-tab-content_&]:[text-align:left]">
                  <li>
                    Patient must be at "lost a lot of blood" for accurate readings, "lost some blood" for best survival chance.
                  </li>
                  <li>
                    Apply AED pads to patient.
                  </li>
                  <li>
                    Check HR manually AND via AED monitor.
                  </li>
                  <li>
                    Confirm rhythm type → apply treatment (CPR or Shock).
                  </li>
                  <li>
                    Continue until shockable rhythm achieved or HR restored.
                  </li>
                </ol>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.4 Breathing
                </h3>
                <p>
                  Associated with
                  <strong>
                    chest and lungs
                  </strong>
                  . Two conditions affect breathing:
                </p>
                <div className="info-box warning [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Pneumothorax
                  </strong>
                  <p>
                    Air trapped between lungs and chest. Short breaths. Treatment: Chest Seal → Needle Decompression → Auscultate.
                  </p>
                </div>
                <div className="info-box warning [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Hemothorax
                  </strong>
                  <p>
                    Blood trapped between lungs and chest. Gurgling/liquid sounds. Treatment: Chest Seal → Drain Fluids → Auscultate.
                  </p>
                </div>
                <p>
                  Both will result in oxygen loss and eventually
                  <strong>
                    death
                  </strong>
                  if untreated. Use the
                  <strong>
                    Auscultate
                  </strong>
                  action to diagnose which condition the patient has. Deep penetrating wounds are a strong indicator.
                </p>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.5 Stabilized / Wakeup
                </h3>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Wakeup Criteria:
                  </strong>
                  <p>
                    Blood loss = Lost some blood. No open wounds. Heart rate above 40 BPM. Blood pressure above 60. Oxygen saturation above 85%.
                  </p>
                </div>
                <p>
                  A stabilized person may wake up on their own. Tools to increase wakeup chances:
                  <strong>
                    Reorientate
                  </strong>
                  action,
                  <strong>
                    Carbonate
                  </strong>
                  oral pill,
                  <strong>
                    Epinephrine
                  </strong>
                  auto injector.
                </p>
              </div>
              <div className="subsection [margin-bottom:2.5rem] [.hc-tab-content_&]:[text-align:left]">
                <h3>
                  3.6 Final Test
                </h3>
                <p>
                  You will be provided a severely injured trooper who has reached large blood loss or cardiac arrest. Bring them back using everything you've learned. No assistance from third parties or the instructor.
                </p>
                <div className="info-box [background:transparent] [border:none] [&&]:[border-left:4px_solid_var(--accent)] [padding:0.8rem_0_0.8rem_1.5rem] [margin-bottom:1.5rem] [box-shadow:none] [&.warning]:[border-left-color:#FFB800] [.hc-tab-content_&]:[text-align:left]">
                  <strong>
                    Pass:
                  </strong>
                  <p>
                    Trooper survives.
                  </p>
                  <strong>
                    Fail:
                  </strong>
                  <p>
                    Trooper dies. 2 attempts total.
                  </p>
                </div>
              </div>
            </div>
            <div className="handbook-section [margin-bottom:4rem] [padding-bottom:2rem] [border-bottom:2px_solid_var(--accent)] [&:last-of-type]:[border-bottom:none] [.hc-tab-content_&]:[text-align:left] [.hc-tab-content_&]:[max-width:900px] [.hc-tab-content_&]:[margin:0_auto]" id="refs">
              <div className="section-title flex items-center [gap:1.5rem] [padding:1.5rem_2rem] [background:var(--bg-card)] cursor-pointer [transition:all_0.3s_ease] [color:var(--text-primary)] [font-size:1.2rem] [font-weight:600] [letter-spacing:2px] hover:[background:var(--bg-elevated)] hover:[border-left:4px_solid_var(--accent)] hover:[padding-left:calc(2rem_-_4px)] [&.active]:[background:var(--primary-dark)] [&.active]:[border-left:4px_solid_var(--accent)] [&.active]:[padding-left:calc(2rem_-_4px)] max-[768px]:[font-size:1rem] max-[768px]:[padding:1.25rem_1.5rem] [.page-content_&]:[display:flex] [.page-content_&]:[align-items:center] [.page-content_&]:[gap:2rem] [.page-content_&]:[color:var(--accent)] [.page-content_&]:[font-size:2.5rem] [.page-content_&]:[letter-spacing:4px] [.page-content_&]:[margin-bottom:2rem] [.page-content_&]:[text-shadow:0_0_15px_var(--accent-glow)] max-[768px]:[.page-content_&]:[flex-direction:column] max-[768px]:[.page-content_&]:[gap:1rem] max-[768px]:[.page-content_&]:[font-size:1.8rem] max-[480px]:[.page-content_&]:[font-size:1.5rem] max-[480px]:[.page-content_&]:[letter-spacing:2px]">
                <span className="section-number [.page-content_&]:[background:var(--primary)] [.page-content_&]:[border:2px_solid_var(--accent)] [.page-content_&]:[padding:0.5rem_1.5rem] [.page-content_&]:[font-size:1.5rem] max-[768px]:[.page-content_&]:[padding:0.4rem_1rem] max-[768px]:[.page-content_&]:[font-size:1.2rem] [.hc-tab-content_.page-content.section-title_&]:[font-size:1rem] [.hc-tab-content_.page-content.section-title_&]:[padding:0.3rem_0.8rem]">
                  ★
                </span>
                REFERENCE LINKS
              </div>
              <ul className="bullet-list [list-style:none] [padding:0] [margin-bottom:1.5rem] [counter-reset:rule-counter]">
                <li>
                  <a href="https://docs.google.com/document/d/1YlY00qoL2gdrbOJJzi5aW19A3HqT7uXflszDYuK7h3M/" style={{color: 'var(--accent)'}} target="_blank">
                    KAM — Official Guide
                  </a>
                </li>
                <li>
                  <a href="https://docs.google.com/document/d/1nPOeyfTZCh4B81zdXA9iN4huilOUgOKwbWWnLXHkW-s/" style={{color: 'var(--accent)'}} target="_blank">
                    KAT + ACE Medical Guide
                  </a>
                </li>
                <li>
                  <a href="https://steamcommunity.com/workshop/filedetails/?id=2020940806" style={{color: 'var(--accent)'}} target="_blank">
                    KAT Advanced Medical — Steam Workshop
                  </a>
                </li>
              </ul>
            </div>
          </div>
            </div>
          </div>
          <div className="closing-quote [background:var(--bg-elevated)] [border:3px_solid_var(--accent)] [padding:3rem] [margin-top:4rem] text-center [box-shadow:0_0_40px_var(--accent-glow)] max-[768px]:[padding:2rem]">
            <p>
              "The Hospital Corps stands as the frontline shield between life and death."
            </p>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
