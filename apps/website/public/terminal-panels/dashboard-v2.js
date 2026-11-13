/**
 * DASHBOARD v3 (approved mock 2026-11-11) — on top of v2 (shell-v2, 2026-11-10).
 * v3: welcome pills + system lights + your status dot · Messages dock with pop-up chats (msg-dock.js) ·
 *     new widgets: My Attendance, My Status, Quick Actions, Messages, Monthly Reset, Latest AAR · widget library with previews.
 * Welcome bar · customise bar · widget grid · "+ Add widget" drawer.
 * Layout is saved per member on users/{uid}.dashLayout = { order: [...], wide: [...] }.
 * Widgets only appear if the member has the access item they need.
 * Cortana / Discord / Hub numbers show as "not running" until Cortana v2 reports them.
 */
import { onAuthStateChanged } from "/terminal-shim/auth.js";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from "/terminal-shim/firestore.js";
import { addCss, auth, cortanaStatus, db, esc, uptimeDays, getMe, getUsers, hexAvatar, isMember, memberName, notify, onReady, platoonOrder, rateColor, toDate } from "./_common.js";
import { onAccess } from "./nav-v2.js";
import { STATES, mountDock, openPop, refreshPopPosition, startDock, statusOf, updateUsers } from "./msg-dock.js";

addCss("dash2", `
#panel-dashboard > :not(.panel-title):not(#dash2){display:none!important}
#dash2{font-family:'Share Tech Mono',monospace;color:#d6dde6}
#dash2 .b{background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;padding:8px 14px;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;font-size:11.5px;cursor:pointer}
#dash2 .b.gold,.d2-drawer .b.gold{background:#f59e0b;border-color:#f59e0b;color:#000}
.d2-drawer .b{background:none;border:1px solid rgba(0,217,255,.35);color:#00D9FF;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:2px;cursor:pointer}
#dash2 .b.sm,.d2-drawer .b.sm{padding:4px 9px;font-size:10px}
#dash2 .dim,.d2-drawer .dim{color:#7d8a99;font-size:10.5px;letter-spacing:1.5px}
#dash2 .lnk{background:none;border:0;color:#00D9FF;font-size:10px;letter-spacing:1.5px;cursor:pointer;font-family:inherit}
.d2-welcome{display:flex;align-items:center;gap:16px;border:1px solid rgba(0,217,255,.18);background:linear-gradient(90deg,rgba(0,217,255,.06),transparent);padding:14px 18px}
.d2-hi{font-family:Rajdhani,sans-serif;font-weight:700;font-size:24px;letter-spacing:4px;color:#fff}
.d2-unit{text-align:right;margin-left:auto}.d2-unit b{display:block;font-family:Rajdhani,sans-serif;font-size:16px;letter-spacing:2px}.d2-unit small{font-size:10px;letter-spacing:2px}
.d2-custbar{display:none;align-items:center;gap:10px;border:1px dashed #f59e0b;background:rgba(245,158,11,.06);color:#f59e0b;padding:10px 14px;margin-top:12px;flex-wrap:wrap}.d2-custbar.on{display:flex}.d2-custbar b{font-family:Rajdhani,sans-serif;letter-spacing:2px}
.d2-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.d2-w{border:1px solid rgba(0,217,255,.18);background:#0b0f15;padding:14px 16px;position:relative;min-height:120px;min-width:0}.d2-w.wide{grid-column:1/-1}
.d2-wh{display:flex;justify-content:space-between;align-items:center;font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:3px;color:#00D9FF;font-size:13px;margin-bottom:10px;gap:8px}
.d2-wt{display:none;gap:4px}.d2-editing .d2-w{border-style:dashed;border-color:#f59e0b;cursor:grab}.d2-editing .d2-wt{display:flex}.d2-w.dragging{opacity:.35}.d2-w.over{box-shadow:0 0 0 2px #00D9FF}
.d2-wt button{background:#070a0f;border:1px solid rgba(0,217,255,.35);color:#c6d0da;width:26px;height:24px;cursor:pointer;font-size:11px}.d2-wt .rm{color:#ff4d4d;border-color:rgba(255,77,77,.5)}.d2-wt .hd{cursor:grab}
.d2-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.d2-kpi{border:1px solid rgba(0,217,255,.18);background:#0e131b;padding:14px;text-align:center}.d2-kpi b{display:block;font-family:Rajdhani,sans-serif;font-size:26px;color:#00D9FF}.d2-kpi span{font-size:9px;letter-spacing:2.5px;color:#7d8a99}
.d2-op{display:grid;grid-template-columns:48px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);align-items:center}.d2-op .d{text-align:center;font-size:9.5px;letter-spacing:2px;color:#7d8a99}.d2-op .d b{display:block;font-family:Rajdhani,sans-serif;font-size:22px;color:#fff;line-height:1}.d2-op>div>b{font-family:Rajdhani,sans-serif;font-size:15px;color:#fff}.d2-op small{display:block;font-size:10px;color:#7d8a99;letter-spacing:1px}
.d2-todo{border-left:3px solid #00D9FF;padding:8px 12px;margin-bottom:6px;font-size:12px;background:rgba(255,255,255,.02);display:flex;justify-content:space-between;gap:8px;align-items:center}.d2-todo.am{border-color:#f59e0b}
.d2-onl{display:flex;flex-wrap:wrap;gap:12px}.d2-ou{display:flex;flex-direction:column;align-items:center;gap:3px;position:relative}.d2-ou small{font-size:9.5px;color:#7d8a99}.d2-ou::after{content:"";position:absolute;right:2px;top:22px;width:8px;height:8px;background:#22e07a;border-radius:50%;border:2px solid #0b0f15}
.d2-act{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:7px 0;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04)}.d2-act b{color:#fff;font-weight:400}.d2-act small{font-size:10px;color:#7d8a99}
.d2-kvr{display:flex;justify-content:space-between;font-size:11.5px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)}.d2-kvr span{color:#7d8a99;letter-spacing:1.5px;font-size:10px}.d2-kvr b{font-weight:400;color:#fff}
.d2-lb{font-size:9.5px;letter-spacing:2px;color:#7d8a99;margin:14px 0 6px}
.d2-hbar{display:grid;grid-template-columns:120px 1fr 64px;gap:10px;align-items:center;font-size:10.5px;letter-spacing:1.2px;color:#7d8a99;margin-bottom:8px}.d2-hbar b{color:#fff;font-weight:400;text-align:right}
.d2-ub{display:flex;gap:2px;height:16px}.d2-ub i{flex:1;background:#22e07a;opacity:.8}.d2-ub i.uw{background:#f59e0b}.d2-ub i.ur{background:#ff4d4d}.d2-ub i.uo{background:#26303b;opacity:1}
.d2-sys{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.d2-sy{border:1px solid rgba(0,217,255,.18);border-left:3px solid var(--sc);padding:10px}.d2-sy.ok{--sc:#22e07a}.d2-sy.warn{--sc:#f59e0b}.d2-sy.bad{--sc:#ff4d4d}.d2-sy.off{--sc:#4b5765}.d2-sy b{display:block;font-family:Rajdhani,sans-serif;letter-spacing:2px;color:#fff;font-size:14px}.d2-sy span{font-size:9.5px;letter-spacing:1.5px;color:var(--sc)}.d2-sy.off span{color:#7d8a99}.d2-sy small{display:block;font-size:9.5px;color:#7d8a99;margin-top:4px}
.d2-ch{display:flex;align-items:flex-end;gap:3px;height:60px;margin-top:6px}.d2-ch i{flex:1;background:linear-gradient(#00D9FF,rgba(0,217,255,.3));min-height:2px}.d2-ch i.off{background:#26303b}
.d2-liveop{display:flex;align-items:center;gap:14px;border-color:rgba(255,77,77,.4)!important}.d2-liveop>div{flex:1}.d2-liveop b{display:block;color:#fff;font:700 17px Rajdhani,sans-serif;letter-spacing:1px}.d2-lv{display:inline-flex;align-items:center;gap:6px;color:#ff4d4d;font-size:10px;letter-spacing:2px}.d2-lv i{width:8px;height:8px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 8px #ff4d4d}.d2-lvbar{height:5px;background:#1c2a30;margin:6px 0 4px;max-width:320px}.d2-lvbar i{display:block;height:100%;background:#22e07a}
.d2-stf.off{opacity:.5}.d2-sav{position:relative;display:inline-block}.d2-sd{position:absolute;right:-2px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2px solid #0b0f15;background:#5b6570}.d2-leg .d2-sd{position:static;display:inline-block;width:8px;height:8px;border:0;margin-right:4px}.d2-sd.online{background:#22e07a}.d2-sd.idle{background:#f0b232}.d2-sd.dnd{background:#f23f43}.d2-sd.offline{background:#5b6570}
.d2-chips{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.d2-chip{font-size:9.5px;letter-spacing:1px;padding:2px 6px;border:1px solid rgba(0,217,255,.35);color:#00D9FF;white-space:nowrap}.d2-chip.v{border-color:rgba(167,139,250,.5);color:#a78bfa}
.d2-leg{display:flex;gap:12px;font-size:9.5px;letter-spacing:1px;color:#7d8a99;margin-top:6px}.d2-leg span{display:flex;align-items:center}
#d2Toasts{position:fixed;right:16px;bottom:16px;z-index:9000;display:flex;flex-direction:column;gap:8px}.d2-toast{display:flex;gap:10px;align-items:center;min-width:260px;max-width:340px;border:1px solid #00D9FF;background:#071016;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.5);font-size:12px}.d2-toast b{color:#fff;font-family:Rajdhani,sans-serif;font-size:14px}.d2-toast small{display:block;color:#7d8a99}.d2-toast button{all:unset;cursor:pointer;margin-left:auto;color:#7d8a99;padding:2px 6px}.d2-toast button:focus-visible{outline:2px solid #00D9FF}
.d2-skp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.d2-skp div{border:1px solid rgba(0,217,255,.18);padding:7px 9px;background:rgba(0,0,0,.25)}.d2-skp small{display:block;font-size:9px;letter-spacing:2px;color:#7d8a99}.d2-skp b{display:block;font:700 22px Rajdhani,sans-serif}.d2-skp span{font-size:10px;color:#7d8a99}
.d2-stb{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}.d2-stb button{border:1px solid rgba(0,217,255,.2);background:none;color:#7d8a99;font-size:10px;letter-spacing:1.5px;padding:3px 9px;cursor:pointer}.d2-stb button.on{border-color:#00D9FF;color:#00D9FF;background:rgba(0,217,255,.08)}.d2-stb input{margin-left:auto;border:1px solid rgba(0,217,255,.2);background:#070a0f;color:#fff;font-size:11px;padding:3px 8px;width:150px}
.d2-stt{width:100%;border-collapse:collapse;font-size:12px}.d2-stt th{font-size:9px;letter-spacing:2px;color:#7d8a99;text-align:left;font-weight:normal;padding:4px 6px;border-bottom:1px solid rgba(0,217,255,.15)}.d2-stt td{padding:6px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}.d2-stt tr.off td{opacity:.5}
.d2-stw{display:flex;align-items:center;gap:8px}.d2-stw b{font-family:Rajdhani,sans-serif;font-size:14px;color:#fff;font-weight:700}.d2-stw small{display:block;font-size:9.5px;color:#7d8a99;letter-spacing:1px}.d2-stn{font-family:Rajdhani,sans-serif;font-size:14px;color:#fff}
.d2-stbar{display:flex;align-items:flex-end;justify-content:flex-end;gap:3px;height:26px}.d2-stbar i{width:8px;background:linear-gradient(to top,rgba(0,217,255,.25),#00D9FF)}.d2-stbar i.z{background:rgba(255,255,255,.07)}
@media(max-width:700px){.d2-skp{grid-template-columns:repeat(2,1fr)}.d2-stt th:nth-child(3),.d2-stt td:nth-child(3),.d2-stt th:nth-child(5),.d2-stt td:nth-child(5){display:none}}
.d2-stf{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}.d2-stf b{font-family:Rajdhani,sans-serif;font-size:14px;color:#fff;font-weight:700}.d2-stf small{display:block;font-size:9.5px;color:#7d8a99;letter-spacing:1px}.d2-stf .wh2{font-size:10px;color:#7d8a99;text-align:right}.d2-stf .wh2 i{font-style:normal;color:#00D9FF}
.d2-cort{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.d2-cort div{border:1px solid rgba(0,217,255,.18);padding:10px;text-align:center}.d2-cort b{display:block;font-family:Rajdhani,sans-serif;font-size:20px;color:#4b5765}.d2-cort span{font-size:9px;letter-spacing:1.5px;color:#7d8a99}
.d2-sr{font-family:Rajdhani,sans-serif;color:#fff;font-size:15px;letter-spacing:1px}.d2-w p.d2-p{margin:6px 0;font-size:12.5px;white-space:pre-wrap}
.d2-hint{font-size:10px;color:#7d8a99;line-height:1.6;margin-top:10px}
.d2-drawer{position:fixed;top:58px;right:0;bottom:0;width:360px;max-width:94vw;background:#0b0f15;border-left:1px solid rgba(0,217,255,.35);z-index:450;padding:14px;overflow:auto;box-shadow:-20px 0 60px rgba(0,0,0,.5);font-family:'Share Tech Mono',monospace}.d2-drawer[hidden]{display:none}
.d2-dh{display:flex;align-items:center;margin-bottom:12px}.d2-dh b{font-family:Rajdhani,sans-serif;letter-spacing:3px;color:#00D9FF;flex:1}
.d2-ci{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;border:1px solid rgba(0,217,255,.18);padding:10px;margin-bottom:8px}.d2-ci .ico{width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(0,217,255,.35);color:#00D9FF;font-size:16px}
.d2-ci b{display:block;font-size:12px;letter-spacing:1.5px;color:#fff;font-weight:400}.d2-ci small{font-size:10px;color:#7d8a99;line-height:1.4}.d2-ci.on{opacity:.45}.d2-ci .lock{font-size:9.5px;color:#7d8a99;letter-spacing:1px}
.d2-ch2{font-size:9.5px;letter-spacing:2px;color:#f59e0b;margin:14px 0 8px}
.d2-pl{display:grid;grid-template-columns:120px 1fr 34px;gap:10px;align-items:center;font-size:11px;padding:4px 0}.d2-pl span{color:#aeb9c4;letter-spacing:1px}.d2-pl b{text-align:right;font-weight:400;color:#fff}.d2-pl .bar{height:8px;background:#1a2330}.d2-pl .bar i{display:block;height:100%;background:#00D9FF}
.d2-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;width:100%;padding:7px 0;border:0;border-bottom:1px solid rgba(255,255,255,.04);background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer}.d2-row:hover{background:rgba(0,217,255,.04)}.d2-row small{font-size:10px;color:#7d8a99}.d2-row b{font-weight:400;color:#fff}
.d2-tag{font-size:9px;letter-spacing:1.5px;border:1px solid var(--c,#7d8a99);color:var(--c,#7d8a99);padding:1px 6px;white-space:nowrap}
.d2-foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.d2-kan{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.d2-kan div{border:1px solid rgba(0,217,255,.18);padding:6px;text-align:center}.d2-kan b{display:block;font-family:Rajdhani,sans-serif;font-size:18px;color:#00D9FF}.d2-kan span{font-size:8.5px;letter-spacing:1.5px;color:#7d8a99}
#dash2 button:focus-visible,.d2-drawer button:focus-visible{outline:2px solid #00D9FF;outline-offset:1px}
@media(max-width:1000px){.d2-grid,.d2-sys,.d2-cort,.d2-kpis{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.d2-grid{grid-template-columns:1fr}.d2-welcome{flex-wrap:wrap}}
/* ───── v3 ───── */
.d3-shell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0;align-items:start}.d3-main{min-width:0;padding-right:12px}
.d3-me{position:relative;cursor:pointer;display:inline-block}.d3-me:focus-visible{outline:2px solid #00D9FF;outline-offset:3px}
.d3-sdot{position:absolute;right:0;bottom:4px;width:14px;height:14px;border-radius:50%;border:2px solid #0b0f15}
.d3-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.d3-pills span{font-size:10px;letter-spacing:1.5px;padding:3px 8px;border:1px solid rgba(0,217,255,.32);color:#c6d0da;background:rgba(0,0,0,.25)}.d3-pills b{color:#00D9FF;font-weight:400}.d3-pills .hot{border-color:rgba(255,77,77,.5)}.d3-pills .hot b{color:#ff4d4d}
.d3-lights{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap}.d3-li{font-size:9px;letter-spacing:1.5px;display:flex;align-items:center;gap:5px}.d3-li i{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.d3-smenu{position:fixed;z-index:900;background:#0b0f15;border:1px solid rgba(0,217,255,.35);min-width:200px;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:'Share Tech Mono',monospace}.d3-smenu button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid rgba(0,217,255,.07);padding:9px 12px;color:#d6dde6;cursor:pointer;font:inherit;font-size:12px}.d3-smenu button:hover,.d3-smenu button:focus{background:rgba(0,217,255,.07);outline:0}
.d3-ma{display:grid;grid-template-columns:auto 1fr 1fr 1.5fr;gap:18px;align-items:center}
.d3-ring{width:96px;height:96px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),#1a2330 0);display:grid;place-items:center}.d3-ring>div{width:76px;height:76px;border-radius:50%;background:#0b0f15;display:grid;place-items:center;align-content:center;text-align:center}.d3-ring b{font:700 22px Rajdhani,sans-serif;color:#fff;line-height:1}.d3-ring small{font-size:8.5px;letter-spacing:1px;color:#7d8a99}
.d3-pips{display:flex;gap:6px;margin:6px 0}.d3-pips i{width:20px;height:20px;border-radius:50%;border:1px dashed #00D9FF}.d3-pips i.f{background:#f59e0b;border:1px solid #f59e0b}
.d3-big{font:700 22px Rajdhani,sans-serif;color:#fff}
.d3-last>div{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:baseline;font-size:11.5px;padding:3px 0;border-bottom:1px solid rgba(0,217,255,.06)}.d3-next{display:block!important;margin-top:8px;border:0!important}.d3-next b{color:#fff;font-weight:400}
.d3-st{display:grid;grid-template-columns:1fr 1fr;gap:6px}.d3-sb{background:none;border:1px solid rgba(0,217,255,.18);color:#c6d0da;padding:8px;font:inherit;font-size:10.5px;letter-spacing:1.5px;cursor:pointer}.d3-sb.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);color:#fff}
.d3-stn{display:flex;gap:6px;margin-top:8px}.d3-in{flex:1;min-width:0;height:30px;background:#060a0e;border:1px solid rgba(0,217,255,.18);color:#fff;padding:0 8px;font:inherit;font-size:11px}select.d3-in{flex:0 0 auto}
.d3-q{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.d3-q button{background:#0e131b;border:1px solid rgba(0,217,255,.18);padding:12px 4px;text-align:center;font:inherit;font-size:9.5px;letter-spacing:1.5px;color:#c6d0da;cursor:pointer}.d3-q button:hover{border-color:#00D9FF}.d3-q b{display:block;font-size:18px;color:#00D9FF;margin-bottom:2px}
.d3-pv{height:96px;overflow:hidden;border:1px solid rgba(0,217,255,.12);background:#070a0f;margin-bottom:8px;position:relative;pointer-events:none;grid-column:1/-1}.d3-pv>div{transform:scale(.55);transform-origin:top left;width:182%;padding:8px}
.d2-ci{flex-wrap:wrap}
@media(max-width:1100px){.d3-ma{grid-template-columns:auto 1fr}}@media(max-width:800px){.d3-shell{grid-template-columns:1fr}.d3-main{padding:0}.d3-q{grid-template-columns:repeat(2,1fr)}}
`);

