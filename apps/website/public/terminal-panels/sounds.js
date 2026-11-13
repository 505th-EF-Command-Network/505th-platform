/**
 * 🔊 ALERT SOUNDS on the website (approved mock 2026-11-13). Settings: Profile → PHONE & SOUNDS (users.soundPrefs).
 * Off by default. Every sound also shows a caption at the bottom of the screen.
 */
const SOUNDS = { radio: [[1200, 0.08], [0, 0.05], [1200, 0.08]], unsc: [[660, 0.15], [880, 0.15], [660, 0.15]], chime: [[880, 0.3], [1320, 0.4]], ping: [[1500, 0.12]], klaxon: [[440, 0.25], [330, 0.25], [440, 0.25], [330, 0.25]] };
const NAMES = { radio: "Radio beep", unsc: "UNSC alert", chime: "Soft chime", ping: "Ping", klaxon: "Klaxon" };
let prefs = null;
fetch("/api/me/push", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => { prefs = d?.sounds || null; }).catch(() => {});

export function kindOf(type, title) {
  const t = `${type} ${title}`.toLowerCase();
  if (type === "staff_online") return "staff";
  if (/tagged|mention/.test(t)) return "tag";
  if (/message|\bdm\b|chat/.test(type)) return "message";
  if (/ticket/.test(t)) return "ticket";
  if (/note|reminder/.test(t)) return "note";
  if (/offline|outage|down\b|network status/.test(t)) return "net";
  if (/project|task/.test(t)) return "project";
  if (/bct|recruit|register/.test(t)) return "bct";
  if (/starting|in \d+ min/.test(t)) return "op";
  if (/event|rsvp|operation/.test(t)) return "event";
  return "rank";
}
function caption(text) {
  let el = document.getElementById("snd505cap");
  if (!el) { el = document.createElement("div"); el.id = "snd505cap"; el.setAttribute("aria-live", "polite"); el.style.cssText = "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;border:1px solid #00d9ff;background:rgba(0,0,0,.88);color:#fff;padding:6px 12px;font:12px 'Share Tech Mono',monospace;pointer-events:none"; document.body.appendChild(el); }
  el.textContent = text; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 3000);
}
/** Play the sound picked for this alert kind (if sounds are on). */
export function alertSound(kind, title) {
  if (!prefs?.on) return;
  const id = prefs.map?.[kind] || "chime";
  if (id === "none") return;
  const vol = (prefs.vol ?? 70) / 100, mine = (prefs.mine || []).find((m) => m.id === id);
  if (mine) { const a = new Audio(mine.url); a.volume = vol; a.play().catch(() => {}); }
  else {
    try {
      const A = new AudioContext(); A.resume();
      let t = A.currentTime + 0.03;
      for (const [f, d] of SOUNDS[id] || SOUNDS.chime) { if (f) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.25 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + d); } t += d; }
      setTimeout(() => A.close(), (t - A.currentTime) * 1000 + 300);
    } catch { /* no audio */ }
  }
  caption(`🔊 ${mine ? mine.name : NAMES[id] || "Sound"}: ${title}`);
}
