import { useEffect, useRef } from "react";
import type { Overview, Summary } from "../../preload/api";
import { alertKind, fire, settingsNow } from "./settings";

const ICON: Record<string, string> = { message: "💬", tag: "@", ticket: "🎫", bct: "✚", op: "⚑", project: "☷", rank: "★" };

/**
 * Watches the data the app already loads and pops up desktop notifications for what's NEW since it started:
 * new unread alerts (🔔), more tickets waiting, more recruits waiting, and your ops starting soon.
 * Nothing is fired for what was already there when the app opened. Clicking a card opens the right page.
 */
export function useNotifier(sum: Summary | null, ov: Overview | null, onPage: (p: string) => void) {
  const seen = useRef<Set<string> | null>(null);
  const counts = useRef<{ tickets: number; bct: number } | null>(null);
  const opsDone = useRef(new Set<string>());
  const pages = useRef(new Map<string, string>());

  // 🔔 alerts
  useEffect(() => {
    if (!sum) return;
    const unread = sum.alerts.filter((a) => !a.read);
    void window.cn.notify.unread(unread.filter((a) => settingsNow().notify.ev[alertKind(a)].bell).length);
    if (!seen.current) { seen.current = new Set(sum.alerts.map((a) => a.id)); return; }
    for (const a of unread) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      const k = alertKind(a);
      const id = `alert:${a.id}`;
      pages.current.set(id, k === "project" || k === "tag" ? "panel-projects" : k === "message" ? "panel-msg2" : "dashboard");
      if (k === "staff") { pages.current.set(`${id}#msg`, "panel-msg2"); fire(k, { id, title: a.title, body: a.body, icon: a.title.startsWith("🌐") ? "🌐" : "🖥", actions: [{ id: "open", label: "VIEW STAFF" }, { id: "msg", label: "MESSAGE" }] }); continue; }
      fire(k, { id, title: a.title, body: a.body, icon: ICON[k], urgent: k === "message", actions: [{ id: "open", label: "OPEN" }, { id: "read", label: "MARK READ" }] });
    }
  }, [sum]);

  // 🎫 tickets / ✚ recruits waiting (counts going up)
  useEffect(() => {
    if (!ov) return;
    const c = { tickets: ov.counts.tickets, bct: ov.counts.bct };
    const was = counts.current;
    counts.current = c;
    if (!was) return;
    if (c.tickets > was.tickets) { pages.current.set("tickets", "panel-tickets"); fire("ticket", { id: "tickets", title: "🎫 Ticket waiting on staff", body: `${c.tickets} ticket${c.tickets === 1 ? "" : "s"} waiting for a reply.`, icon: "🎫", actions: [{ id: "open", label: "OPEN TICKETS" }] }); }
    if (c.bct > was.bct) { pages.current.set("bct", "panel-register"); fire("bct", { id: "bct", title: "✚ Recruit waiting for BCT", body: `${c.bct} recruit${c.bct === 1 ? "" : "s"} waiting for approval.`, icon: "✚", actions: [{ id: "open", label: "OPEN BCT" }] }); }
  }, [ov]);

  // ⚑ your op starting soon (checked every 30 s)
  useEffect(() => {
    if (!sum) return;
    const check = () => {
      const mins = settingsNow().notify.opMins;
      for (const op of sum.ops) {
        if (!op.myChoice || opsDone.current.has(op.id)) continue;
        const left = (Date.parse(op.startAtISO) - Date.now()) / 60000;
        if (left <= 0 || left > mins) continue;
        opsDone.current.add(op.id);
        const id = `op:${op.id}`;
        pages.current.set(id, "panel-events");
        fire("op", { id, title: `${op.title} starts in ${Math.ceil(left)} min`, body: `You're signed up · ${op.signedUp} attending`, icon: "⚑", color: "#f59e0b", urgent: true, actions: [{ id: "open", label: "VIEW EVENT" }] });
      }
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [sum]);

  // Card buttons
  useEffect(() => window.cn.notify.onAction(({ id, action }) => {
    if (action === "read" && id.startsWith("alert:")) { void window.cn.hub.readAlerts({ ids: [id.slice(6)] }); return; }
    const pg = pages.current.get(action === "msg" ? `${id}#msg` : id);
    if (pg) onPage(pg);
  }), [onPage]);
}