const OPS = { Active: ["ACTIVE", "#22e07a"], "Stand Down": ["STAND DOWN", "#7d8a99"], "On Op": ["ON OP", "#f59e0b"], "Training Cycle": ["TRAINING", "#00D9FF"], Maintenance: ["MAINTENANCE", "#a78bfa"] };
const agoTxt = (iso, short = false) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (!(m >= 0)) return "—"; const t = m < 1 ? "just now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : m < 2880 ? "yesterday" : `${Math.round(m / 1440)} days`; return short || m < 1 || m >= 1440 ? t : t + " ago"; };
const STAFF = new Set(["recruiter", "nco", "staff_nco", "officer", "developer", "commander"]);
/** Audit entry → 505th member: by terminal uid, or by Discord ID (Cortana's Discord events) so one person shows as one name. */
const auditUser = (a) => { const u = userOf(a.uid); if (u.id) return u; const id = a.byId || a.byDiscordId; return (id && D.users.find((x) => x.discordId === id)) || {}; };
const ROLE_L = { recruiter: "RECRUITER", nco: "NCO", staff_nco: "STAFF NCO", officer: "OFFICER", developer: "DEVELOPER", commander: "COMMANDER" };

let uid = null;
let acc = {};
let L = [];
let WIDE = new Set();
let editing = false;
const D = { cortana: { online: false }, users: [], fragos: null, events: [], att: [], tasks: [], notes: [], audit: [], pres: [], status: {}, ping: {} };

