/**
 * 505th Command Terminal — Firestore stand-in.
 *
 * The original terminal (admin.html) was written for the Firebase SDK. This
 * module offers the same functions, but every read and write goes to the
 * website's own API (/api/terminal/fs), which stores data in MongoDB.
 * No Firebase code or keys are loaded.
 *
 * Live listeners (onSnapshot) are polled every few seconds and also refresh
 * straight after any write from this page.
 */
const API = "/api/terminal/fs";
const POLL_MS = 2500;
const POLL_HIDDEN_MS = 15000;

// ───────────── Values ─────────────

export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() { return Timestamp.fromDate(new Date()); }
  static fromDate(d) {
    const ms = d.getTime();
    return new Timestamp(Math.floor(ms / 1000), (((ms % 1000) + 1000) % 1000) * 1e6);
  }
  static fromMillis(ms) { return Timestamp.fromDate(new Date(ms)); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  valueOf() { return String(this.toMillis()).padStart(20, "0"); }
  isEqual(o) { return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds }; }
  toString() { return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})`; }
}

const isPlain = (v) => v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;

function encode(v) {
  if (v === undefined) return undefined;
  if (v instanceof Date) return { __type: "timestamp", ...Timestamp.fromDate(v).toJSON() };
  if (v instanceof Timestamp) return { __type: "timestamp", ...v.toJSON() };
  if (v && v.__sv) return v;
  if (Array.isArray(v)) return v.map(encode);
  if (isPlain(v)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = encode(x);
    return out;
  }
  return v;
}

function decode(v) {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    if (v.__type === "timestamp") return new Timestamp(v.seconds, v.nanoseconds);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = decode(x);
    return out;
  }
  return v;
}

export function serverTimestamp() { return { __sv: "serverTimestamp" }; }
export function increment(n) { return { __sv: "increment", n }; }

// ───────────── Requests (batched per tick) ─────────────

let queue = [];
let flushScheduled = false;

function call(op) {
  return new Promise((resolve, reject) => {
    queue.push({ op, resolve, reject });
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flush);
    }
  });
}

async function flush() {
  flushScheduled = false;
  while (queue.length) {
    const batch = queue.splice(0, 50);
    let res;
    try {
      res = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops: batch.map((b) => b.op) }),
      });
    } catch (e) {
      batch.forEach((b) => b.reject(fsError("unavailable", "Network error")));
      continue;
    }
    if (res.status === 401) {
      window.location.href = "/login?next=/terminal";
      batch.forEach((b) => b.reject(fsError("unauthenticated", "Signed out")));
      continue;
    }
    if (!res.ok) {
      if (res.status === 403) window.location.href = "/boot";
      batch.forEach((b) => b.reject(fsError("permission-denied", `Request refused (${res.status})`)));
      continue;
    }
    const { results } = await res.json();
    batch.forEach((b, i) => {
      const r = results[i];
      if (r && r.ok) b.resolve(r.value);
      else b.reject(fsError(r?.code || "internal", r?.message || "Server error"));
    });
  }
}

function fsError(code, message) {
  const e = new Error(message);
  e.code = code;
  e.name = "FirebaseError";
  return e;
}

// ───────────── References ─────────────

const DB = { type: "firestore" };
export function getFirestore() { return DB; }

class DocumentReference {
  constructor(path) {
    this.type = "document";
    this.path = path;
    this.id = path.split("/").pop();
  }
  get parent() { return new CollectionReference(this.path.split("/").slice(0, -1).join("/")); }
}

class CollectionReference {
  constructor(path) {
    this.type = "collection";
    this.path = path;
    this.id = path.split("/").pop();
    this._where = [];
    this._orderBy = [];
    this._limit = undefined;
  }
}

class Query {
  constructor(coll, w, o, l) {
    this.type = "query";
    this.path = coll.path;
    this._where = w;
    this._orderBy = o;
    this._limit = l;
  }
}

const joinPath = (base, segs) => [base, ...segs].filter(Boolean).join("/").replace(/^\/+|\/+$/g, "");
const autoId = () => {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => abc[b % 62]).join("");
};

export function doc(parent, ...segs) {
  const base = parent === DB ? "" : parent.path;
  if (parent !== DB && parent.type === "collection" && segs.length === 0) return new DocumentReference(`${base}/${autoId()}`);
  return new DocumentReference(joinPath(base, segs));
}

export function collection(parent, ...segs) {
  const base = parent === DB ? "" : parent.path;
  return new CollectionReference(joinPath(base, segs));
}

export function where(field, op, value) { return { kind: "where", clause: [field, op, value] }; }
export function orderBy(field, dir = "asc") { return { kind: "orderBy", clause: [field, dir] }; }
export function limit(n) { return { kind: "limit", n }; }

export function query(base, ...constraints) {
  const w = [...(base._where || [])];
  const o = [...(base._orderBy || [])];
  let l = base._limit;
  for (const c of constraints) {
    if (!c) continue;
    if (c.kind === "where") w.push(c.clause);
    else if (c.kind === "orderBy") o.push(c.clause);
    else if (c.kind === "limit") l = c.n;
  }
  return new Query(base, w, o, l);
}

// ───────────── Snapshots ─────────────

class DocumentSnapshot {
  constructor(raw) {
    this.id = raw.id;
    this.ref = new DocumentReference(raw.path);
    this._exists = !!raw.exists;
    this._data = raw.exists ? decode(raw.data) : undefined;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  exists() { return this._exists; }
  data() { return this._data === undefined ? undefined : cloneData(this._data); }
  get(field) {
    return String(field).split(".").reduce((o, k) => (o == null ? undefined : o[k]), this._data);
  }
}

// Copy data so callers cannot change the cached snapshot (keeps Timestamps).
function cloneData(v) {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(cloneData);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = cloneData(x);
    return out;
  }
  return v;
}

class QuerySnapshot {
  constructor(rawDocs, previous) {
    this.docs = rawDocs.map((r) => new DocumentSnapshot(r));
    this.size = this.docs.length;
    this.empty = this.docs.length === 0;
    this.metadata = { hasPendingWrites: false, fromCache: false };
    this._previous = previous;
    this._raw = rawDocs;
  }
  forEach(cb, thisArg) { this.docs.forEach(cb, thisArg); }
  docChanges() {
    const prev = new Map((this._previous || []).map((r, i) => [r.path, { r, i }]));
    const changes = [];
    this._raw.forEach((r, newIndex) => {
      const p = prev.get(r.path);
      const d = this.docs[newIndex];
      if (!p) changes.push({ type: "added", doc: d, oldIndex: -1, newIndex });
      else if (JSON.stringify(p.r.data) !== JSON.stringify(r.data)) changes.push({ type: "modified", doc: d, oldIndex: p.i, newIndex });
      prev.delete(r.path);
    });
    for (const { r, i } of prev.values()) changes.push({ type: "removed", doc: new DocumentSnapshot(r), oldIndex: i, newIndex: -1 });
    return changes;
  }
}

function readOp(ref) {
  if (ref.type === "document") return { op: "get", path: ref.path };
  return { op: "query", coll: ref.path, where: (ref._where || []).map(([f, o, v]) => [f, o, encode(v)]), orderBy: ref._orderBy || [], limit: ref._limit };
}

// ───────────── Reads ─────────────

export async function getDoc(ref) { return new DocumentSnapshot(await call(readOp(ref))); }
export async function getDocs(ref) { return new QuerySnapshot(await call(readOp(ref)), null); }

// ───────────── Writes ─────────────

async function write(op) {
  const v = await call(op);
  pokeListeners();
  return v;
}

export async function setDoc(ref, data, options) {
  await write({ op: "set", path: ref.path, data: encode(data), merge: !!(options && (options.merge || options.mergeFields)) });
}

export async function updateDoc(ref, fieldOrData, ...rest) {
  let data = fieldOrData;
  if (typeof fieldOrData === "string") {
    data = { [fieldOrData]: rest[0] };
    for (let i = 1; i < rest.length; i += 2) data[rest[i]] = rest[i + 1];
  }
  await write({ op: "update", path: ref.path, data: encode(data) });
}

export async function deleteDoc(ref) { await write({ op: "delete", path: ref.path }); }

export async function addDoc(coll, data) {
  const v = await write({ op: "add", coll: coll.path, data: encode(data) });
  return new DocumentReference(v.path);
}

// ───────────── Live listeners (polling) ─────────────

const listeners = new Set();
let timer = null;
let polling = false;

export function onSnapshot(ref, ...args) {
  let next, error;
  const fns = args.filter((a) => typeof a === "function");
  const obj = args.find((a) => a && typeof a === "object" && (a.next || a.error));
  next = fns[0] || obj?.next;
  error = fns[1] || obj?.error;
  const l = { ref, op: readOp(ref), next, error, last: null, lastRaw: null, active: true };
  listeners.add(l);
  pollOne(l);
  ensureTimer();
  return () => {
    l.active = false;
    listeners.delete(l);
  };
}

async function pollOne(l) {
  try {
    const value = await call(l.op);
    if (!l.active) return;
    const key = JSON.stringify(value);
    if (key === l.last) return;
    const prevRaw = l.lastRaw;
    l.last = key;
    l.lastRaw = value;
    if (l.ref.type === "document") l.next && l.next(new DocumentSnapshot(value));
    else l.next && l.next(new QuerySnapshot(value, prevRaw || []));
  } catch (e) {
    if (l.active && l.error) l.error(e);
    else if (l.active) console.warn("[terminal] listener error:", e.message);
  }
}

async function pollAll() {
  if (polling || !listeners.size) return;
  polling = true;
  try {
    await Promise.all([...listeners].map(pollOne));
  } finally {
    polling = false;
  }
}

function ensureTimer() {
  if (timer) return;
  const tick = async () => {
    await pollAll();
    timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : liveOk ? POLL_LIVE_MS : POLL_MS);
  };
  timer = setTimeout(tick, POLL_MS);
}

function pokeListeners() { setTimeout(pollAll, 50); }

// ───────────── Instant updates (Ably, RCD-style) ─────────────
// Cortana sends "this collection changed" on Ably channel 505th-live (no data). We re-load only the
// listeners on that collection straight away. Polling stays as the backup (slower while live works).
const POLL_LIVE_MS = 15000;
let liveOk = false;
let liveState = null; // null = not set up / signed out · true = connected · false = reconnecting (polling)
window.__terminalLive = () => liveState;
function topOf(l) { return String(l.op.path || l.op.coll || "").split("/")[0]; }
function pokeTopic(topic) {
  // Pages with their own API (e.g. Network Status) listen for this instead of reading the collection.
  try { window.dispatchEvent(new CustomEvent("terminal-live", { detail: topic })); } catch { /* old browser */ }
  for (const l of listeners) if (topOf(l) === topic) pollOne(l);
}
async function startLive(delay = 0) {
  if (typeof EventSource === "undefined") return;
  await new Promise((r) => setTimeout(r, delay));
  let t;
  try {
    const r = await fetch("/api/terminal/realtime", { credentials: "same-origin", cache: "no-store" });
    if (r.status === 503 || r.status === 401 || r.status === 403) return; // not set up / signed out: polling only
    if (!r.ok) throw new Error(String(r.status));
    t = await r.json();
  } catch {
    liveState = false;
    return startLive(Math.min(Math.max(delay * 2, 15000), 300000));
  }
  const es = new EventSource(`https://realtime.ably.io/sse?v=1.2&channels=${encodeURIComponent(t.channel)}&accessToken=${encodeURIComponent(t.token)}`);
  const renew = setTimeout(() => { es.close(); liveOk = false; startLive(); }, Math.max(60000, t.expires - Date.now() - 120000));
  es.onopen = () => { liveOk = true; liveState = true; };
  es.onmessage = (ev) => {
    try { const m = JSON.parse(ev.data); if (m && typeof m.name === "string") pokeTopic(m.name); } catch { /* ignore */ }
  };
  es.onerror = () => {
    liveState = false;
    if (es.readyState === 2) { clearTimeout(renew); liveOk = false; startLive(15000); }
  };
}
startLive(1500);
document.addEventListener("visibilitychange", () => { if (!document.hidden) pokeListeners(); });
