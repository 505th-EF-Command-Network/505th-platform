import { useCallback, useEffect, useState } from "react";
import type { CcChannel } from "../../../preload/api";
import { askBox } from "../components/Confirm";

/**
 * CORTANA COMMAND → INFO POSTS (same as the website page). Access "info".
 * Saved posts (rules, welcome, role pickers…) that Cortana keeps in Discord. Edit → PUBLISH updates the same message.
 * Last 6 versions are kept. Buttons: accept (give role) · toggle (role on/off) · link · ticket · reply (private answer).
 */
type Field = { name: string; value: string; inline: boolean };
type Embed = { title: string; description: string; color: number; fields: Field[]; image: string; thumbnail: string; footer: string };
type Btn = { type: string; label: string; emoji: string; style: string; roleId: string; url: string; ticketType: string; reply: string };
type Post = { id?: string; name: string; channelId: string; content: string; embeds: Embed[]; buttons: Btn[]; menu?: unknown; pin: boolean; showOnWebsite: boolean; updatedAtISO?: string; updatedByName?: string; versions?: number; discord?: { messageId?: string } };
type D = { posts: Post[]; channels: CcChannel[]; roles: { id: string; name: string; color: number; assignable: boolean }[]; ticketTypes: { id: string; name: string }[] };
const blankEmbed = (): Embed => ({ title: "", description: "", color: 0x00d9ff, fields: [], image: "", thumbnail: "logo", footer: "505th Expeditionary Force" });
const blank = (): Post => ({ name: "", channelId: "", content: "", embeds: [blankEmbed()], buttons: [], pin: false, showOnWebsite: false });
const BTYPES: [string, string][] = [["accept", "GIVE ROLE"], ["toggle", "ROLE ON/OFF"], ["link", "LINK"], ["ticket", "OPEN TICKET"], ["reply", "PRIVATE REPLY"]];
const BCOL: Record<string, string> = { green: "#248046", blue: "#5865f2", grey: "#4e5058", red: "#da373c" };
const hex = (n: number) => "#" + (n >>> 0).toString(16).padStart(6, "0");