const ukTime = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : ""; };
const ukDay = (v) => { const d = toDate(v); return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Europe/London" }).toUpperCase() : ""; };
const empty = (t) => `<p class="dim">${t}</p>`;
const active = () => D.users.filter((u) => isMember(u) && !["retired_veteran", "left", "inactive"].includes(u.status) && u.status !== "suspended");
const pending = () => D.users.filter((u) => u.status === "pending");
/** "Discord: 42 online · 6 in voice" from Cortana (bot_status/discord_live). */
const discordLine = () => {
  const d = D.dl;
  const fresh = d?.atISO && Date.now() - Date.parse(d.atISO) < 5 * 60000;
  if (!fresh) return '<small class="dim" style="display:block;margin-top:10px">IN THE TERMINAL · DISCORD: WAITING FOR CORTANA</small>';
  const v = (d.voice || []).reduce((a, c) => a + c.members.length, 0);
  return `<small class="dim" style="display:block;margin-top:10px">ABOVE: IN THE TERMINAL · DISCORD: <b style="color:#22e07a">${d.online ?? "—"} ONLINE</b> OF ${d.members ?? "—"} · <b style="color:#00D9FF">${v} IN VOICE</b>${v ? " (" + (d.voice || []).map((c) => `${esc(c.name)} ${c.members.length}`).join(" · ") + ")" : ""}</small>`;
};
const onlineNow = () => {
  const cut = Date.now() - 2 * 60 * 1000; // check-ins every 30 s → gone within 2 min of closing
  const m = new Map();
  D.pres.filter((p) => Date.parse(p.updatedAt || 0) > cut).forEach((p) => m.set(p.uid, p));
  // You're looking at the dashboard, so you're online — even if your check-in hasn't been saved yet.
  if (D.me?.uid && !m.has(D.me.uid)) m.set(D.me.uid, { uid: D.me.uid, role: D.me.role || "", panel: "admin_dashboard", updatedAt: new Date().toISOString() });
  // My Status: Invisible / Offline members don't show as online to others.
  return [...m.values()].filter((p) => p.uid === D.me?.uid || statusOf(userOf(p.uid)) !== "offline");
};
const userOf = (id) => D.users.find((u) => u.id === id) || {};
const panelName = (p) => {
  const id = String(p || "").replace(/^admin_/, "panel-");
  const l = document.querySelector(`#sidebar .sub-link[data-panel="${id}"]`) || document.querySelector(`#sidebar .sub-link[data-panel="panel-${p}"]`);
  if (/dashboard/.test(String(p))) return "DASHBOARD";
  return (l ? l.textContent.trim() : String(p || "Terminal").replace(/_/g, " ")).toUpperCase();
};
const ub = (pcts) => `<div class="d2-ub">${pcts.map((v) => `<i class="${v == null ? "uo" : v < 95 ? "ur" : v < 99.9 ? "uw" : ""}"></i>`).join("")}</div>`;
const NO_HISTORY = Array(30).fill(null);
/** Website / database uptime from Cortana's 1-minute checks (bot_status/monitors): % of checks that passed per UK day. */
const monDays = (m) => Array.from({ length: 30 }, (_, i) => {
  const d = m?.days?.[new Date(Date.now() - (29 - i) * 864e5).toLocaleDateString("en-CA", { timeZone: "Europe/London" })];
  return d && d.n ? Math.round((d.ok / d.n) * 1000) / 10 : null;
});
function monthAtt(offset) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - offset, 1);
  const key = d.toISOString().slice(0, 7);
  const evs = D.att.filter((e) => String(e.date || "").startsWith(key));
  const size = active().length || 1;
  if (!evs.length) return { key, pct: null, label: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() };
  const got = evs.reduce((s, e) => s + (Array.isArray(e.attendees) ? e.attendees.length : 0), 0);
  return { key, pct: Math.min(100, Math.round((got / (evs.length * size)) * 100)), label: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase() };
}
const go = (panel) => window.showPanel?.(panel);

/* ───────── widgets ───────── */
function staffToast(u) {
  let box = document.getElementById("d2Toasts");
  if (!box) { box = document.createElement("div"); box.id = "d2Toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = "d2-toast";
  t.innerHTML = `${hexAvatar(u, "xs")}<span><b>${esc(memberName(u))}</b><small>signed in to the Command Terminal</small></span><button type="button" aria-label="Close">✕</button>`;
  t.querySelector("button").onclick = () => t.remove();
  box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), 10000);
}

