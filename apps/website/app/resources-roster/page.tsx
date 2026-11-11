import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { shellA } from "@/components/shell-styles";
import RosterLive from "@/components/RosterLive";
import { getViewer } from "@/lib/auth/session";
import { getRoster, ROSTER_ROLES } from "@/lib/roster/data";
import "@/styles/tw/resources-roster.css";

export const metadata: Metadata = { title: "Unit Roster — 505th Expeditionary Force" };
export const dynamic = "force-dynamic";

/**
 * Converted 1:1 from the live resources-roster.html (content after the shared shell).
 * Members only: approved members (Enlistee and above, not retired) see the live
 * roster; everyone else sees the original RESTRICTED ACCESS gate.
 */
export default async function ResourcesRosterPage() {
  const viewer = await getViewer();
  const m = viewer?.member;
  const allowed =
    !!m && (viewer.terminal.result === "GRANTED" || viewer.terminal.reason === "LOW_CLEARANCE") && ROSTER_ROLES.has(m.role);
  const rows = allowed ? await getRoster() : [];
  return (
    <SiteShell styles={shellA}>
      <main className="page-content [min-height:calc(100vh_-_200px)] [padding:3rem_2rem] relative overflow-hidden before:content-[''] before:[position:absolute] before:[top:50%] before:[left:50%] before:[transform:translate(-50%,-50%)] before:[width:1100px] before:[height:1100px] before:[background-image:url('/images/logo.png')] before:[background-size:contain] before:[background-repeat:no-repeat] before:[background-position:center] before:[opacity:0.04] before:[z-index:0] before:[pointer-events:none] max-[768px]:[padding:2rem_1rem] max-[768px]:before:[width:700px] max-[768px]:before:[height:700px] max-[768px]:before:[opacity:0.03] max-[480px]:before:[width:500px] max-[480px]:before:[height:500px] mq1:[padding:1rem] min-[1024px]:[margin-top:72px]! min-[1024px]:[margin-left:52px]! min-[1024px]:[transition:margin-left_0.28s_cubic-bezier(0.4,0,0.2,1)] min-[1024px]:[body.panel-open_&]:[margin-left:252px]!">
        <div className="container [.page-content_&]:[position:relative] [.page-content_&]:[z-index:1] [max-width:1200px] [margin:0_auto]">
          <div id="authGate" style={allowed ? { display: "none" } : undefined}>
            <div className="gate-icon [#authGate_&]:[font-size:52px] [#authGate_&]:[opacity:.25]">
              🔒
            </div>
            <h2>
              RESTRICTED ACCESS
            </h2>
            <p>
              {viewer ? "ACCESS DENIED — INSUFFICIENT CLEARANCE" : "THIS ROSTER REQUIRES ACTIVE ENLISTEE STATUS OR ABOVE"}
            </p>
            <a href={viewer ? "/profile" : "/login?next=/resources-roster"}>
              {viewer ? "MY PROFILE →" : "AUTHENTICATE →"}
            </a>
          </div>
          <div id="rosterContent" style={allowed ? { display: "block" } : undefined}>
            <div className="roster-header-block [margin-bottom:32px] text-center">
              <span className="page-tag inline-block [background:var(--primary)] [color:var(--accent)] [padding:0.5rem_1.5rem] [font-size:0.75rem] [letter-spacing:3px] [font-weight:700] [margin-bottom:1rem] [border:1px_solid_var(--accent)] max-[480px]:[font-size:0.65rem] max-[480px]:[padding:0.4rem_1rem] [.roster-header-block_&]:[font-family:'Share_Tech_Mono',monospace] [.roster-header-block_&]:[font-size:10px] [.roster-header-block_&]:[letter-spacing:4px] [.roster-header-block_&]:[color:var(--accent)] [.roster-header-block_&]:[opacity:.6] [.roster-header-block_&]:[display:block] [.roster-header-block_&]:[margin-bottom:8px]">
                CLASSIFICATION: LEVEL 1
              </span>
              <h1>
                Unit Roster
              </h1>
              <p className="subtitle [.roster-header-block_&]:[font-family:'Share_Tech_Mono',monospace] [.roster-header-block_&]:[font-size:12px] [.roster-header-block_&]:[color:#aaa] [.roster-header-block_&]:[letter-spacing:3px]">
                Live Personnel Database
              </p>
              <hr className="header-rule [border:none] [&&]:[border-top:1px_solid_rgba(0,217,255,.15)] [margin:16px_0_0]" />
            </div>
            {/* Data is loaded on the server, so the old "SYNCING" state is not needed. */}
            <div id="rosterBody">
              <div className="stat-strip flex [gap:12px] [flex-wrap:wrap] [margin-bottom:28px] max-[768px]:[gap:8px]">
                <div className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] max-[768px]:[padding:8px_12px]">
                  <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[color:var(--accent)] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1] max-[768px]:[.stat-pill_&]:[font-size:20px]" id="statTotal">
                    —
                  </span>
                  <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                    TOTAL PERSONNEL
                  </span>
                </div>
                <div className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] max-[768px]:[padding:8px_12px]">
                  <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[color:var(--accent)] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1] max-[768px]:[.stat-pill_&]:[font-size:20px]" id="statActive">
                    —
                  </span>
                  <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                    ACTIVE
                  </span>
                </div>
                <div className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] max-[768px]:[padding:8px_12px]">
                  <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[color:var(--accent)] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1] max-[768px]:[.stat-pill_&]:[font-size:20px]" id="statReserves">
                    —
                  </span>
                  <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                    RESERVES
                  </span>
                </div>
                <div className="stat-pill [background:rgba(0,217,255,.04)] [border:1px_solid_rgba(0,217,255,.12)] [padding:10px_20px] [font-family:'Share_Tech_Mono',monospace] flex flex-col [gap:2px] max-[768px]:[padding:8px_12px]">
                  <span className="val [.stat-pill_&]:[font-size:26px] [.stat-pill_&]:[color:var(--accent)] [.stat-pill_&]:[font-weight:700] [.stat-pill_&]:[line-height:1] max-[768px]:[.stat-pill_&]:[font-size:20px]" id="statPlatoons">
                    —
                  </span>
                  <span className="lbl [.stat-pill_&]:[font-size:11px] [.stat-pill_&]:[letter-spacing:3px] [.stat-pill_&]:[color:#aaa]">
                    PLATOONS
                  </span>
                </div>
              </div>
              <div className="filter-bar flex [gap:8px] [flex-wrap:wrap] [margin-bottom:20px] items-center max-[768px]:[flex-direction:column]">
                <input id="searchInput" placeholder="SEARCH BY NAME..." type="text" />
                <select id="platoonFilter">
                  <option value="">
                    ALL PLATOONS
                  </option>
                  <option value="Command">
                    Command
                  </option>
                  <option value="1st Platoon">
                    1st Platoon
                  </option>
                  <option value="2nd Platoon">
                    2nd Platoon
                  </option>
                  <option value="3rd Platoon">
                    3rd Platoon
                  </option>
                  <option value="Force Recon">
                    Force Recon
                  </option>
                  <option value="Corpsmen">
                    Corpsmen
                  </option>
                  <option value="Pilot">
                    Pilot
                  </option>
                  <option value="Reserves">
                    Reserves
                  </option>
                </select>
                <select id="rankSort" defaultValue="rank-asc" aria-label="Sort">
                  <option value="rank-asc">
                    SORT: PAYGRADE (HIGHEST FIRST)
                  </option>
                  <option value="rank-desc">
                    SORT: PAYGRADE (LOWEST FIRST)
                  </option>
                  <option value="name">
                    SORT: NAME A–Z
                  </option>
                </select>
              </div>
              <div id="rosterGroups"></div>
              {allowed && <RosterLive rows={rows} />}
              <div className="roster-notice [margin-top:32px] [padding:16px_20px] [border:1px_solid_rgba(0,217,255,.25)] [&&]:[border-left:3px_solid_var(--accent)] [background:rgba(0,0,0,.4)] [font-family:'Rajdhani',sans-serif] [font-size:14px] [font-weight:500] [letter-spacing:1.5px] [color:#ccc] [line-height:2] text-center">
                ⚠  THIS ROSTER IS FOR OFFICIAL UNIT USE ONLY. PERSONNEL INFORMATION IS CONFIDENTIAL.
                <br />
                FOR ROSTER UPDATES OR CORRECTIONS, CONTACT YOUR NCO OR UNIT ADMINISTRATION.
              </div>
            </div>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