export function InfoPosts() {
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<[string, boolean] | null>(null);
  const load = useCallback(async () => { try { const r = await window.cn.hub.cc("info"); if (!r || "error" in r) setError(String((r as { error?: string } | null)?.error ?? "No answer")); else { setD(r as D); setError(null); } } catch { setError("This page needs an app restart"); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  if (error && !d) return <main className="grid flex-1 place-items-center text-[13px] text-bad">⚠ {error}</main>;
  if (!d) return <main className="grid flex-1 place-items-center text-[12px] tracking-[2px] text-dim">LOADING…</main>;
  const lbl = "mb-1.5 mt-3 block text-[10px] tracking-[1.5px] text-dim", inp = "w-full border border-white/15 bg-[#070a0f] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-cyan";
  const btn = "border px-3 py-1.5 text-[10.5px] font-semibold tracking-[1.5px] disabled:opacity-40";
  const chName = (id: string) => d.channels.find((c) => c.id === id)?.name ?? "?";
  const groups = [...new Set(d.channels.map((c) => c.parentName || "NO CATEGORY"))];
  const send = async (action: "save" | "publish") => {
    if (!v) return;
    setBusy(true);
    const r = await window.cn.hub.ccAction({ part: "info", action, id: v.id, v });
    setBusy(false);
    if (r.error) return setToast([r.error.toUpperCase(), false]);
    setToast([String(r.msg).toUpperCase(), !r.queued]);
    setV((o) => (o ? { ...o, id: r.id ?? o.id } : o));
    void load();
  };
  const del = async (p: Post) => {
    if (!(await askBox(`Delete "${p.name}"? It is also removed from Discord.`, { tone: "danger", go: "DELETE" }))) return;
    setBusy(true); const r = await window.cn.hub.ccAction({ part: "info", action: "delete", id: p.id }); setBusy(false);
    setToast(r.error ? [r.error.toUpperCase(), false] : ["POST DELETED", true]); if (!r.error) { setV(null); void load(); }
  };

  if (!v) return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Info Posts">
      <div className="flex items-end gap-3"><div className="flex-1"><h1 className="m-0 font-head text-[24px] font-bold tracking-[4px] text-cyan">📌 INFO POSTS</h1>
        <p className="m-0 mt-0.5 text-[11px] tracking-[1.5px] text-dim">SAVED DISCORD POSTS CORTANA KEEPS UP TO DATE · RULES · WELCOME · ROLE PICKERS</p></div>
        <button type="button" onClick={() => setV(blank())} className={`${btn} border-cyan text-cyan`}>+ NEW POST</button></div>
      <section className="mt-4 border border-cyan/15 bg-panel">
        {!d.posts.length && <p className="py-10 text-center text-[11px] tracking-[2px] text-dimmer">NO POSTS YET</p>}
        {d.posts.map((p) => <div key={p.id} className="flex items-center gap-3 border-b border-white/5 px-3.5 py-2.5 text-[12.5px]">
          <span className="min-w-0 flex-1"><b className="text-white">{p.name}</b> <span className="text-dim">· #{chName(p.channelId)}</span>
            <small className="block text-[10.5px] text-dimmer">{p.discord?.messageId ? "● IN DISCORD" : "○ NOT POSTED"}{p.pin ? " · PINNED" : ""}{p.showOnWebsite ? " · ON WEBSITE" : ""} · {p.versions ?? 0} old versions{p.updatedByName ? ` · ${p.updatedByName}` : ""}</small></span>
          <button type="button" onClick={() => setV({ ...blank(), ...p, embeds: p.embeds?.length ? p.embeds : [blankEmbed()], buttons: p.buttons ?? [] })} className={`${btn} border-cyan/30 text-cyan`}>EDIT</button>
          <button type="button" disabled={busy} aria-label={`Delete ${p.name}`} onClick={() => void del(p)} className={`${btn} border-bad/40 text-bad`}>🗑</button></div>)}
      </section>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );

  const setE = (i: number, e: Partial<Embed>) => setV({ ...v, embeds: v.embeds.map((x, j) => (j === i ? { ...x, ...e } : x)) });
  const setB = (i: number, b: Partial<Btn>) => setV({ ...v, buttons: v.buttons.map((x, j) => (j === i ? { ...x, ...b } : x)) });
  return (
    <main className="min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Edit info post">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setV(null)} className={`${btn} border-cyan/20 text-dim`}>← ALL POSTS</button>
        <h1 className="m-0 flex-1 font-head text-[20px] font-bold tracking-[3px] text-cyan">{v.id ? "EDIT POST" : "NEW POST"}</h1>
        <button type="button" disabled={busy} onClick={() => void send("save")} className={`${btn} border-cyan/40 text-cyan`}>SAVE DRAFT</button>
        <button type="button" disabled={busy} onClick={() => void send("publish")} className={`${btn} border-[#9cbf4a] bg-[#9cbf4a] text-black`}>{busy ? "WORKING…" : "PUBLISH TO DISCORD"}</button></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="border border-cyan/15 bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="ipN" className={lbl} style={{ marginTop: 0 }}>NAME (STAFF ONLY)</label><input id="ipN" maxLength={100} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inp} /></div>
            <div><label htmlFor="ipCh" className={lbl} style={{ marginTop: 0 }}>CHANNEL</label><select id="ipCh" value={v.channelId} onChange={(e) => setV({ ...v, channelId: e.target.value })} className={inp}><option value="">— pick —</option>
              {groups.map((g) => <optgroup key={g} label={g.toUpperCase()}>{d.channels.filter((c) => (c.parentName || "NO CATEGORY") === g).map((c) => <option key={c.id} value={c.id} disabled={!c.botCanSend}># {c.name}</option>)}</optgroup>)}</select></div></div>
          <label htmlFor="ipC" className={lbl}>MESSAGE TEXT (ABOVE THE EMBED)</label><textarea id="ipC" rows={2} maxLength={2000} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} className={inp} />
          {v.embeds.map((e, i) => <fieldset key={i} className="mt-3 border border-white/10 p-3"><legend className="px-1 text-[10px] tracking-[1.5px] text-cyan">EMBED {i + 1}</legend>
            <div className="flex gap-2"><input aria-label="Title" placeholder="Title" maxLength={256} value={e.title} onChange={(x) => setE(i, { title: x.target.value })} className={inp} />
              <input type="color" aria-label="Colour" value={hex(e.color)} onChange={(x) => setE(i, { color: parseInt(x.target.value.slice(1), 16) })} className="h-[34px] w-12 border border-white/15 bg-transparent" />
              {v.embeds.length > 1 && <button type="button" aria-label="Remove embed" onClick={() => setV({ ...v, embeds: v.embeds.filter((_, j) => j !== i) })} className={`${btn} border-bad/40 text-bad`}>✕</button>}</div>
            <textarea aria-label="Description" placeholder="Description (Discord markdown works)" rows={5} maxLength={4000} value={e.description} onChange={(x) => setE(i, { description: x.target.value })} className={`${inp} mt-2`} />
            {e.fields.map((f, k) => <div key={k} className="mt-2 flex gap-2"><input aria-label="Field name" placeholder="Field name" value={f.name} onChange={(x) => setE(i, { fields: e.fields.map((y, z) => (z === k ? { ...y, name: x.target.value } : y)) })} className={inp} />
              <input aria-label="Field value" placeholder="Value" value={f.value} onChange={(x) => setE(i, { fields: e.fields.map((y, z) => (z === k ? { ...y, value: x.target.value } : y)) })} className={inp} />
              <label className="flex items-center gap-1 text-[10px] text-dim"><input type="checkbox" checked={f.inline} onChange={(x) => setE(i, { fields: e.fields.map((y, z) => (z === k ? { ...y, inline: x.target.checked } : y)) })} />INLINE</label>
              <button type="button" aria-label="Remove field" onClick={() => setE(i, { fields: e.fields.filter((_, z) => z !== k) })} className="text-bad">✕</button></div>)}
            {e.fields.length < 25 && <button type="button" onClick={() => setE(i, { fields: [...e.fields, { name: "", value: "", inline: false }] })} className="mt-2 text-[10.5px] tracking-[1px] text-cyan">+ FIELD</button>}
            <div className="mt-2 grid grid-cols-2 gap-2"><input aria-label="Image URL" placeholder="Big image URL (https://…)" value={e.image} onChange={(x) => setE(i, { image: x.target.value })} className={inp} />
              <input aria-label="Footer" placeholder="Footer" value={e.footer} onChange={(x) => setE(i, { footer: x.target.value })} className={inp} /></div>
            <label className="mt-2 flex items-center gap-2 text-[12px]"><input type="checkbox" checked={e.thumbnail === "logo"} onChange={(x) => setE(i, { thumbnail: x.target.checked ? "logo" : "" })} /> 505th logo in the corner</label>
          </fieldset>)}
          {v.embeds.length < 10 && <button type="button" onClick={() => setV({ ...v, embeds: [...v.embeds, blankEmbed()] })} className="mt-2 text-[10.5px] tracking-[1px] text-cyan">+ EMBED</button>}
          <span className={lbl}>BUTTONS</span>
          {v.buttons.map((b, i) => <div key={i} className="mb-2 border border-white/10 p-2">
            <div className="flex gap-2"><select aria-label="Button type" value={b.type} onChange={(x) => setB(i, { type: x.target.value })} className={inp}>{BTYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input aria-label="Emoji" placeholder="😀" value={b.emoji} onChange={(x) => setB(i, { emoji: x.target.value })} className={`${inp} w-16`} />
              <input aria-label="Label" placeholder="Label" value={b.label} onChange={(x) => setB(i, { label: x.target.value })} className={inp} />
              {b.type !== "link" && <select aria-label="Colour" value={b.style} onChange={(x) => setB(i, { style: x.target.value })} className={`${inp} w-24`}>{Object.keys(BCOL).map((k) => <option key={k}>{k}</option>)}</select>}
              <button type="button" aria-label="Remove button" onClick={() => setV({ ...v, buttons: v.buttons.filter((_, j) => j !== i) })} className="text-bad">✕</button></div>
            {(b.type === "accept" || b.type === "toggle") && <select aria-label="Role" value={b.roleId} onChange={(x) => setB(i, { roleId: x.target.value })} className={`${inp} mt-2`}><option value="">— role —</option>{d.roles.filter((r) => r.assignable).map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}</select>}
            {b.type === "link" && <input aria-label="Link" value={b.url} onChange={(x) => setB(i, { url: x.target.value })} className={`${inp} mt-2`} />}
            {b.type === "ticket" && <select aria-label="Ticket type" value={b.ticketType} onChange={(x) => setB(i, { ticketType: x.target.value })} className={`${inp} mt-2`}><option value="">— ticket type —</option>{d.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
            {b.type === "reply" && <textarea aria-label="Private reply" placeholder="Only the clicker sees this" rows={2} value={b.reply} onChange={(x) => setB(i, { reply: x.target.value })} className={`${inp} mt-2`} />}
          </div>)}
          {v.buttons.length < 25 && <button type="button" onClick={() => setV({ ...v, buttons: [...v.buttons, { type: "accept", label: "", emoji: "", style: "green", roleId: "", url: "https://", ticketType: "", reply: "" }] })} className="text-[10.5px] tracking-[1px] text-cyan">+ BUTTON</button>}
          <div className="mt-3 flex gap-5 text-[12.5px]"><label className="flex items-center gap-2"><input type="checkbox" checked={v.pin} onChange={(e) => setV({ ...v, pin: e.target.checked })} /> Pin in channel</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.showOnWebsite} onChange={(e) => setV({ ...v, showOnWebsite: e.target.checked })} /> Show on website</label></div>
        </section>
        <section><span className="mb-1.5 block text-[10px] tracking-[1.5px] text-dim">PREVIEW · #{v.channelId ? chName(v.channelId) : "channel"}</span>
          <div className="rounded-md bg-[#313338] p-3.5 text-[14px] text-[#dbdee1]">
            <div className="flex items-center gap-2"><b className="text-white">Cortana</b><span className="rounded bg-[#5865f2] px-1 text-[10px] text-white">APP</span></div>
            {v.content && <div className="mt-1 whitespace-pre-wrap">{v.content}</div>}
            {v.embeds.map((e, i) => <div key={i} className="mt-1.5 max-w-[520px] rounded border-l-4 bg-[#2b2d31] p-2.5" style={{ borderColor: hex(e.color) }}>
              {e.title && <div className="font-bold text-white">{e.title}</div>}{e.description && <div className="mt-1 whitespace-pre-wrap text-[13.5px]">{e.description}</div>}
              {!!e.fields.length && <div className="mt-2 grid grid-cols-3 gap-2">{e.fields.map((f, k) => <div key={k} className={f.inline ? "" : "col-span-3"}><b className="block text-[12.5px] text-white">{f.name}</b><span className="text-[13px]">{f.value}</span></div>)}</div>}
              {/^https:\/\//.test(e.image) && <img src={e.image} alt="" className="mt-2 max-h-48 rounded" />}{e.footer && <div className="mt-2 text-[11px] text-[#949ba4]">{e.footer}</div>}</div>)}
            {!!v.buttons.length && <div className="mt-2 flex flex-wrap gap-1.5">{v.buttons.map((b, i) => <span key={i} className="rounded px-3 py-1 text-[13px] text-white" style={{ background: b.type === "link" ? BCOL.grey : BCOL[b.style] }}>{b.emoji} {b.label}{b.type === "link" ? " ↗" : ""}</span>)}</div>}
          </div></section>
      </div>
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 border px-4 py-2.5 text-[11px] tracking-[1.5px] ${toast[1] ? "border-ok/50 bg-[#0a1a12] text-ok" : "border-amber/50 bg-[#1a1408] text-amber"}`}>{toast[0]}</div>}
    </main>
  );
}