const WID = {
  sitrep: { t: "📌 SITREP", d: "Latest report from Command", ico: "📌", g: "UNIT", b: () => {
    const f = D.fragos;
    if (!f) return empty("NO SITREP POSTED.");
    return `<div class="d2-sr">${esc(String(f.title || "SITREP").toUpperCase())}</div><p class="d2-p">${esc(f.body || "")}</p><small class="dim">${esc(f.authorName || "")}${f.createdAt ? " · " + ukDay(f.createdAt) : ""}</small>`;
  } },
  kpis: { t: "▦ KEY NUMBERS", d: "BCT waiting, members, online, attendance", ico: "▦", g: "UNIT", b: () => {
    const m = monthAtt(0);
    return `<div class="d2-kpis"><button class="d2-kpi" data-go="panel-register" style="cursor:pointer"><b style="color:#f59e0b">${pending().length}</b><span>WAITING FOR BCT</span></button><div class="d2-kpi"><b>${active().length}</b><span>ACTIVE MEMBERS</span></div><div class="d2-kpi"><b style="color:#22e07a">${onlineNow().length}</b><span>ONLINE IN TERMINAL</span></div><div class="d2-kpi"><b>${m.pct == null ? "—" : m.pct + "%"}</b><span>ATTENDANCE (${m.label})</span></div></div>`;
  } },
  ops: { t: "⚑ NEXT EVENTS", d: "Upcoming events and sign-ups", ico: "⚑", g: "UNIT", b: () => {
    const t = new Date().toISOString().slice(0, 10);
    const evs = D.events.filter((e) => (e.date || "") >= t).sort((a, z) => `${a.date}${a.startTime}`.localeCompare(`${z.date}${z.startTime}`)).slice(0, 3);
    if (!evs.length) return empty("NO EVENTS SCHEDULED.");
    return evs.map((e) => {
      const d = new Date(`${e.date}T12:00:00`);
      const n = Array.isArray(e.signups) ? e.signups.length : e.signupCount ?? e.goingCount;
      return `<div class="d2-op"><div class="d"><b>${d.getDate()}</b>${d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</div><div><b>${esc(e.title || "Op")}</b><small>${d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()} ${esc(e.startTime || "")}${n != null ? ` · ${n} SIGNED UP` : ""}</small></div></div>`;
    }).join("");
  } },
  todo: { t: "✓ NEEDS YOU", d: "Things waiting for you to act on", ico: "✓", g: "UNIT", b: () => {
    const rows = needsList();
    return rows.length ? rows.map(([txt, panel, am]) => `<div class="d2-todo ${am ? "am" : ""}"><span>${txt}</span><button class="lnk" ${panel === "bell" ? 'data-bell="1"' : `data-go="${panel}"`}>OPEN</button></div>`).join("") : empty("NOTHING NEEDS YOU RIGHT NOW.");
  } },
  system: { t: "◎ SYSTEM STATUS", d: "Website, database, Cortana, Discord, Cloudinary, Hub — ping and 30-day uptime", ico: "◎", g: "STATUS", acc: "net", accL: "NETWORK STATUS", b: () => {
    const p = D.ping;
    const c = D.cortana;
    const tile = (n, ok, sub) => `<div class="d2-sy ${ok === true ? "ok" : ok === false ? "bad" : "off"}"><b>${n}</b><span>${ok === true ? "● ONLINE" : ok === false ? "✕ DOWN" : "○ NOT RUNNING"}</span><small>${sub}</small></div>`;
    const cortOk = c.online ? true : c.lastHeartbeatISO ? false : null;
    const cortSub = c.online ? `${c.pingMs} MS DISCORD PING` : c.lastHeartbeatISO ? `LAST SEEN ${ukDay(c.lastHeartbeatISO)} ${ukTime(c.lastHeartbeatISO)}` : "NOT STARTED YET";
    const up = uptimeDays(c);
    const pct = (a) => { const v = a.filter((x) => x != null); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(2) + "%" : "—"; };
    return `<div class="d2-sys">${tile("WEBSITE", p.web != null ? true : p.webErr ? false : null, p.web != null ? `${p.web} MS` : "CHECKING…")}${tile("DATABASE", p.db != null ? true : p.dbErr ? false : null, p.db != null ? `${p.db} MS` : "CHECKING…")}${tile("CORTANA v2", cortOk, cortSub)}${tile("DISCORD API", c.online ? c.pingMs < 1000 : null, c.online ? "CHECKED BY CORTANA" : "NEEDS CORTANA")}${tile("CLOUDINARY", p.cdn != null ? true : p.cdnErr ? false : null, p.cdn != null ? `IMAGES · ${p.cdn} MS` : p.cdnErr ? "CAN'T REACH IMAGES" : "CHECKING…")}${(() => { const h = D.hub || {}; return tile("505TH HUB", h.released ? true : h.error ? null : h.released === false ? null : null,
      h.released ? `v${h.version} · ${h.usingNow ? `${h.usingNow} USING NOW` : "NO ONE ON NOW"} · ${h.signedIn} SIGNED IN` : D.hub ? "NO RELEASE YET" : "CHECKING…"); })()}</div>
      <div class="d2-lb">UPTIME — LAST 30 DAYS</div>${[["WEBSITE", monDays(D.mon?.web)], ["DATABASE", monDays(D.mon?.db)], ["CORTANA", up], ["505TH HUB", NO_HISTORY]].map(([n, a]) => `<div class="d2-hbar"><span>${n}</span>${ub(a)}<b>${pct(a)}</b></div>`).join("")}<small class="dim">CORTANA CHECKS THE WEBSITE AND DATABASE EVERY MINUTE AND POSTS AN ALERT IN DISCORD IF ONE IS DOWN FOR 3 MINUTES. HUB: ${D.hub?.released ? `v${D.hub.version} RELEASED — UPTIME HISTORY STARTS FROM THIS RELEASE.` : "NO RELEASE YET."}</small>`;
  } },
  cortana: { t: "◈ CORTANA HEALTH", d: "Bot status, ping, memory, queued jobs, errors", ico: "◈", g: "STATUS", acc: "bot", accL: "BOT SERVER", b: () => {
    const c = D.cortana;
    const up = c.startedAtISO ? Math.floor((Date.now() - Date.parse(c.startedAtISO)) / 60000) : 0;
    const hrs = Array.from({ length: 24 }, (_, i) => new Date(Date.now() - (23 - i) * 3600_000).toISOString().slice(0, 13));
    const vals = hrs.map((h) => c.pingByHour?.[h] ?? null);
    const max = Math.max(100, ...vals.filter((v) => v != null));
    const st = c.online ? `<span style="color:#22e07a;letter-spacing:2px;font-size:11px">● ONLINE · UP ${Math.floor(up / 1440)}D ${Math.floor((up % 1440) / 60)}H</span>` : c.lastHeartbeatISO ? `<span style="color:#ff4d4d;letter-spacing:2px;font-size:11px">✕ OFFLINE — LAST SEEN ${ukDay(c.lastHeartbeatISO)} ${ukTime(c.lastHeartbeatISO)}</span>` : `<span style="color:#7d8a99;letter-spacing:2px;font-size:11px">○ NOT STARTED YET</span>`;
    const n = (v, u = "", col = "#22e07a") => `<b style="color:${c.online ? col : "#4b5765"}">${c.online && v != null ? v + u : "—"}</b>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">${st}<button class="b sm" data-go="panel-bot">BOT SERVER ▸</button></div>
      <div class="d2-cort"><div>${n(c.pingMs, "ms")}<span>PING</span></div><div>${n(c.cpuPercent, "%")}<span>CPU</span></div><div>${n(c.memoryMb, "MB", "#fff")}<span>MEMORY</span></div><div>${n(c.jobsQueued, "", c.jobsQueued ? "#f59e0b" : "#22e07a")}<span>JOBS QUEUED</span></div></div>
      <div class="d2-lb">DISCORD PING — LAST 24H</div><div class="d2-ch">${vals.map((v) => `<i class="${v == null ? "off" : ""}" style="height:${v == null ? 3 : Math.max(4, Math.round((v / max) * 100))}%;${v > 300 ? "background:#f59e0b" : ""}" title="${v ?? "—"} ms"></i>`).join("")}</div>
      <small class="dim">${c.errors24h ?? 0} ERRORS (24H)${c.version ? ` · v${esc(c.version)}` : ""}${c.supervised ? " · PM2" : ""}</small>`;
  } },
  staff: { t: "♟ STAFF ONLINE", d: "Who's on the Hub or the Terminal now, and how much they use it this week", ico: "♟", g: "STATUS", b: () => {
    // Staff Online v2 (approved mock 2026-11-13): Hub + Terminal only (no Discord / voice). Usage = Cortana's staff_usage log.
    const su = D.su || { usage: {}, hub: [] };
    const hubOn = new Set(su.hub || []);
    const webOn = new Map(onlineNow().map((p) => [p.uid, panelName(p.panel)]));
    const list = D.users.filter((u) => STAFF.has(u.role) && !u.suspended).map((u) => {
      const us = su.usage[u.id] || { weekMins: 0, days: 0, bars: [0, 0, 0, 0, 0, 0, 0], lastISO: "" };
      const hub = hubOn.has(u.id), web = webOn.has(u.id);
      return { u, hub, web, on: hub || web, page: webOn.get(u.id) || "", us };
    });
    const f = window.__stfF || "all", q = (window.__stfQ || "").toLowerCase();
    const shown = list.filter((r) => (f === "all" || (f === "on" && r.on) || (f === "hub" && r.hub) || (f === "web" && r.web) || (f === "off" && !r.on)) && memberName(r.u).toLowerCase().includes(q))
      .sort((a, b) => (b.on - a.on) || (b.us.weekMins - a.us.weekMins) || memberName(a.u).localeCompare(memberName(b.u)));
    const hm = (m) => (m ? (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}m` : `${m}m`) : "—");
    const stale = list.filter((r) => !r.on && (!r.us.lastISO || Date.now() - Date.parse(r.us.lastISO) > 7 * 864e5)).length;
    const total = list.reduce((s, r) => s + r.us.weekMins, 0), top = [...list].sort((a, b) => b.us.weekMins - a.us.weekMins)[0];
    const max = Math.max(60, ...list.flatMap((r) => r.us.bars));
    const chip = (r) => (r.hub && r.web ? '<span class="d2-chip">HUB + WEB</span>' : r.hub ? '<span class="d2-chip">HUB</span>' : r.web ? '<span class="d2-chip" style="color:#f59e0b;border-color:#f59e0b66">TERMINAL</span>' : '<span class="dim">—</span>');
    const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
    return `<div class="d2-skp"><div><small>ON NOW</small><b style="color:#22e07a">${list.filter((r) => r.on).length}</b><span>of ${list.length} staff</span></div><div><small>ON THE HUB</small><b style="color:#00d9ff">${list.filter((r) => r.hub).length}</b><span>app open</span></div>
      <div><small>ON TERMINAL</small><b style="color:#f59e0b">${list.filter((r) => r.web).length}</b><span>website</span></div><div><small>NOT SEEN 7+ DAYS</small><b style="color:#f59e0b">${stale}</b><span>Hub or Terminal</span></div></div>
      <div class="d2-stb">${[["all", "ALL"], ["on", "ON NOW"], ["hub", "HUB"], ["web", "TERMINAL"], ["off", "OFFLINE"]].map(([k, l]) => `<button data-stf="${k}" class="${f === k ? "on" : ""}">${l}</button>`).join("")}<input data-stfq placeholder="⌕ Find staff…" value="${esc(window.__stfQ || "")}" aria-label="Find staff"></div>
      <table class="d2-stt"><thead><tr><th>STAFF</th><th>WHERE NOW</th><th>DOING</th><th>THIS WEEK</th><th style="text-align:right">LAST 7 DAYS</th></tr></thead><tbody>
      ${shown.map((r) => `<tr class="${r.on ? "" : "off"}"><td><div class="d2-stw"><span class="d2-sav">${hexAvatar(r.u, "sm")}${r.on ? '<i class="d2-sd online"></i>' : ""}</span><span><b>${esc(memberName(r.u))}${r.u.id === uid ? ' <small style="display:inline">(YOU)</small>' : ""}</b><small>${esc(ROLE_L[r.u.role] || "")}</small></span></div></td>
        <td>${chip(r)}</td><td class="${r.on ? "" : "dim"}">${r.on ? esc(r.page || (r.hub ? "Hub" : "Terminal")) : r.us.lastISO ? "last seen " + agoTxt(r.us.lastISO) : "not seen yet"}</td>
        <td><b class="d2-stn">${hm(r.us.weekMins)}</b><small class="dim" style="display:block">${r.us.days}/7 days</small></td>
        <td><div class="d2-stbar">${r.us.bars.map((m, i) => `<i class="${m ? "" : "z"}" style="height:${m ? Math.max(4, Math.round((m / max) * 26)) : 3}px" title="${DAYS[i]} · ${hm(m)}"></i>`).join("")}</div></td></tr>`).join("") || `<tr><td colspan="5" class="dim" style="text-align:center;padding:14px">NOBODY HERE.</td></tr>`}
      </tbody></table>
      <small class="dim" style="display:block;margin-top:8px">THIS WEEK: <b style="color:#fff">${hm(total)}</b> TOTAL${top && top.us.weekMins ? ` · MOST ACTIVE: <b style="color:#fff">${esc(memberName(top.u))}</b>` : ""} · AVERAGE <b style="color:#fff">${hm(Math.round(total / Math.max(1, list.length)))}</b> PER STAFF</small>`;
  } },
  online: { t: "● ONLINE NOW", d: "Everyone online now, with hex pictures", ico: "●", g: "UNIT", b: () => {
    const on = onlineNow();
    return on.length ? `<div class="d2-onl">${on.map((p) => { const u = { ...p, ...userOf(p.uid) }; return `<span class="d2-ou">${hexAvatar(u, "sm")}<small>${esc(u.callsign || u.lastName || "")}</small></span>`; }).join("")}</div>${discordLine()}` : empty("NOBODY IN THE TERMINAL.") + discordLine();
  } },
  activity: { t: "☍ RECENT ACTIVITY", d: "Latest changes from the Audit Log", ico: "☍", g: "WORK", acc: "audit", accL: "AUDIT LOG", b: () =>
    D.audit.length ? D.audit.slice(0, 5).map((a) => { const u = auditUser(a); return `<div class="d2-act">${hexAvatar(u.id ? u : { callsign: a.by }, "xs")}<span><b>${esc(u.id ? memberName(u) : a.by || "System")}</b> ${esc(String(a.action || "").toLowerCase())}</span><small>${ukTime(a.createdAtISO || a.createdAt)}</small></div>`; }).join("") : empty("NO ACTIVITY YET.") },
  attendance: { t: "▣ ATTENDANCE TREND", d: "Unit attendance % per month", ico: "▣", g: "UNIT", acc: "att", accL: "ATTENDANCE", b: () => {
    const ms = Array.from({ length: 12 }, (_, i) => monthAtt(11 - i));
    const now = ms[11], prev = ms[10];
    const arrow = now.pct != null && prev.pct != null ? (now.pct >= prev.pct ? " ▲" : " ▼") : "";
    return `<div class="d2-ch" style="height:90px">${ms.map((m) => `<i class="${m.pct == null ? "off" : ""}" style="height:${m.pct ?? 3}%" title="${m.label} ${m.pct ?? "—"}%"></i>`).join("")}</div><small class="dim">${ms[0].label} → ${now.label} · THIS MONTH ${now.pct == null ? "—" : now.pct + "%"}${arrow}</small>`;
  } },
  recruit: { t: "▲ RECRUITMENT", d: "New sign-ups and where they came from", ico: "▲", g: "UNIT", acc: "rstat", accL: "RECRUIT STATS", b: () => {
    const key = new Date().toISOString().slice(0, 7);
    const month = D.users.filter((u) => String(u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : u.createdAt || u.joinedAt || "").startsWith(key)).length;
    const src = {};
    D.users.forEach((u) => u.recruitSource && (src[u.recruitSource] = (src[u.recruitSource] || 0) + 1));
    const tot = Object.values(src).reduce((a, b) => a + b, 0);
    const top = Object.entries(src).sort((a, b) => b[1] - a[1])[0];
    return `<div class="d2-kvr"><span>SIGN-UPS THIS MONTH</span><b>${month}</b></div><div class="d2-kvr"><span>WAITING FOR BCT</span><b style="color:#f59e0b">${pending().length}</b></div><div class="d2-kvr"><span>TOP SOURCE</span><b>${top ? `${esc(top[0])} ${Math.round((top[1] / tot) * 100)}%` : "—"}</b></div>`;
  } },
  tasks: { t: "☷ MY TASKS", d: "Your tasks from the Project Tracker", ico: "☷", g: "WORK", acc: "proj", accL: "PROJECTS", b: () => {
    const ts = D.tasks.filter((x) => x.assignee === uid && x.status !== "done");
    return ts.length ? ts.slice(0, 6).map((x) => `<div class="d2-todo ${x.priority === "high" ? "am" : ""}"><span>${esc(x.title)}</span><span class="dim">${x.due ? "DUE " + ukDay(x.due) : "NO DATE"}</span></div>`).join("") : empty("NO OPEN TASKS FOR YOU.");
  } },
  tickets: { t: "🎫 OPEN TICKETS", d: "Tickets waiting for a reply (Cortana v2)", ico: "🎫", g: "WORK", acc: "tk", accL: "TICKETS", b: () => {
    const open = (D.tickets || []).filter((t) => t.status === "open").sort((a, b) => String(a.openedAtISO).localeCompare(String(b.openedAtISO)));
    const wait = open.filter((t) => t.waiting !== "member").length;
    const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m} MIN` : m < 1440 ? `${Math.round(m / 60)} H` : `${Math.round(m / 1440)} D`; };
    return (open.length ? open.slice(0, 6).map((t) => `<div class="d2-todo ${t.waiting !== "member" ? "am" : ""}"><span>#${String(t.number).padStart(4, "0")} · ${esc(t.typeEmoji || "")} ${esc(t.openerName || "")}</span><span class="dim">${t.waiting !== "member" ? "NEEDS REPLY" : "WAITING ON MEMBER"} · ${ago(t.lastActivityISO || t.openedAtISO)}</span></div>`).join("") : empty("NO OPEN TICKETS."))
      + `<div class="d2-foot"><small class="dim">${open.length} OPEN · ${wait} NEED A REPLY</small><button class="lnk" data-go="panel-tickets">OPEN TICKETS ▸</button></div>`;
  } },
  strength: { t: "▤ ROSTER STRENGTH", d: "Active members by platoon", ico: "▤", g: "UNIT", acc: "roster", accL: "ROSTER", b: () => {
    const c = {};
    active().forEach((u) => { const p = u.platoon || "Unassigned"; c[p] = (c[p] || 0) + 1; });
    const rows = Object.entries(c).sort((a, b) => platoonOrder(a[0]) - platoonOrder(b[0]));
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.length ? rows.map(([p, n]) => `<div class="d2-pl"><span>${esc(p.toUpperCase())}</span><div class="bar"><i style="width:${(n / max) * 100}%"></i></div><b>${n}</b></div>`).join("") + `<div class="d2-foot"><small class="dim">${active().length} ACTIVE IN ${rows.length} PLATOONS</small><button class="lnk" data-go="panel-roster">OPEN ROSTER ▸</button></div>` : empty("NO MEMBERS.");
  } },
  atthealth: { t: "✚ ATTENDANCE HEALTH", d: "Last 90 days — overall %, at risk and never attended", ico: "✚", g: "UNIT", acc: "att", accL: "ATTENDANCE", b: () => {
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const evs = D.att.filter((e) => (e.date || "") >= since);
    if (!evs.length) return empty("NO OPS IN THE LAST 90 DAYS.");
    const mem = active().map((u) => {
      const joined = String(u.joinedAt || u.approvedAt || "").slice(0, 10);
      const elig = evs.filter((e) => !joined || e.date >= joined);
      const went = elig.filter((e) => (e.attendees || []).includes(u.id)).length;
      return { u, elig: elig.length, went, pct: elig.length ? Math.round((went / elig.length) * 100) : null };
    }).filter((m) => m.elig);
    const all = mem.reduce((s, m) => s + m.went, 0), tot = mem.reduce((s, m) => s + m.elig, 0);
    const overall = tot ? Math.round((all / tot) * 100) : 0;
    const below = mem.filter((m) => m.pct < 50), never = mem.filter((m) => m.went === 0), perfect = mem.filter((m) => m.pct === 100);
    return `<div class="d2-kpis"><div class="d2-kpi"><b style="color:${rateColor(overall)}">${overall}%</b><span>OVERALL (90D)</span></div><div class="d2-kpi"><b>${evs.length}</b><span>OPS (90D)</span></div><div class="d2-kpi"><b style="color:#ff4d4d">${below.length}</b><span>BELOW 50%</span></div><div class="d2-kpi"><b style="color:#22e07a">${perfect.length}</b><span>PERFECT</span></div></div>
      ${never.length ? `<div class="d2-lb" style="color:#ff4d4d">⚠ NEVER ATTENDED (${never.length})</div>${never.slice(0, 4).map((m) => `<button class="d2-row" data-go="panel-attendance">${hexAvatar(m.u, "xs")}<b>${esc(memberName(m.u))}</b><small>0 / ${m.elig}</small></button>`).join("")}` : ""}
      <div class="d2-foot"><span></span><button class="lnk" data-go="panel-attendance">OPEN ATTENDANCE ▸</button></div>`;
  } },
  bct: { t: "✚ BCT APPROVALS", d: "Recruits waiting for BCT approval, and how long", ico: "✚", g: "WORK", acc: "bct", accL: "BCT APPROVALS", b: () => {
    const p = pending().sort((a, b) => (toDate(a.createdAt) || 0) - (toDate(b.createdAt) || 0));
    const days = (u) => { const d = toDate(u.createdAt); return d && !isNaN(d) ? Math.floor((Date.now() - d) / 864e5) : null; };
    return (p.length ? p.slice(0, 6).map((u) => { const n = days(u); return `<button class="d2-row" data-go="panel-register">${hexAvatar(u, "xs")}<b>${esc(memberName(u) || u.discordUsername || "Recruit")}</b><span class="d2-tag" style="--c:${n > 7 ? "#ff4d4d" : n > 2 ? "#f59e0b" : "#22e07a"}">${n == null ? "WAITING" : n === 0 ? "TODAY" : n + "D WAITING"}</span></button>`; }).join("") : empty("NOBODY WAITING FOR BCT.")) +
      `<div class="d2-foot"><small class="dim">${p.length} WAITING</small><button class="lnk" data-go="panel-register">OPEN BCT APPROVALS ▸</button></div>`;
  } },
  auditlog: { t: "☍ AUDIT LOG", d: "Live audit log — who did what, by section", ico: "☍", g: "WORK", acc: "audit", accL: "AUDIT LOG", b: () =>
    (D.audit.length ? D.audit.slice(0, 10).map((a) => { const u = auditUser(a); return `<button class="d2-row" data-go="panel-auditv2">${hexAvatar(u.id ? u : { callsign: a.by }, "xs")}<span><b>${esc(u.id ? memberName(u) : a.by || "System")}</b> <small>${esc(String(a.action || ""))}${a.details ? " — " + esc(String(a.details).slice(0, 60)) : ""}</small></span><span style="text-align:right"><span class="d2-tag">${esc(String(a.section || "").toUpperCase())}</span><br><small>${ukDay(a.createdAtISO || a.createdAt)} ${ukTime(a.createdAtISO || a.createdAt)}</small></span></button>`; }).join("") : empty("NO ENTRIES YET.")) +
    `<div class="d2-foot"><span></span><button class="lnk" data-go="panel-auditv2">OPEN AUDIT LOG ▸</button></div>` },
  notes: { t: "✎ NOTES", d: "Latest shared notes — click to open", ico: "✎", g: "WORK", acc: "notes", accL: "NOTES", b: () =>
    (() => { // Notes v2: 📌 pinned, then ⏰ next reminders, then the latest.
      const live = D.notes.filter((n) => !n.arch);
      const remS = (r) => { const d = new Date(r.atISO); return `⏰ ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; };
      const pick = [...live.filter((n) => n.pin), ...live.filter((n) => !n.pin && n.rem && !n.rem.sentISO).sort((a, b) => a.rem.atISO.localeCompare(b.rem.atISO)), ...live.filter((n) => !n.pin && !(n.rem && !n.rem.sentISO))].slice(0, 6);
      return pick.length ? pick.map((n) => `<button class="d2-row" data-note="${n.id}"><span style="color:${esc(n.color || "#00D9FF")}">${n.pin ? "📌" : "✎"}</span><span><b>${esc(n.title || "Untitled")}</b><br><small>${n.rem && !n.rem.sentISO ? `<span style="color:#f59e0b">${remS(n.rem)}</span> · ` : ""}${esc(String(n.text || "").replace(/\s+/g, " ").slice(0, 60))}</small></span><small>${ukDay(n.updatedAtISO)}<br>${esc(n.updatedByName || "")}</small></button>`).join("") : empty("NO NOTES YET.");
    })() +
    `<div class="d2-foot"><small class="dim">${D.notes.filter((n) => !n.arch).length} NOTES</small><button class="lnk" data-go="panel-notes">OPEN NOTES ▸</button></div>` },
  projects: { t: "☷ PROJECT TRACKER", d: "All open projects by column — click to open", ico: "☷", g: "WORK", acc: "proj", accL: "PROJECTS", b: () => {
    const cols = [["todo", "TO DO"], ["doing", "IN PROGRESS"], ["review", "REVIEW"], ["done", "DONE"]];
    const open = D.tasks.filter((x) => x.status !== "done").sort((a, b) => ({ high: 0, med: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, med: 1, low: 2 }[b.priority] ?? 1) || String(a.due || "9").localeCompare(String(b.due || "9")));
    const t = new Date().toISOString().slice(0, 10);
    const pc = { high: "#ff4d4d", med: "#f59e0b", low: "#7d8a99" };
    return `<div class="d2-kan">${cols.map(([k, l]) => `<div><b>${D.tasks.filter((x) => (x.status || "todo") === k).length}</b><span>${l}</span></div>`).join("")}</div>` +
      (open.length ? open.slice(0, 7).map((x) => `<button class="d2-row" data-task="${x.id}"><span class="d2-tag" style="--c:${pc[x.priority] || pc.med}">${String(x.priority || "med").toUpperCase()}</span><span><b>${esc(x.title)}</b><br><small>${esc(x.assigneeName || "UNASSIGNED")} · ${esc(({ todo: "TO DO", doing: "IN PROGRESS", review: "REVIEW" })[x.status || "todo"] || "")}</small></span><small style="${x.due && x.due < t ? "color:#ff4d4d" : ""}">${x.due ? (x.due < t ? "LATE " : "DUE ") + ukDay(x.due) : ""}</small></button>`).join("") : empty("NO OPEN PROJECTS.")) +
      `<div class="d2-foot"><small class="dim">${open.length} OPEN</small><button class="lnk" data-go="panel-projects">OPEN TRACKER ▸</button></div>`;
  } },
  myatt: { t: "◉ MY ATTENDANCE", d: "Your own %, ATT this month, PT, last ops and the next op", ico: "◉", g: "UNIT", b: myAttHtml },
  mystatus: { t: "◐ MY STATUS", d: "Online / Do not disturb / Invisible / Offline — same as the Hub", ico: "◐", g: "STATUS", b: myStatusHtml },
  quick: { t: "⚡ QUICK ACTIONS", d: "Your most used actions in one place", ico: "⚡", g: "WORK", b: quickHtml },
  msgs: { t: "✉ MESSAGES", d: "Unread conversations — click to pop the chat up", ico: "✉", g: "WORK", b: msgsHtml },
  reset: { t: "↻ MONTHLY RESET", d: "Reset status, next date and missed warning", ico: "↻", g: "STATUS", acc: "roster", accL: "ROSTER", b: resetHtml },
  aar: { t: "✦ LATEST AAR", d: "The newest After Action Report", ico: "✦", g: "WORK", b: aarHtml },
};
const DEF = ["kpis", "todo", "quick", "myatt", "ops", "mystatus", "staff", "activity", "system", "cortana"];
const DEF_WIDE = ["kpis", "myatt", "system"];
const V3_ADD = ["myatt", "mystatus", "quick"]; // added once to layouts saved before v3

