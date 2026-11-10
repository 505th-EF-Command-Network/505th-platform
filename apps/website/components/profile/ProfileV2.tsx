"use client";

import { useRef, useState, type ReactNode } from "react";

type Photo = { source: "discord" | "upload"; url: string | null; zoom: number; x: number; y: number };
type Pref = { bell: boolean; dm: boolean };
type Prefs = Record<"messages" | "notes" | "promotions" | "events" | "staff" | "command", Pref> & { quiet: string | null };
type R = {
  name: string; rank: string; roleLabel: string; platoon: string; joinedAt: string | null; callsign: string; status: string; hasDiscord: boolean;
  attendance: { percent: number; opsAttended: number; opsEligible: number }; counts: { promotions: number; commendations: number; ribbons: number; warnings: number };
};

const PREF_ROWS: [keyof Omit<Prefs, "quiet">, string, string][] = [
  ["messages", "MESSAGES", "New direct messages"],
  ["notes", "NOTES SHARED", "When someone shares a note with you"],
  ["promotions", "PROMOTIONS & AWARDS", "When you are promoted or awarded"],
  ["events", "EVENTS", "New ops and reminders 1 hour before"],
  ["staff", "STAFF ALERTS", "BCT approvals, attendance checks (staff only)"],
  ["command", "COMMAND", "SITREPs and unit status"],
];

