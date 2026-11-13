"use client";

import { useEffect, useState } from "react";

/**
 * 📱 PHONE ALERTS + 🔊 ALERT SOUNDS (approved mock 2026-11-13). Profile → PHONE & SOUNDS.
 * Phone alerts = web push (iPhone: Home Screen app, iOS 16.4+ · Android: Chrome). Cortana sends them.
 * Sounds play on the website (and are separate from the Hub's own sound settings).
 */
type Prefs = { ev: Record<string, boolean>; quiet: "off" | "night" | "custom"; from: string; to: string; letOps: boolean; preview: boolean; badge: boolean; skipHub: boolean };
type Sounds = { on: boolean; vol: number; map: Record<string, string>; mine: { id: string; name: string; url: string }[] };
type Phone = { id: string; name: string; enabled: boolean; createdISO: string; lastISO: string };
type Data = { publicKey: string; phones: Phone[]; prefs: Prefs; sounds: Sounds };

export const EVENTS: [string, string, string, string][] = [
  ["message", "💬", "Direct messages", "Someone messages you"], ["tag", "@", "Tagged / mentioned", "Projects, chats"], ["op", "⚑", "Event starting soon", "Before an event starts"],
  ["event", "📅", "New event posted", "Ops, training, game nights, fun ops"], ["ticket", "🎫", "Ticket waiting on staff", "New or waiting reply"], ["bct", "✚", "Recruit waiting for BCT", "Recruiters+"],
  ["project", "☷", "Project tasks", "Invites, tasks, overdue"], ["rank", "★", "My rank / medals / account", "Promotions, ribbons"], ["note", "📝", "Note reminders", "Your ⏰ reminders"],
  ["net", "📡", "Network Status", "Cortana / website down"], ["staff", "🖥", "Staff opened Hub / Terminal", "Owner only"],
];
export const SOUNDS: [string, string, [number, number][]][] = [
  ["radio", "Radio beep", [[1200, 0.08], [0, 0.05], [1200, 0.08]]], ["unsc", "UNSC alert", [[660, 0.15], [880, 0.15], [660, 0.15]]], ["chime", "Soft chime", [[880, 0.3], [1320, 0.4]]],
  ["ping", "Ping", [[1500, 0.12]]], ["klaxon", "Klaxon (ops)", [[440, 0.25], [330, 0.25], [440, 0.25], [330, 0.25]]],
];
export function playSound(id: string, vol: number, mine: Sounds["mine"] = []) {
  if (id === "none") return;
  const m = mine.find((x) => x.id === id);
  if (m) { const a = new Audio(m.url); a.volume = vol / 100; void a.play().catch(() => {}); return; }
  const s = SOUNDS.find((x) => x[0] === id) ?? SOUNDS[2]!;
  try {
    const A = new AudioContext(); void A.resume();
    let t = A.currentTime + 0.02;
    for (const [f, d] of s[2]) {
      if (f) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.25 * (vol / 100), t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + d); }
      t += d;
    }
    setTimeout(() => void A.close(), (t - A.currentTime) * 1000 + 300);
  } catch { /* no audio */ }
}