/* ───────── v3 widgets ───────── */
const SOON = 14 * 864e5;
function myAttHtml() {
  const u = D.me || {};
  const mine = (e) => (e.attendees || []).includes(uid) ? "p" : (e.excused || []).includes(uid) ? "e" : "a";
  const locked = D.att.filter((e) => e.locked).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const pct = u.opsEligible ? Math.round(((u.opsAttended || 0) / u.opsEligible) * 100) : null;
  const att = Math.min(3, u.attendance || 0);
  const st = pct == null ? ["NEW", "#7d8a99"] : pct >= 75 ? ["ON TRACK", "#22e07a"] : pct >= 50 ? ["AT RISK", "#f59e0b"] : ["BELOW 50%", "#ff4d4d"];
  const sym = { p: ['✓', "#22e07a"], e: ["E", "#f59e0b"], a: ["–", "#4b5765"] };
  const next = D.events.filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > Date.now()).sort((a, b) => String(a.startAtISO).localeCompare(String(b.startAtISO)))[0];
  const mySu = next ? (next.signups || []).find((x) => x.uid === uid) : null;
  const myBtn = mySu ? (next.buttons || []).find((b) => b.key === mySu.choice) : null;
  const n = new Date(); const nx = new Date(n.getFullYear(), n.getMonth() + 1, 1);
  return `<div class="d3-ma"><div class="d3-ring" style="--p:${pct ?? 0};--c:${st[1]}"><div><b>${pct == null ? "—" : pct + "%"}</b><small>ALL TIME</small></div></div>
    <div><span class="dim">ATT THIS MONTH</span><div class="d3-pips">${[1, 2, 3].map((k) => `<i class="${att >= k ? "f" : ""}"></i>`).join("")}</div><b class="d3-big">${att} / 3</b><small class="dim" style="display:block">${att >= 3 ? '<span style="color:#22e07a">+1 PT on ' + nx.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase() + "</span>" : `${3 - att} more op${3 - att === 1 ? "" : "s"} → <span style="color:#22e07a">+1 PT</span>`}</small></div>
    <div><span class="dim">PROMOTION TRACKER</span><b class="d3-big" style="color:#ffd166;display:block">${u.promotionTracker || 0} PT</b><small class="dim">OPS ${u.opsAttended || 0} / ${u.opsEligible || 0}${u.lastAttendedDate ? " · LAST " + ukDay(u.lastAttendedDate) : ""}</small><div style="margin-top:6px"><span class="d2-tag" style="--c:${st[1]}">${st[0]}</span></div></div>
    <div class="d3-last"><span class="dim">LAST OPS</span>${locked.slice(0, 5).map((e) => { const [g, c] = sym[mine(e)]; const why = mine(e) === "e" && e.excusedReasons?.[uid] ? ` <small class="dim">"${esc(e.excusedReasons[uid])}"</small>` : ""; return `<div><b style="color:${c}">${g}</b><span>${esc(e.title || "Op")}${why}</span><small class="dim">${ukDay(e.date)}</small></div>`; }).join("") || '<small class="dim">NO LOCKED OPS YET</small>'}
      ${next ? `<div class="d3-next"><span class="dim">NEXT:</span> <b>${esc(next.title)}</b> <small class="dim">${new Date(next.startAtISO).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).toUpperCase()}</small> ${myBtn ? `<span class="d2-tag" style="--c:${myBtn.attending ? "#22e07a" : "#f59e0b"}">YOU: ${esc(String(myBtn.label).toUpperCase())}</span>` : '<span class="d2-tag" style="--c:#7d8a99">NOT SIGNED UP</span>'}</div>` : ""}</div></div>`;
}
function myStatusHtml() {
  const cur = statusOf(D.me, true);
  const s = D.me?.myStatus || {};
  const until = s.untilISO && Date.parse(s.untilISO) > Date.now() ? new Date(s.untilISO).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : null;
  return `<div class="d3-st">${Object.entries(STATES).map(([k, [l, c, g]]) => `<button class="d3-sb ${cur === k ? "on" : ""}" data-st="${k}" style="--c:${c}" aria-pressed="${cur === k}"><span style="color:${c}">${g}</span> ${l.toUpperCase()}</button>`).join("")}</div>
    <div class="d3-stn"><input class="d3-in" id="d3Note" maxlength="60" placeholder="Note (e.g. in briefing)" value="${esc(cur !== "online" ? s.note || "" : "")}" aria-label="Status note"><select class="d3-in" id="d3Until" aria-label="Clear after"><option value="0">DON'T CLEAR</option><option value="60">1 HOUR</option><option value="240">4 HOURS</option><option value="today">TODAY</option></select></div>
    <small class="dim" style="display:block;margin-top:6px">${until ? `CLEARS AT ${until} · ` : ""}DND: NO CHAT POP-UPS · INVISIBLE: YOU LOOK OFFLINE · SHOWS ON STAFF ONLINE, MESSAGES AND THE HUB</small>`;
}
async function setStatus(state) {
  const note = document.getElementById("d3Note")?.value.trim().slice(0, 60) || "";
  const u = document.getElementById("d3Until")?.value || "0";
  let untilISO = null;
  if (state !== "online" && u !== "0") {
    if (u === "today") { const d = new Date(); d.setHours(23, 59, 0, 0); untilISO = d.toISOString(); }
    else untilISO = new Date(Date.now() + Number(u) * 60000).toISOString();
  }
  const myStatus = state === "online" ? { state: "online", note: "", untilISO: null } : { state, note, untilISO, setAtISO: new Date().toISOString() };
  try {
    await updateDoc(doc(db, "users", uid), { myStatus });
    D.me = { ...(D.me || {}), myStatus };
    const i = D.users.findIndex((x) => x.id === uid);
    if (i >= 0) D.users[i] = { ...D.users[i], myStatus };
    updateUsers(D.users);
    paintMe();
    if (!editing) drawW();
    notify(`STATUS: ${STATES[state][0].toUpperCase()}`);
  } catch (e) {
    notify("COULD NOT SAVE STATUS — " + e.message, true);
  }
}
function paintMe() {
  const el = document.getElementById("d2Hex");
  if (!el) return;
  const s = statusOf(D.me, true);
  el.innerHTML = hexAvatar(D.me || {}, "lg") + `<i class="d3-sdot" style="background:${STATES[s][1]}" aria-label="Status: ${STATES[s][0]}"></i>`;
  el.title = `Your status: ${STATES[s][0]} — click to change`;
}
function statusMenu(anchor) {
  document.getElementById("d3SMenu")?.remove();
  const m = document.createElement("div");
  m.id = "d3SMenu";
  m.className = "d3-smenu";
  m.setAttribute("role", "menu");
  const cur = statusOf(D.me, true);
  m.innerHTML = Object.entries(STATES).map(([k, [l, c, g]]) => `<button role="menuitemradio" aria-checked="${cur === k}" data-st="${k}"><span style="color:${c}">${g}</span> ${l}${cur === k ? " ✓" : ""}</button>`).join("");
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = r.left + "px";
  m.style.top = r.bottom + 6 + "px";
  m.querySelector("button").focus();
  m.addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) { m.remove(); setStatus(b.dataset.st); } });
  setTimeout(() => document.addEventListener("click", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", off); } }), 0);
}
const QUICK = [["⚑", "NEW EVENT", "panel-events", "ev"], ["▣", "ATTENDANCE", "panel-attendance", "att"], ["✦", "NEW AAR", "panel-aar", "aar"], ["✉", "MESSAGES", "panel-msg2", null],
  ["★", "ROSTER", "panel-roster", "roster"], ["✎", "PERSONNEL", "panel-active", "pers"], ["⚠", "MODERATION", "panel-moderation", "modw"], ["☍", "AUDIT LOG", "panel-auditv2", "audit"]];
function quickHtml() {
  const list = QUICK.filter(([, , , a]) => !a || acc[a]);
  return `<div class="d3-q">${list.map(([i, l, pnl]) => `<button data-go="${pnl}"><b>${i}</b>${l}</button>`).join("")}</div>`;
}
function msgsHtml() {
  const cv = (D.convs || []).filter((c) => (c.unreadCounts?.[uid] || 0) > 0);
  if (!cv.length) return empty("NO UNREAD MESSAGES.") + '<div class="d2-foot"><span></span><button class="lnk" data-go="panel-msg2">OPEN MESSAGES ▸</button></div>';
  return cv.slice(0, 5).map((c) => { const o = (c.participants || []).filter((p) => p !== uid); const u = o.length === 1 ? userOf(o[0]) : { callsign: c.name || "Group" }; return `<button class="d2-row" data-pop="${esc(c.id)}">${hexAvatar(u, "xs")}<span><b>${esc(c.name || (o.length === 1 ? memberName(u) : "Group"))}</b><br><small>${esc(String(c.lastMessage || "").slice(0, 60))}</small></span><span class="d2-tag" style="--c:#00D9FF">${c.unreadCounts[uid]}</span></button>`; }).join("");
}
function resetHtml() {
  const r = D.reset || {};
  const cur = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }).slice(0, 7);
  const n = new Date(); const nx = new Date(n.getFullYear(), n.getMonth() + 1, 1);
  const days = Math.ceil((nx - n) / 864e5);
  const done = (r.lastAttendanceReset || "") >= cur;
  return `${done ? `<b style="color:#22e07a">✓ ${new Date(cur + "-15").toLocaleDateString("en-GB", { month: "long" }).toUpperCase()} RESET DONE</b><small class="dim" style="display:block">${r.lastResetAt ? ukDay(r.lastResetAt) + " " + ukTime(r.lastResetAt) : ""}${r.lastResetBy ? " · " + esc(r.lastResetBy) : ""}${r.lastResetPromoted != null ? " · " + r.lastResetPromoted + " GOT +1 PT" : ""}</small>` : `<b style="color:#ff4d4d">⚠ THIS MONTH'S RESET HAS NOT RUN</b><small class="dim" style="display:block">CORTANA MAY HAVE BEEN OFFLINE — RUN IT FROM THE ROSTER</small>`}
    <div class="d2-foot"><small class="dim">NEXT: 01 ${nx.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()} · IN ${days} DAY${days === 1 ? "" : "S"}</small><button class="lnk" data-go="panel-roster">ROSTER ▸</button></div>`;
}
function aarHtml() {
  const a = D.aar;
  if (!a) return empty("NO AARS YET.");
  const R = { success: ["✓ SUCCESS", "#22e07a"], partial: ["◐ PARTIAL", "#f5c518"], failure: ["✕ FAILED", "#ff4d4d"] }[a.result] || ["—", "#7d8a99"];
  const objs = Array.isArray(a.objectives) ? a.objectives : [];
  return `<b style="color:#fff;font-family:Rajdhani,sans-serif;font-size:16px">${esc(a.title || "AAR")}</b> <span class="d2-tag" style="--c:${R[1]}">${R[0]}</span>
    <small class="dim" style="display:block">${a.date ? ukDay(a.date) : ""}${objs.length ? ` · ${objs.filter((o) => o.done).length}/${objs.length} OBJECTIVES` : ""}${a.filedBy ? " · " + esc(a.filedBy) : ""}</small>
    <p class="d2-p" style="margin-top:6px">${esc(String(a.summary || "").slice(0, 180))}</p><div class="d2-foot"><span></span><button class="lnk" data-go="panel-aar">OPEN AARS ▸</button></div>`;
}
const allowed = (k) => !!WID[k] && (!WID[k].acc || acc[WID[k].acc]);

window.addEventListener("bell:unread", () => { try { hello(); if (!editing && L.includes("todo")) drawW(); } catch { /* dashboard not ready yet */ } });
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-bell]")) document.getElementById("tb2Bell")?.click(); });
// Staff Online v2: filter tabs + search, and fresh usage every minute.
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-stf]"); if (b) { window.__stfF = b.dataset.stf; drawW(); } });
document.addEventListener("input", (e) => { if (e.target.matches?.("[data-stfq]")) { window.__stfQ = e.target.value; const p = e.target.selectionStart; drawW(); const i = document.querySelector("[data-stfq]"); if (i) { i.focus(); i.setSelectionRange(p, p); } } });
setInterval(() => { fetch("/api/terminal/staff-usage", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((x) => { if (x) { D.su = x; if (!editing) drawW(); } }).catch(() => {}); }, 60_000);
function needsList() {
  const out = [];
  // 🔔 Unread alerts from the bell (message alerts are counted from the chats below, so nothing is counted twice).
  const bell = Number(window.__bellUnread) || 0;
  if (bell > 0) out.push([`${bell} unread alert${bell === 1 ? "" : "s"} in 🔔`, "bell", 1]);
  // Unread direct / group messages (everyone) — was missing, so the bell could show a message while this said "nothing needs you".
  const um = (D.convs || []).filter((c) => (c.unreadCounts?.[uid] || 0) > 0);
  if (um.length) { const n = um.reduce((a, c) => a + (c.unreadCounts[uid] || 0), 0); out.push([`${n} unread message${n === 1 ? "" : "s"}`, "panel-msg2", 1]); }
  // Tickets waiting for a staff reply.
  if (acc.tk) { const w = (D.tickets || []).filter((x) => x.status === "open" && x.waiting === "staff").length; if (w) out.push([`${w} ticket${w === 1 ? "" : "s"} waiting for a staff reply`, "panel-tickets", 1]); }
  const p = pending().length;
  if (acc.bct && p) out.push([`${p} recruit${p === 1 ? "" : "s"} waiting for BCT approval`, "panel-register", 1]);
  const t = new Date().toISOString().slice(0, 10);
  if (acc.att) D.att.filter((e) => !e.locked && (e.date || "") <= t && (e.date || "") >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).forEach((e) => out.push([`${esc(e.title || "Op")} attendance not locked yet`, "panel-attendance", 0]));
  if (acc.proj) D.tasks.filter((x) => x.assignee === uid && x.status !== "done" && x.due && x.due <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).forEach((x) => out.push([`Task "${esc(x.title)}" ${x.due < t ? "is late" : "due " + ukDay(x.due)}`, "panel-projects", x.due < t ? 1 : 0]));
  return out;
}

/* ───────── layout ───────── */
async function save() {
  try {
    await updateDoc(doc(db, "users", uid), { dashLayout: { order: L, wide: [...WIDE], v3: true } });
  } catch {
    notify("COULD NOT SAVE YOUR LAYOUT", true);
  }
}
/** Live op card (approved mock 2026-11-11): shown at the top while an op is running. */
function liveOpHtml() {
  const now = Date.now();
  const lv = (D.events || []).filter((e) => e.status !== "cancelled" && e.status !== "completed" && !e.discord?.closedAtISO && Date.parse(e.startAtISO) <= now && Date.parse(e.endAtISO) > now);
  return lv.map((e) => {
    const cnt = (e.buttons || []).map((b) => [b, (e.signups || []).filter((x) => !x.waiting && x.choice === b.key).length]);
    const going = cnt.filter(([b]) => b.attending).reduce((a, [, n]) => a + n, 0);
    const close = Math.min(Date.parse(e.startAtISO) + 30 * 60000, Date.parse(e.endAtISO));
    const pct = Math.max(0, Math.min(100, ((now - Date.parse(e.startAtISO)) / (Date.parse(e.endAtISO) - Date.parse(e.startAtISO))) * 100));
    return `<section class="d2-w wide d2-liveop" aria-label="Live operation"><div><span class="d2-lv"><i></i>LIVE</span><b>${esc(e.title || "Op")}</b><div class="d2-lvbar" aria-hidden="true"><i style="width:${pct}%"></i></div><small class="dim">${cnt.map(([b, n]) => `${n} ${esc(b.label.toLowerCase())}`).join(" · ")}${now < close ? ` · locks ${new Date(close).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}` : ""}${going ? "" : ""}</small></div><button class="b" data-liveop="${esc(e.id)}">OPEN LIVE STATUS ▸</button></section>`;
  }).join("");
}

function drawW() {
  const g = document.getElementById("d2Grid");
  const shown = L.filter(allowed);
  g.innerHTML = liveOpHtml() + shown.map((k) => {
    const w = WID[k];
    let body = "";
    try { body = w.b(); } catch (e) { body = empty("NOT AVAILABLE."); }
    return `<section class="d2-w ${WIDE.has(k) ? "wide" : ""}" draggable="${editing}" data-k="${k}" aria-label="${esc(w.t.replace(/^\S+\s/, ""))}"><div class="d2-wh"><span>${w.t}</span><span class="d2-wt"><button class="hd" title="Drag to move" aria-label="Move">⠿</button><button data-a="wide" title="Wide / narrow" aria-label="Wide or narrow">⇔</button><button class="rm" data-a="rm" title="Remove" aria-label="Remove">✕</button></span></div>${body}</section>`;
  }).join("") || `<div class="d2-w wide"><p class="dim">EMPTY — CLICK ✎ CUSTOMISE → + ADD WIDGET</p></div>`;
  g.classList.toggle("d2-editing", editing);
}
function cust(on) {
  editing = on;
  document.getElementById("d2Cust").classList.toggle("on", on);
  document.getElementById("d2CustBtn").style.display = on ? "none" : "";
  if (!on) drawer(false);
  drawW();
}
function drawer(on) {
  document.getElementById("d2Drawer").hidden = !on;
  if (on) drawCat();
}
function drawCat() {
  document.getElementById("d2Cat").innerHTML = ["STATUS", "UNIT", "WORK"].map((grp) => {
    const ks = Object.keys(WID).filter((k) => WID[k].g === grp && allowed(k));
    if (!ks.length) return "";
    return `<div class="d2-ch2">${grp}</div>` + ks.map((k) => {
      const w = WID[k], on = L.includes(k);
      let pv = "";
      try { pv = w.b(); } catch { pv = ""; }
      return `<div class="d2-ci ${on ? "on" : ""}"><div class="d3-pv" aria-hidden="true"><div>${pv}</div></div><span class="ico">${w.ico}</span><span><b>${w.t.replace(/^\S+\s/, "")}</b><small>${w.d}</small>${w.accL ? `<div class="lock">NEEDS: ${w.accL}</div>` : ""}</span>${on ? '<span class="dim">ADDED</span>' : `<button class="b sm gold" data-add="${k}">+ ADD</button>`}</div>`;
    }).join("");
  }).join("");
}

/* ───────── data ───────── */
async function timed(fn) { const t = performance.now(); await fn(); return Math.round(performance.now() - t); }
async function load() {
  const safe = (p, f) => p.then(f).catch(() => {});
  await Promise.all([
    safe(getUsers(), (u) => (D.users = u)),
    safe(getDocs(query(collection(db, "fragos"), orderBy("createdAt", "desc"), limit(5))), (s) => {
      const role = D.me?.role || "";
      D.fragos = s.docs.map((d) => d.data()).find((f) => !(f.visibility === "commander_only" && !["commander", "developer"].includes(role)) && !(f.visibility === "officers_only" && !["commander", "developer", "officer"].includes(role))) || null;
    }),
    safe(getDocs(collection(db, "community_events")), (s) => (D.events = s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    safe(getDocs(collection(db, "attendance_events")), (s) => (D.att = s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    safe(getDoc(doc(db, "settings", "roster_meta")), (s) => (D.reset = s.data() || {})),
    safe(getDocs(query(collection(db, "aars"), orderBy("submittedAt", "desc"), limit(5))), (s) => (D.aar = s.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => a.status !== "draft") || null)),
    acc.proj ? safe(getDocs(collection(db, "projects")), (s) => (D.tasks = s.docs.map((d) => ({ id: d.id, ...d.data() })))) : null,
    acc.notes ? safe(fetch("/api/terminal/notes", { cache: "no-store" }).then((r) => r.json()), (j) => (D.notes = j.notes || [])) : null,
    acc.audit ? safe(getDocs(query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(12))), (s) => (D.audit = s.docs.map((d) => d.data()))) : null,
    safe(getDocs(collection(db, "presence_sessions")), (s) => (D.pres = s.docs.map((d) => d.data()))),
    safe(getDoc(doc(db, "unit_config", "status")), (s) => (D.status = s.data() || {})),
    safe(cortanaStatus(), (c) => (D.cortana = c)),
    safe(fetch("/api/terminal/hub-status", { cache: "no-store" }).then((r) => r.json()), (h) => (D.hub = h)),
    safe(getDoc(doc(db, "bot_status", "monitors")), (s) => (D.mon = s.data() || null)),
    safe(getDoc(doc(db, "bot_status", "discord_live")), (s) => (D.dl = s.data() || null)),
    safe(getDoc(doc(db, "bot_status", "staff_presence")), (s) => (D.sp = s.data() || null)),
    safe(fetch("/api/terminal/staff-usage", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)), (x) => (D.su = x)),
    acc.tk ? safe(getDocs(collection(db, "tickets")), (s) => (D.tickets = s.docs.map((d) => { const x = d.data(); return { number: x.number, status: x.status, typeEmoji: x.typeEmoji, openerName: x.openerName, waiting: x.waiting, openedAtISO: x.openedAtISO, lastActivityISO: x.lastActivityISO }; }))) : null,
  ]);
  D.ping.web = await timed(() => fetch("/api/terminal/access", { cache: "no-store" }).then((r) => { if (!r.ok) throw 0; })).catch(() => ((D.ping.webErr = 1), null));
  D.ping.db = await timed(() => getDoc(doc(db, "unit_config", "status"))).catch(() => ((D.ping.dbErr = 1), null));
  // Cloudinary = where gallery / event / Quick Upload images live. Checks its image servers answer.
  D.ping.cdn = await timed(() => fetch("https://res.cloudinary.com/demo/image/upload/w_1,h_1/sample.jpg", { mode: "no-cors", cache: "no-store" })).catch(() => ((D.ping.cdnErr = 1), null));
}

/* ───────── welcome bar ───────── */
function hello() {
  const n = new Date();
  const h = Number(n.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  const part = h < 5 || h >= 18 ? "EVENING" : h < 12 ? "MORNING" : "AFTERNOON";
  const name = String(D.me?.callsign || D.me?.firstName || "").toUpperCase();
  document.getElementById("d2Hello").textContent = `GOOD ${part}${name ? ", " + name : ""}`;
  const day = n.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/London" }).toUpperCase().replace(",", "");
  const time = n.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const k = needsList().length;
  const nxt = (D.events || []).filter((e) => e.status !== "cancelled" && Date.parse(e.startAtISO) > Date.now()).sort((a, b) => String(a.startAtISO).localeCompare(String(b.startAtISO)))[0];
  const c0 = D.cortana || {};
  const light = (n, ok) => `<span class="d3-li" style="color:${ok === true ? "#22e07a" : ok === false ? "#ff4d4d" : "#4b5765"}" title="${n}: ${ok === true ? "online" : ok === false ? "down" : "not running"}"><i></i>${n}</span>`;
  document.getElementById("d2Sub").innerHTML = `${esc(day)} · ${time} UK
    <div class="d3-pills">${nxt ? `<span>NEXT EVENT <b>${esc(String(nxt.title).toUpperCase())} · ${new Date(nxt.startAtISO).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).toUpperCase()}</b></span>` : ""}<span>YOUR ATT <b>${Math.min(3, D.me?.attendance || 0)}/3</b></span><span>PT <b>${D.me?.promotionTracker || 0}</b></span>${k ? `<span class="hot"><b>${k}</b> NEED${k === 1 ? "S" : ""} YOU</span>` : "<span>NOTHING NEEDS YOU</span>"}</div>
    <div class="d3-lights">${light("WEBSITE", D.ping.web != null ? true : D.ping.webErr ? false : null)}${light("DATABASE", D.ping.db != null ? true : D.ping.dbErr ? false : null)}${light("CORTANA", c0.online ? true : c0.lastHeartbeatISO ? false : null)}${light("HUB", D.hub?.released ? true : null)}</div>`;
  paintMe();
  const [l, c] = OPS[D.status.opStatus] || ["NOT SET", "#7d8a99"];
  const open = D.status.recruitmentOpen !== false;
  document.getElementById("d2Unit").innerHTML = `<b style="color:${c}">◉ ${l}</b><small style="color:${open ? "#22e07a" : "#ff4d4d"}">${open ? "● RECRUITING" : "○ RECRUITMENT CLOSED"}</small>`;
}