/** Hex picture. Same shape and maths as the terminal's hexAvatar(). */
export function Hex({ url, photo, size, label }: { url: string | null; photo?: Photo; size: "xs" | "sm" | "md" | "lg" | "xl"; label: string }) {
  const up = photo?.source === "upload";
  return (
    <span
      role="img"
      aria-label={label}
      className={`pv-hex pv-hex-${size} ${url ? "" : "noimg"}`}
      style={url ? ({ "--img": `url("${url}")`, "--z": `${up ? photo!.zoom : 100}%`, "--px": `${up ? photo!.x : 50}%`, "--py": `${up ? photo!.y : 50}%` } as React.CSSProperties) : undefined}
    >
      {url ? null : (label.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function since(iso: string | null) {
  if (!iso) return "—";
  const a = new Date(iso), b = new Date();
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  const y = Math.floor(m / 12);
  m %= 12;
  return `${y ? `${y}y ` : ""}${m}m`;
}

export default function ProfileV2(p: { tab: string; terminal: boolean; discordUsername: string; canEdit: boolean; r: R | null; photo: Photo; discordAvatar: string | null; prefs: Prefs; record: ReactNode }) {
  const [tab, setTab] = useState(["over", "pfp", "rec", "notif"].includes(p.tab) ? p.tab : "over");
  const [saved, setSaved] = useState<Photo>(p.photo);
  const [ph, setPh] = useState<Photo>(p.photo);
  const [prefs, setPrefs] = useState<Prefs>(p.prefs);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const shownUrl = (x: Photo) => (x.source === "upload" && x.url ? x.url : p.discordAvatar);
  const say = (ok: boolean, t: string) => {
    setMsg({ ok, t });
    setTimeout(() => setMsg(null), 3500);
  };

  async function upload(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) return say(false, "JPG / PNG / WEBP UP TO 5 MB ONLY");
    setBusy("UPLOADING… 0%");
    try {
      const s = await fetch("/api/me/upload-sign", { method: "POST" });
      const sj = await s.json();
      if (!s.ok) throw new Error(sj.error || "Upload not allowed");
      const fd = new FormData();
      fd.append("file", f);
      fd.append("api_key", sj.apiKey);
      fd.append("timestamp", String(sj.timestamp));
      fd.append("folder", sj.folder);
      fd.append("signature", sj.signature);
      const url: string = await new Promise((res, rej) => {
        const x = new XMLHttpRequest();
        x.open("POST", `https://api.cloudinary.com/v1_1/${sj.cloudName}/image/upload`);
        x.upload.onprogress = (e) => e.lengthComputable && setBusy(`UPLOADING… ${Math.round((e.loaded / e.total) * 100)}%`);
        x.onload = () => {
          try {
            const d = JSON.parse(x.responseText);
            d.secure_url ? res(d.secure_url) : rej(new Error(d.error?.message || "Upload failed"));
          } catch {
            rej(new Error("Upload failed"));
          }
        };
        x.onerror = () => rej(new Error("Network error"));
        x.send(fd);
      });
      setPh({ source: "upload", url, zoom: 120, x: 50, y: 50 });
      say(true, "UPLOADED — ADJUST THEN SAVE PICTURE");
    } catch (e) {
      say(false, (e as Error).message.toUpperCase());
    } finally {
      setBusy("");
    }
  }

  async function save(body: object, ok: string) {
    setBusy("SAVING…");
    try {
      const r = await fetch("/api/me/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Save failed");
      say(true, ok);
      return true;
    } catch (e) {
      say(false, (e as Error).message.toUpperCase());
      return false;
    } finally {
      setBusy("");
    }
  }

  const dirty = JSON.stringify(ph) !== JSON.stringify(saved);
  const r = p.r;
  const name = r?.name ?? p.discordUsername;

  return (
    <div className="pv">
      <header className="pv-top">
        <a href="/home" className="pv-brand"><img src="/images/logo.png" alt="" /><span>505TH EXPEDITIONARY FORCE</span></a>
        <div className="pv-topr">
          {p.terminal && <a className="pv-b" href="/terminal">◈ COMMAND TERMINAL</a>}
          <a className="pv-b" href="/resources-roster">☰ ROSTER</a>
          <form action="/api/auth/logout" method="post"><button className="pv-b red" type="submit">⏻ LOG OUT</button></form>
        </div>
      </header>

      {!r ? (
        <p className="pv-empty"><b>NO SERVICE RECORD LINKED</b>You are signed in as {p.discordUsername}, but there is no roster record for this Discord account yet.</p>
      ) : (
        <>
          <section className="pv-head">
            <button className="pv-hexbtn" onClick={() => setTab("pfp")} aria-label="Change profile picture" disabled={!p.canEdit}>
              <Hex url={shownUrl(saved)} photo={saved} size="xl" label={name} />
              {p.canEdit && <span className="pv-hexov">⬢ CHANGE</span>}
            </button>
            <div>
              <div className="pv-rank">{r.rank.toUpperCase() || "—"}</div>
              <h1>{name.toUpperCase()}</h1>
              <div className="pv-dim">{r.roleLabel.toUpperCase()}{r.platoon ? ` · ${r.platoon.toUpperCase()}` : ""}{r.joinedAt ? ` · MEMBER SINCE ${new Date(r.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}` : ""}</div>
              <div className="pv-tags">
                <span className="pv-pill" style={{ "--c": r.status === "ACTIVE" ? "#22e07a" : "#f59e0b" } as React.CSSProperties}>● {r.status}</span>
                {r.hasDiscord && <span className="pv-pill" style={{ "--c": "#7b86ff" } as React.CSSProperties}>◈ DISCORD LINKED · {p.discordUsername}</span>}
                <span className="pv-pill" style={{ "--c": "#f59e0b" } as React.CSSProperties}>ATTENDANCE {r.attendance.percent}%</span>
              </div>
            </div>
          </section>

          <nav className="pv-tabs" role="tablist">
            {[["over", "OVERVIEW"], ["pfp", "⬢ PROFILE PICTURE"], ["rec", "SERVICE RECORD"], ["notif", "🔔 ALERT SETTINGS"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </nav>

          {msg && <div role="status" className={`pv-msg ${msg.ok ? "ok" : "bad"}`}>{msg.ok ? "✓ " : "⚠ "}{msg.t}</div>}

          {tab === "over" && (
            <div className="pv-grid">
              <div className="pv-cd"><div className="pv-ch">DETAILS</div>
                {[["CALLSIGN", r.callsign || "—"], ["RANK", r.rank || "—"], ["PLATOON", r.platoon || "—"], ["TIME IN UNIT", since(r.joinedAt)], ["ROLE", r.roleLabel]].map(([k, v]) => <div className="pv-kv" key={k}><span>{k}</span><b>{v}</b></div>)}
                <p className="pv-hint">Name, rank and platoon are changed by staff in Personnel Files.</p></div>
              <div className="pv-cd"><div className="pv-ch">RECORD</div>
                {[["PROMOTIONS", r.counts.promotions], ["COMMENDATIONS", r.counts.commendations], ["RIBBONS", r.counts.ribbons], ["OPS ATTENDED", `${r.attendance.opsAttended} / ${r.attendance.opsEligible}`]].map(([k, v]) => <div className="pv-kv" key={String(k)}><span>{k}</span><b>{v}</b></div>)}</div>
            </div>
          )}

          {tab === "pfp" && (
            <div className="pv-grid pfp">
              <div className="pv-cd"><div className="pv-ch">YOUR PICTURE</div>
                <div className="pv-pv3"><Hex url={shownUrl(ph)} photo={ph} size="xl" label={name} />
                  <div><div className="pv-lb">SHOWN AS</div><div className="pv-row">{(["lg", "md", "sm", "xs"] as const).map((s) => <Hex key={s} url={shownUrl(ph)} photo={ph} size={s} label={name} />)}</div>
                    <p className="pv-hint">Same hex everywhere: Personnel Files, Roster, Messages, Alerts, Command Staff, Dashboard and the top bar.</p></div></div>
                {ph.source === "upload" && (
                  <>
                    <label className="pv-lb" htmlFor="pvZoom">ZOOM</label>
                    <input id="pvZoom" type="range" min={100} max={250} value={ph.zoom} onChange={(e) => setPh({ ...ph, zoom: +e.target.value })} className="pv-range" />
                    <div className="pv-lb">POSITION</div>
                    <div className="pv-nudge">
                      {([["▲", 0, -5, "Move up"], ["◀", -5, 0, "Move left"], ["▶", 5, 0, "Move right"], ["▼", 0, 5, "Move down"]] as const).map(([t, dx, dy, a]) => (
                        <button key={a} aria-label={a} onClick={() => setPh({ ...ph, x: Math.max(0, Math.min(100, ph.x + dx)), y: Math.max(0, Math.min(100, ph.y + dy)) })}>{t}</button>
                      ))}
                      <button onClick={() => setPh({ ...ph, x: 50, y: 50 })}>⊙ CENTRE</button>
                    </div>
                  </>
                )}
              </div>
              <div className="pv-cd"><div className="pv-ch">CHOOSE</div>
                <button className={`pv-src ${ph.source === "discord" ? "on" : ""}`} onClick={() => setPh({ ...ph, source: "discord" })} disabled={!p.canEdit}>
                  <Hex url={p.discordAvatar} size="md" label={name} /><span><b>DISCORD PICTURE</b><small>Used automatically when you first join. Follows your Discord picture when you change it there.</small></span></button>
                {(ph.url || saved.url) && (
                  <button className={`pv-src ${ph.source === "upload" ? "on" : ""}`} onClick={() => setPh({ ...ph, source: "upload", url: ph.url || saved.url })} disabled={!p.canEdit}>
                    <Hex url={ph.url || saved.url} photo={{ ...ph, source: "upload" }} size="md" label={name} /><span><b>MY UPLOAD</b><small>Your soldier picture</small></span></button>
                )}
                <label className={`pv-drop ${p.canEdit ? "" : "off"}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (p.canEdit) upload(e.dataTransfer.files[0]); }}>
                  {busy.startsWith("UPLOAD") ? busy : "⇪ UPLOAD A NEW PICTURE"}<small>JPG / PNG / WEBP · UP TO 5 MB · SQUARE WORKS BEST · CROPPED TO THE HEX</small>
                  <input ref={file} type="file" accept="image/*" hidden disabled={!p.canEdit} onChange={(e) => upload(e.target.files?.[0])} />
                </label>
                <div className="pv-act">
                  <button className="pv-b" onClick={() => setPh({ ...ph, source: "discord" })} disabled={!p.canEdit}>↺ USE DISCORD PICTURE</button>
                  <span style={{ flex: 1 }} />
                  <button className="pv-b gold" disabled={!dirty || !!busy || !p.canEdit} onClick={async () => { if (await save({ photo: ph }, "PROFILE PICTURE SAVED — UPDATED EVERYWHERE")) setSaved(ph); }}>SAVE PICTURE</button>
                </div>
                <p className="pv-hint">Staff can remove a picture that breaks the rules (it goes back to your Discord picture).</p>
              </div>
            </div>
          )}

          {tab === "rec" && <div className="pv-rec">{p.record}</div>}

          {tab === "notif" && (
            <div className="pv-cd"><div className="pv-ch">ALERT SETTINGS</div>
              {PREF_ROWS.map(([k, t, d]) => (
                <div className="pv-nr" key={k}><span><b>{t}</b><small>{d}</small></span>
                  <label><input type="checkbox" checked={prefs[k].bell} onChange={(e) => setPrefs({ ...prefs, [k]: { ...prefs[k], bell: e.target.checked } })} /> 🔔 BELL</label>
                  {k === "notes" ? <span className="pv-hint" style={{ margin: 0 }}>BELL ONLY</span> : <label><input type="checkbox" checked={prefs[k].dm} onChange={(e) => setPrefs({ ...prefs, [k]: { ...prefs[k], dm: e.target.checked } })} /> ◈ DISCORD DM</label>}</div>
              ))}
              <label className="pv-lb" htmlFor="pvQuiet">QUIET HOURS</label>
              <div className="pv-act" style={{ marginTop: 0 }}>
                <select id="pvQuiet" className="pv-in" value={prefs.quiet ?? ""} onChange={(e) => setPrefs({ ...prefs, quiet: e.target.value || null })}>
                  <option value="">OFF</option><option value="22:00-08:00">22:00 – 08:00</option><option value="23:00-08:00">23:00 – 08:00</option><option value="00:00-09:00">00:00 – 09:00</option>
                </select>
                <span className="pv-hint" style={{ margin: 0 }}>No Discord DMs during quiet hours. Alerts still collect in the bell.</span>
              </div>
              <p className="pv-hint">Discord DMs are sent by Cortana v2 once it&apos;s running.</p>
              <div className="pv-act"><span style={{ flex: 1 }} /><button className="pv-b gold" disabled={!!busy || !p.canEdit} onClick={() => save({ notifyPrefs: prefs }, "ALERT SETTINGS SAVED")}>SAVE</button></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