const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
const phoneName = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows PC" : /Mac/.test(u) ? "Mac" : "Phone"; };
const ago = (iso: string) => { if (!iso) return "never"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

async function api(body?: Record<string, unknown>) {
  const r = await fetch("/api/me/push", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

function Sw({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`pa-sw${on ? " on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}

export default function PhoneAlerts({ canUpload }: { canUpload: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const [mineId, setMineId] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>("default");
  const [cap, setCap] = useState("");
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const standalone = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  const load = async () => { try { setD(await api()); } catch (e) { setMsg([(e as Error).message, false]); } };
  useEffect(() => {
    void load();
    if (supported) { setPerm(Notification.permission); void navigator.serviceWorker.getRegistration("/").then(async (r) => { const s = await r?.pushManager.getSubscription(); if (s) setMineId(await idOf(s.endpoint)); }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const idOf = async (endpoint: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint))), (x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const flash = (t: string, ok = true) => { setMsg([t, ok]); setTimeout(() => setMsg(null), 4000); };

  const turnOn = async () => {
    if (!d?.publicKey) return flash("Phone alerts aren't set up on the server yet.", false);
    try {
      const p = await Notification.requestPermission(); setPerm(p);
      if (p !== "granted") return flash("Alerts are blocked — allow notifications for 505th in your phone settings.", false);
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(d.publicKey) }));
      const r = await api({ action: "subscribe", sub: sub.toJSON(), name: phoneName() });
      setMineId(r.id); flash(r.msg); void load();
    } catch (e) { flash((e as Error).message, false); }
  };
  const turnOff = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const s = await reg?.pushManager.getSubscription();
      if (mineId) await api({ action: "remove", id: mineId });
      await s?.unsubscribe(); setMineId(null); flash("Phone alerts off for this phone"); void load();
    } catch (e) { flash((e as Error).message, false); }
  };
  const savePrefs = async (prefs: Prefs) => { if (!d) return; setD({ ...d, prefs }); try { await api({ action: "prefs", prefs }); } catch (e) { flash((e as Error).message, false); } };
  const saveSounds = async (sounds: Sounds) => { if (!d) return; setD({ ...d, sounds }); try { await api({ action: "sounds", sounds }); } catch (e) { flash((e as Error).message, false); } };
  const play = (id: string, label: string) => { if (!d) return; playSound(id, d.sounds.vol, d.sounds.mine); setCap(`🔊 Sound: ${label}`); setTimeout(() => setCap(""), 2500); };
  const upload = async (f: File) => {
    if (!d) return;
    if (!/^audio\//.test(f.type)) return flash("Audio files only (MP3, WAV)", false);
    if (f.size > 1_000_000) return flash("Too big — 1 MB max", false);
    try {
      const sr = await fetch("/api/terminal/upload-sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder: "505th_sounds" }) });
      const s = await sr.json(); if (!sr.ok) throw new Error(s.error || "Upload not allowed");
      const fd = new FormData(); fd.append("file", f); fd.append("api_key", s.apiKey); fd.append("timestamp", String(s.timestamp)); fd.append("folder", s.folder); fd.append("signature", s.signature);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/video/upload`, { method: "POST", body: fd }); const j = await r.json();
      if (!r.ok || !j.secure_url) throw new Error(j.error?.message || "Upload failed");
      if (Number(j.duration) > 5.5) return flash("Too long — 5 seconds max", false);
      await saveSounds({ ...d.sounds, mine: [...d.sounds.mine, { id: `my${Date.now().toString(36)}`, name: f.name.replace(/\.[^.]+$/, "").slice(0, 30), url: j.secure_url }].slice(-8) });
      flash("Sound added");
    } catch (e) { flash((e as Error).message, false); }
  };

  if (!d) return <div className="pv-cd"><div className="pv-ch">PHONE ALERTS</div><p className="pv-hint">{msg ? msg[0] : "Loading…"}</p></div>;
  const P = d.prefs, S = d.sounds, on = !!mineId && perm === "granted";
  const opts = [...SOUNDS.map(([id, l]) => [id, l] as [string, string]), ...S.mine.map((m) => [m.id, `🎵 ${m.name}`] as [string, string]), ["none", "— None"] as [string, string]];
  return (
    <div className="pa">
      {msg && <p role="status" className={`pa-msg${msg[1] ? "" : " bad"}`}>{msg[0]}</p>}
      <div className="pv-cd"><div className="pv-ch">📱 THIS PHONE</div>
        <div className="pa-big"><div className={`pa-st${on ? "" : " off"}`}>{on ? "✓" : "✕"}</div>
          <div style={{ flex: 1 }}><b>{on ? "On for this phone" : "Off for this phone"}</b><small>{phoneName()}{standalone ? " · Home Screen app" : ""}</small></div></div>
        {!supported ? <p className="pv-hint">{ios && !standalone ? "On iPhone: tap Share → Add to Home Screen, then open 505th from the Home Screen and come back here (iOS 16.4+)." : "This browser can't get phone alerts. Use Chrome on Android, or the Home Screen app on iPhone."}</p>
          : <div className="pv-act">{on ? <><button className="pv-b gold" onClick={() => void api({ action: "test" }).then((r) => flash(r.msg)).catch((e) => flash(e.message, false))}>▶ SEND TEST</button><button className="pv-b red" onClick={() => void turnOff()}>TURN OFF</button></>
            : <button className="pv-b gold" onClick={() => void turnOn()}>🔔 TURN ON PHONE ALERTS</button>}</div>}
        {perm === "denied" && <p className="pv-hint" style={{ color: "#ff9f1c" }}>Notifications are blocked for 505th. Turn them on in your phone's Settings → Notifications → 505th.</p>}
      </div>

      <div className="pv-cd"><div className="pv-ch">WHAT TO SEND <span className="pa-r"><button className="pa-mini" onClick={() => void savePrefs({ ...P, ev: Object.fromEntries(EVENTS.map(([k]) => [k, true])) })}>ALL ON</button><button className="pa-mini" onClick={() => void savePrefs({ ...P, ev: Object.fromEntries(EVENTS.map(([k]) => [k, false])) })}>ALL OFF</button></span></div>
        {EVENTS.map(([k, ic, t, s]) => <div className="pa-row" key={k}><span className="pa-ic">{ic}</span><span className="pa-t"><b>{t}</b><small>{s}</small></span><Sw on={P.ev[k] !== false} label={t} onChange={(v) => void savePrefs({ ...P, ev: { ...P.ev, [k]: v } })} /></div>)}
      </div>

      <div className="pv-cd"><div className="pv-ch">QUIET TIME (UK)</div>
        <div className="pa-seg">{([["off", "OFF"], ["night", "23:00–08:00"], ["custom", "CUSTOM"]] as const).map(([v, l]) => <button key={v} className={P.quiet === v ? "on" : ""} onClick={() => void savePrefs({ ...P, quiet: v })}>{l}</button>)}</div>
        {P.quiet === "custom" && <div className="pv-act"><input type="time" className="pv-in" value={P.from} aria-label="Quiet from" onChange={(e) => void savePrefs({ ...P, from: e.target.value })} /> – <input type="time" className="pv-in" value={P.to} aria-label="Quiet until" onChange={(e) => void savePrefs({ ...P, to: e.target.value })} /></div>}
        <div className="pa-row"><span className="pa-ic">⚑</span><span className="pa-t"><b>Events still come through</b><small>Event starting alerts ignore quiet time</small></span><Sw on={P.letOps} label="Events still come through" onChange={(v) => void savePrefs({ ...P, letOps: v })} /></div>
      </div>

      <div className="pv-cd"><div className="pv-ch">HOW</div>
        <div className="pa-row"><span className="pa-ic">💬</span><span className="pa-t"><b>Show message text</b><small>Off = &quot;New message&quot; only on the lock screen</small></span><Sw on={P.preview} label="Show message text" onChange={(v) => void savePrefs({ ...P, preview: v })} /></div>
        <div className="pa-row"><span className="pa-ic">🔴</span><span className="pa-t"><b>Red number on the app icon</b><small>Unread alerts count</small></span><Sw on={P.badge} label="App icon badge" onChange={(v) => void savePrefs({ ...P, badge: v })} /></div>
        <div className="pa-row"><span className="pa-ic">🖥</span><span className="pa-t"><b>Not when I&apos;m on the Hub</b><small>Skip the phone while the Hub is open on my PC</small></span><Sw on={P.skipHub} label="Not when on the Hub" onChange={(v) => void savePrefs({ ...P, skipHub: v })} /></div>
      </div>

      <div className="pv-cd"><div className="pv-ch">MY PHONES</div>
        {!d.phones.length ? <p className="pv-hint">No phones yet.</p> : d.phones.map((x) => <div className="pa-row" key={x.id}><span className="pa-ic">📱</span>
          <span className="pa-t"><b>{x.name}{x.id === mineId && <em> · THIS ONE</em>}</b><small>Added {ago(x.createdISO)} · last alert {ago(x.lastISO)}</small></span>
          <Sw on={x.enabled} label={`${x.name} on`} onChange={(v) => void api({ action: "enable", id: x.id, on: v }).then(load)} />
          <button className="pa-mini" onClick={() => void api({ action: "remove", id: x.id }).then(() => { if (x.id === mineId) setMineId(null); void load(); })}>REMOVE</button></div>)}
        <p className="pv-hint">iPhone: iOS 16.4+ and the Home Screen icon. Android: Chrome, with or without the icon. Phones use their own alert sound.</p>
      </div>

      <div className="pv-cd"><div className="pv-ch">🔊 ALERT SOUNDS (WEBSITE)</div>
        <div className="pa-row"><span className="pa-ic">🔊</span><span className="pa-t"><b>Play sounds</b><small>Off by default · a caption always shows too</small></span><Sw on={S.on} label="Play sounds" onChange={(v) => void saveSounds({ ...S, on: v })} /></div>
        <div className="pa-row"><span className="pa-ic">🎚</span><span className="pa-t"><b>Volume</b></span><input type="range" min={0} max={100} value={S.vol} aria-label="Volume" onChange={(e) => setD({ ...d, sounds: { ...S, vol: Number(e.target.value) } })} onMouseUp={() => void saveSounds(S)} onTouchEnd={() => void saveSounds(S)} /><span className="pa-v">{S.vol}%</span></div>
        {EVENTS.map(([k, ic, t]) => <div className="pa-row" key={k}><span className="pa-ic">{ic}</span><span className="pa-t"><b>{t}</b></span>
          <select className="pv-in" value={S.map[k] ?? "chime"} aria-label={`Sound for ${t}`} onChange={(e) => void saveSounds({ ...S, map: { ...S.map, [k]: e.target.value } })}>{opts.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
          <button className="pa-mini" onClick={() => play(S.map[k] ?? "chime", t)}>▶</button></div>)}
        {canUpload && <div className="pa-row"><span className="pa-ic">⬆</span><span className="pa-t"><b>My own sounds</b><small>MP3 / WAV · up to 1 MB · 5 seconds · {S.mine.length}/8</small></span>
          <label className="pa-mini" style={{ cursor: "pointer" }}>＋ UPLOAD<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label></div>}
        {S.mine.map((m) => <div className="pa-row" key={m.id}><span className="pa-ic">🎵</span><span className="pa-t"><b>{m.name}</b></span><button className="pa-mini" onClick={() => play(m.id, m.name)}>▶</button>
          <button className="pa-mini" onClick={() => void saveSounds({ ...S, mine: S.mine.filter((x) => x.id !== m.id), map: Object.fromEntries(Object.entries(S.map).map(([k, v]) => [k, v === m.id ? "chime" : v])) })}>DELETE</button></div>)}
        {cap && <div className="pa-cap" aria-live="polite">{cap}</div>}
      </div>
    </div>
  );
}