function mount() {
  const panel = document.getElementById("panel-dashboard");
  if (!panel || document.getElementById("dash2")) return;
  const root = document.createElement("div");
  root.id = "dash2";
  root.innerHTML = `<div class="d3-shell"><div class="d3-main">
    <div class="d2-welcome"><span id="d2Hex" class="d3-me" role="button" tabindex="0" title="Your status — click to change"></span><div><div class="d2-hi" id="d2Hello">WELCOME</div><div class="dim" id="d2Sub"></div></div><div class="d2-unit" id="d2Unit"></div><button class="b" id="d2CustBtn" style="margin-left:14px">✎ CUSTOMISE</button></div>
    <div class="d2-custbar" id="d2Cust"><b>✎ CUSTOMISING YOUR DASHBOARD</b><span class="dim">DRAG ⠿ TO MOVE · ⇔ WIDE / NARROW · ✕ REMOVE · ONLY YOU SEE YOUR LAYOUT</span><span style="flex:1"></span><button class="b" id="d2Reset">↺ RESET TO DEFAULT</button><button class="b" id="d2Add">+ ADD WIDGET</button><button class="b gold" id="d2Done">DONE</button></div>
    <div class="d2-grid" id="d2Grid"></div>
    <p class="d2-hint">Widgets only appear in the list if you have access to them. Your layout is saved to your account, so it follows you to any device.</p></div></div>`;
  panel.appendChild(root);
  mountDock(root.querySelector(".d3-shell"));
  root.querySelector("#d2Hex").addEventListener("click", () => statusMenu(root.querySelector("#d2Hex")));
  root.querySelector("#d2Hex").addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), statusMenu(root.querySelector("#d2Hex"))));
  document.body.insertAdjacentHTML("beforeend", `<aside class="d2-drawer" id="d2Drawer" hidden aria-label="Add widget"><div class="d2-dh"><b>ADD WIDGET</b><button class="b sm" id="d2DrClose" aria-label="Close">✕</button></div><div id="d2Cat"></div></aside>`);

  document.getElementById("d2CustBtn").onclick = () => cust(true);
  document.getElementById("d2Done").onclick = () => { cust(false); save(); notify("✓ DASHBOARD SAVED"); };
  document.getElementById("d2Add").onclick = () => drawer(true);
  document.getElementById("d2DrClose").onclick = () => drawer(false);
  document.getElementById("d2Reset").onclick = () => { L = [...DEF]; WIDE = new Set(DEF_WIDE); drawW(); drawCat(); save(); };
  document.getElementById("d2Cat").onclick = (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    L.unshift(b.dataset.add);
    drawW(); drawCat(); save();
    notify("✓ ADDED");
  };
  const g = document.getElementById("d2Grid");
  g.addEventListener("click", (e) => {
    const nt = e.target.closest("[data-note]"), tk = e.target.closest("[data-task]");
    if (!editing && (nt || tk)) return window.dispatchEvent(new CustomEvent("ws:open", { detail: nt ? { kind: "note", id: nt.dataset.note } : { kind: "task", id: tk.dataset.task } }));
    const lo = e.target.closest("[data-liveop]");
    if (lo && !editing) { try { sessionStorage.setItem("evOpenLive", lo.dataset.liveop); } catch { /* blocked */ } return go("panel-events"); }
    const go1 = e.target.closest("[data-go]");
    if (go1 && !editing) return go(go1.dataset.go);
    const st = e.target.closest("[data-st]");
    if (st && !editing) return setStatus(st.dataset.st);
    const pp = e.target.closest("[data-pop]");
    if (pp && !editing) return openPop(pp.dataset.pop);
    const b = e.target.closest(".d2-wt button[data-a]");
    if (!b) return;
    const k = b.closest(".d2-w").dataset.k;
    if (b.dataset.a === "rm") L = L.filter((x) => x !== k);
    else WIDE.has(k) ? WIDE.delete(k) : WIDE.add(k);
    drawW(); save();
    if (!document.getElementById("d2Drawer").hidden) drawCat();
  });
  let dragK = null;
  g.addEventListener("dragstart", (e) => { const w = e.target.closest(".d2-w"); if (!editing || !w) return; dragK = w.dataset.k; w.classList.add("dragging"); });
  g.addEventListener("dragend", () => g.querySelectorAll(".d2-w").forEach((w) => w.classList.remove("dragging", "over")));
  g.addEventListener("dragover", (e) => { const w = e.target.closest(".d2-w"); if (!editing || !w) return; e.preventDefault(); g.querySelectorAll(".over").forEach((x) => x !== w && x.classList.remove("over")); w.classList.add("over"); });
  g.addEventListener("drop", (e) => {
    const w = e.target.closest(".d2-w");
    if (!w || !dragK) return;
    e.preventDefault();
    const to = L.indexOf(w.dataset.k);
    L = L.filter((k) => k !== dragK);
    L.splice(to, 0, dragK);
    dragK = null;
    drawW(); save();
  });
}

