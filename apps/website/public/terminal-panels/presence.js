/**
 * TERMINAL PRESENCE — who has the Command Terminal open (Dashboard → Online Now / Staff Online).
 *
 * Replaces the old dashboard-only presence, which (1) only checked you in while the Dashboard page was open,
 * and (2) deleted you the moment you switched browser tab — so staff who were working looked offline.
 *
 * Now: you're checked in on ANY terminal page, the page you're on is kept up to date, a check-in is sent
 * every 30 s (browsers slow background tabs to ~1/min, still inside the 2-minute window), and you're
 * removed when you close the tab or log out. One session per open tab.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "/terminal-shim/firestore.js";
import { auth, db, getMe, onReady } from "./_common.js";
import { onAuthStateChanged } from "/terminal-shim/auth.js";

const BEAT_MS = 30_000;
let sid = null, timer = null, panel = "admin_dashboard", starting = false;

const nowISO = () => new Date().toISOString();
async function beat() {
  if (!sid) return;
  try { await updateDoc(doc(db, "presence_sessions", sid), { panel, updatedAt: nowISO() }); }
  catch { sid = null; void join(); } // session was cleaned up — start a new one
}
async function join() {
  if (sid || starting || !auth.currentUser) return;
  starting = true;
  try {
    const me = await getMe();
    if (!me) return;
    // Remove this person's old sessions that are long dead (closed without saying goodbye).
    const old = await getDocs(query(collection(db, "presence_sessions"), where("uid", "==", me.uid))).catch(() => null);
    old?.forEach((d) => { if (Date.now() - Date.parse(d.data().updatedAt || 0) > 10 * 60_000) void deleteDoc(d.ref).catch(() => {}); });
    const ref = await addDoc(collection(db, "presence_sessions"), {
      panel, uid: me.uid, callsign: me.callsign || "", rank: me.rank || "", firstName: me.firstName || "", lastName: me.lastName || "", role: me.role || "", updatedAt: nowISO(),
    });
    sid = ref.id;
    clearInterval(timer);
    timer = setInterval(beat, BEAT_MS);
  } catch { /* try again on the next page change / tab focus */ }
  finally { starting = false; }
}
function leave() {
  clearInterval(timer);
  if (sid) void deleteDoc(doc(db, "presence_sessions", sid)).catch(() => {});
  sid = null;
}

onReady(() => {
  onAuthStateChanged(auth, (u) => (u ? join() : leave()));
  // Track which page you're on.
  const visible = () => document.querySelector(".main-content > .panel:not(.hidden)")?.id;
  const main = document.querySelector(".main-content");
  if (main) new MutationObserver(() => { const p = visible(); if (p && p !== panel) { panel = p; void beat(); } }).observe(main, { attributes: true, subtree: true, attributeFilter: ["class"] });
  // Back on the tab: check in straight away.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sid ? void beat() : void join(); });
  addEventListener("pagehide", leave);
});