async function refresh() {
  await load();
  const mine = D.users.find((x) => x.id === uid);
  if (mine) D.me = { ...(D.me || {}), ...mine };
  startDock(uid, D.me, D.users);
  updateUsers(D.users);
  hello();
  if (!editing) drawW();
}

onReady(() => {
  onAuthStateChanged(auth, (u) => {
    if (!u || uid) return;
    uid = u.uid;
    onAccess(async (me) => {
      acc = me.access || {};
      D.me = await getMe().catch(() => null);
      const s = D.me?.dashLayout;
      if (s && Array.isArray(s.order)) {
        L = s.order.filter((k) => WID[k]); WIDE = new Set((s.wide || []).filter((k) => WID[k]));
        if (!s.v3) { V3_ADD.slice().reverse().forEach((k) => !L.includes(k) && L.unshift(k)); WIDE.add("myatt"); save(); }
      }
      else { L = [...DEF]; WIDE = new Set(DEF_WIDE); }
      mount();
      document.getElementById("d2Hex").innerHTML = hexAvatar(D.me || {}, "lg");
      drawW();
      await refresh();
      setInterval(() => (document.getElementById("panel-dashboard")?.classList.contains("hidden") ? hello() : refresh()), 60000);
      // Online Now / Staff Online update live (instant updates), not once a minute.
      let seen = null;
      onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", uid)), (s) => { D.convs = s.docs.map((d) => ({ id: d.id, ...d.data() })); hello(); if (!editing && (L.includes("msgs") || L.includes("todo"))) drawW(); }, () => {});
      const dp = document.getElementById("panel-dashboard");
      if (dp) new MutationObserver(refreshPopPosition).observe(dp, { attributes: true, attributeFilter: ["class"] });
      onSnapshot(collection(db, "presence_sessions"), (s) => {
        D.pres = s.docs.map((d) => d.data());
        // Sign-in pop-up when ANOTHER staff member opens the terminal (like RCD). Not on the first load.
        const now = new Set(D.pres.map((p) => p.uid));
        // (2026-11-13: the old "staff signed in" pop-up for everyone is gone — only the owner gets staff alerts, from Cortana.)
        seen = now;
        if (!editing) drawW();
      }, () => {});
      onSnapshot(collection(db, "community_events"), (s) => { D.events = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (!editing) drawW(); }, () => {});
      onSnapshot(doc(db, "bot_status", "staff_presence"), (s) => { D.sp = s.data() || null; if (!editing) drawW(); }, () => {});
      onSnapshot(doc(db, "bot_status", "discord_live"), (s) => { D.dl = s.data() || null; if (!editing) drawW(); }, () => {});
    });
  });
});
