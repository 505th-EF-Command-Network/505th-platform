import { Oob } from "./pages/Oob";
import { Recruit } from "./pages/Recruit";
import { Tickets } from "./pages/Tickets";
import { Send } from "./pages/Send";
import { Projects } from "./pages/Projects";
import { Settings } from "./pages/Settings";
import { Messages } from "./pages/Messages";
import { HubAccess } from "./pages/HubAccess";
import { Network } from "./pages/Network";
import { Notes } from "./pages/Notes";
import { Officers } from "./pages/Officers";
import { PolicyGate } from "./components/Policy";
import { UpdateBanner } from "./components/UpdateBanner";
import { alertKind, applySettings, isKey, mergeSettings, quietNow } from "./settings";
import { AwayBanner, Captions, CheatSheet, LockScreen } from "./components/Overlays";
import { useNotifier } from "./useNotifier";
import type { AppSettings } from "../../preload/api";
import { History } from "./pages/History";
import { Media } from "./pages/Media";
import { Guard } from "./components/Guard";
import { ConfirmHost } from "./components/Confirm";
import { Bct } from "./pages/Bct";
import { Aars } from "./pages/Aars";
import { Events } from "./pages/Events";
import { Attendance } from "./pages/Attendance";
import { Roster } from "./pages/Roster";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthState, HubPrefs, NetState, Overview } from "../../preload/api";
import { DEFAULT_DASH, Dashboard, type Dash } from "./components/Dashboard";
import { DEFAULT_NAV, PAGES, SideNav, type NavPrefs } from "./components/SideNav";
import { TopBar } from "./components/TopBar";
import type { StateKey } from "./ui";
import { useSummary } from "./useSummary";
import { FileWindow, Personnel } from "./pages/Personnel";
import logo from "../../../assets/logo.png";

/** Sign-in screens, then the app (H2: Dashboard + My Status + Staff Status). */
export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [net, setNet] = useState<NetState>({ state: "off", reason: null });

  useEffect(() => {
    void window.cn.auth.get().then((s) => s && setAuth(s));
    void window.cn.net.get().then((s) => s && setNet(s));
    const a = window.cn.auth.onChange(setAuth);
    const b = window.cn.net.onState(setNet);
    const c = window.cn.net.onTopic((t) => {
      if (t === "users") void window.cn.auth.retry(); // role / access changed (e.g. by Cortana) → re-check sign-in
    });
    return () => { a(); b(); c(); };
  }, []);

  if (auth.status === "loading") return <Screen icon="◷" title="LOADING…" />;
  if (auth.status === "waiting")
    return (
      <Screen icon="◉" title="WAITING FOR YOUR BROWSER" text="Allow the app on the website page that just opened. Then come back here.">
        <Btn onClick={() => void window.cn.auth.cancel()}>CANCEL</Btn>
      </Screen>
    );
  if (auth.status === "signed-out")
    return (
      <Screen icon="◈" title="COMMAND NETWORK" text="Sign in with the Discord account you use on the 505th website. Your browser opens; come back here when it says done." error={auth.error}>
        <Btn primary onClick={() => void window.cn.auth.login()}>◉ SIGN IN WITH DISCORD</Btn>
      </Screen>
    );
  if (auth.status === "offline")
    return (
      <Screen icon="⚠" color="#f59e0b" title="CAN'T REACH THE 505TH" text={auth.error}>
        <Btn onClick={() => void window.cn.auth.retry()}>⟳ TRY AGAIN</Btn>
      </Screen>
    );

  return <Shell net={net} />;
}

/** Signed in: top bar · side nav (customisable, collapsible, signed-in card) · page. Layout saved to the account. */
function Shell({ net }: { net: NetState }) {
  const { data, error, reload } = useSummary();
  const [ov, setOv] = useState<Overview | null>(null);
  // My Settings → "Open on: last page" (remembered on this PC).
  const [page, setPageRaw] = useState(() => { try { const o = localStorage.getItem("cn:openLast"); return o === "1" ? localStorage.getItem("cn:lastPage") || "dashboard" : o === "m" ? "panel-msg2" : "dashboard"; } catch { return "dashboard"; } });
  const setPage = useCallback((pg: string) => { setPageRaw(pg); try { localStorage.setItem("cn:lastPage", pg); } catch { /* storage off */ } }, []);
  // ✉ (top bar) and the Messages key open Messages; pressing again goes back to the page you were on.
  const beforeMsg = useRef("dashboard");
  const toggleMessages = useCallback(() => setPageRaw((cur) => {
    const next = cur === "panel-msg2" ? beforeMsg.current || "dashboard" : (beforeMsg.current = cur, "panel-msg2");
    try { localStorage.setItem("cn:lastPage", next); } catch { /* storage off */ }
    return next;
  }), []);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // 505th Software Use Policy — must be accepted before the app can be used (and again when it changes).
  const [policyOk, setPolicyOk] = useState<boolean | null>(null);
  useEffect(() => { void window.cn.hub.policy().then((r) => setPolicyOk(!!r && !("error" in r) ? r.accepted : true)).catch(() => setPolicyOk(true)); }, []);
  const [visited, setVisited] = useState<string[]>(["dashboard"]);
  // Remember the last 10 pages opened; older ones are unmounted to save memory.
  useEffect(() => setVisited((v) => (v.includes(page) ? v : [...v, page].slice(-10))), [page]);
  const [toast, setToast] = useState<string | null>(null);
  const [nav, setNav] = useState<NavPrefs | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [myFile, setMyFile] = useState(false);
  const [version, setVersion] = useState("");
  const saveT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<HubPrefs>({});
  const loadOv = useCallback(async () => {
    const r = await window.cn.hub.overview();
    if (r && !("error" in r)) {
      setOv(r);
      setNav((n) => n ?? { ...DEFAULT_NAV, ...(r.prefs?.nav ?? {}) });
      setDash((d) => d ?? (r.prefs?.dash?.length ? r.prefs.dash : DEFAULT_DASH));
      setSettings((s) => s ?? mergeSettings(r.prefs?.settings));
    }
  }, []);
  useEffect(() => {
    void loadOv();
    void window.cn.info().then((i) => i && setVersion(i.version));
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((x) => { if (["users", "attendance_events", "community_events", "tickets", "audit_logs", "bot_status"].includes(x)) { clearTimeout(t); t = setTimeout(() => void loadOv(), 600); } });
    const timer = setInterval(() => void loadOv(), 60_000);
    return () => { off(); clearTimeout(t); clearInterval(timer); };
  }, [loadOv]);
  /** Layout changes save to the account 800 ms after the last change. */
  const save = (patch: HubPrefs) => {
    pending.current = { ...pending.current, ...patch };
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => { const b = pending.current; pending.current = {}; void window.cn.hub.savePrefs(b).then((r) => r.error && setToast("Couldn't save layout: " + r.error)); }, 800);
  };
  const setStatus = async (s: StateKey) => {
    const r = await window.cn.hub.setStatus({ state: s });
    if (r.error) setToast(r.error); else void reload();
  };
  const refresh = () => { void reload(); void loadOv(); };
  // Apply settings (look, tray, start-up, global key) whenever they change.
  useEffect(() => { if (!settings) return; applySettings(settings); try { localStorage.setItem("cn:openLast", settings.openOn === "last" ? "1" : settings.openOn === "messages" ? "m" : "0"); } catch { /* storage off */ } }, [settings]);
  const changeSettings = (s: AppSettings) => { setSettings(s); save({ settings: s }); };
  useNotifier(data, ov, setPage);
  // Tray menu (right-click the tray icon): keep its badges / switches up to date, and act on its clicks.
  useEffect(() => {
    if (!data || !settings) return;
    void window.cn.tray.info({ name: data.me.name, role: data.me.role, msgs: data.alerts.filter((a) => !a.read && alertKind(a) === "message").length,
      tickets: ov?.counts.tickets ?? 0, dnd: quietNow(settings), startup: settings.startup });
  }, [data, ov, settings]);
  const setRef = useRef(settings); setRef.current = settings;
  useEffect(() => {
    const offP = window.cn.tray.onPage((p) => setPage(p));
    const offT = window.cn.tray.onToggle((w) => {
      const s = setRef.current; if (!s) return;
      changeSettings(w === "dnd" ? { ...s, notify: { ...s.notify, dnd: quietNow(s) ? "off" : "on" } } : { ...s, startup: !s.startup });
    });
    return () => { offP(); offT(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPage]);
  // ── Settings v2: Hub lock, cheat sheet, "while you were away" ──
  const [locked, setLocked] = useState(false);
  const [cheat, setCheat] = useState(false);
  const [away, setAway] = useState(0);
  const canLock = !!settings?.security.pinHash;
  const lockNow = useCallback(() => { if (setRef.current?.security.pinHash) setLocked(true); }, []);
  useEffect(() => {
    if (!settings || settings.security.lock === "off" || !canLock) return;
    const mins = Number(settings.security.lock);
    const offS = window.cn.app.onSleep(() => lockNow());
    const t = mins ? setInterval(() => void window.cn.app.sys().then((i) => { if (i && i.idleSecs >= mins * 60) lockNow(); }), 30_000) : undefined;
    return () => { offS(); if (t) clearInterval(t); };
  }, [settings, canLock, lockNow]);
  const unreadNow = data ? data.alerts.filter((a) => !a.read).length : 0;
  const leftAt = useRef<{ at: number; unread: number } | null>(null);
  useEffect(() => {
    const blur = () => { leftAt.current = { at: Date.now(), unread: unreadNow }; };
    const focus = () => { const l = leftAt.current; leftAt.current = null; if (l && setRef.current?.a11y.away && Date.now() - l.at > 120_000 && unreadNow > l.unread) setAway(unreadNow - l.unread); };
    addEventListener("blur", blur); addEventListener("focus", focus);
    return () => { removeEventListener("blur", blur); removeEventListener("focus", focus); };
  }, [unreadNow]);
  // My Shortcuts (palette / rail / filter live in the top bar and side menu).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "") || (e.target as HTMLElement)?.isContentEditable;
      const s = setRef.current;
      if (locked) return;
      if (isKey(e, "messages")) { e.preventDefault(); toggleMessages(); }
      else if (isKey(e, "refresh")) { e.preventDefault(); refresh(); }
      else if (isKey(e, "notes")) { e.preventDefault(); setPage("panel-notes"); }
      else if (isKey(e, "newNote")) { e.preventDefault(); setPage("panel-notes"); setTimeout(() => dispatchEvent(new CustomEvent("notes:new")), 150); }
      else if (isKey(e, "settings")) { e.preventDefault(); setPage("my-settings"); }
      else if (isKey(e, "lock")) { e.preventDefault(); if (canLock) lockNow(); else setToast("Set a Hub PIN first: Settings → Security"); }
      else if (isKey(e, "dnd") && s) { e.preventDefault(); changeSettings({ ...s, notify: { ...s.notify, dnd: quietNow(s) ? "off" : "on" } }); setToast(quietNow(s) ? "Do not disturb OFF" : "Do not disturb ON"); }
      else if (isKey(e, "help") && !typing) { e.preventDefault(); setCheat((c) => !c); }
      else if (s?.pageKeys && e.ctrlKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) { const pg = (nav ?? DEFAULT_NAV).pins[Number(e.key) - 1]; if (pg) { e.preventDefault(); setPage(pg); } }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (!data) return <Screen icon={error ? "⚠" : "◷"} color={error ? "#f59e0b" : undefined} title={error ? "CAN'T LOAD" : "LOADING…"} text={error ?? undefined}>{error && <Btn onClick={() => void reload()}>⟳ TRY AGAIN</Btn>}</Screen>;
  if (policyOk === false) return <PolicyGate onAccepted={() => setPolicyOk(true)} />;
  const navP = nav ?? DEFAULT_NAV;
  return (
    <div className="flex h-full flex-col">
      <Guard label="Top bar" small><TopBar sum={data} ov={ov} net={net} access={data.me.access} page={page === "dashboard" ? "Dashboard" : PAGES[page] ?? page} onPage={setPage} onRefresh={refresh} msgOpen={page === "panel-msg2"} onToggleMsg={toggleMessages} /></Guard>
      <UpdateBanner />
      {away > 0 && <AwayBanner count={away} onOpen={() => { setAway(0); setPage("alerts"); }} onClose={() => setAway(0)} />}
      <div className="flex min-h-0 flex-1">
        <SideNav sum={data} ov={ov} page={page} onPage={setPage} prefs={settings && settings.look.side !== "full" ? { ...navP, rail: true } : navP} onPrefs={(n) => { setNav(n); save({ nav: n }); }}
          onStatus={(s) => void setStatus(s)} onMyFile={() => setMyFile(true)} onSignOut={() => void window.cn.auth.logout()} version={version} />
        {/* Pages stay mounted after the first visit (hidden), so switching back is instant; live topics keep them fresh. */}
        {(visited.includes(page) ? visited : [...visited, page]).map((pg) => (
          <div key={pg} className={pg === page ? "contents" : "hidden"} aria-hidden={pg !== page}>
            <Guard label={pg === "dashboard" ? "Dashboard" : PAGES[pg] ?? "This page"}>{pg === "dashboard" ? <Dashboard sum={data} ov={ov} net={net} dash={dash ?? DEFAULT_DASH} onDash={(d) => { setDash(d); save({ dash: d }); }} onPage={setPage} onRefresh={refresh} />
          : pg === "panel-active" ? <Personnel me={data.me.role} />
          : pg === "panel-roster" ? <Roster me={data.me.role} />
          : pg === "panel-attendance" ? <Attendance onPage={setPage} />
          : pg === "panel-events" ? <Events onPage={setPage} />
          : pg === "panel-aar" ? <Aars me={data.me.name} />
          : pg === "panel-register" ? <Bct />
          : pg === "panel-att-history" ? <History me={data.me.role} />
          : pg === "panel-media" ? <Media />
          : pg === "panel-unitcards" ? <Oob />
          : pg === "panel-recruit-source" ? <Recruit />
          : pg === "panel-tickets" ? <Tickets me={data.me.role} />
          : pg === "panel-send" ? <Send />
          : pg === "panel-projects" ? <Projects />
          : pg === "panel-msg2" ? <Messages me={data.me.role} />
          : pg === "panel-hubaccess" ? <HubAccess />
          : pg === "panel-officers" ? <Officers />
          : pg === "panel-network" ? <Network />
          : pg === "panel-notes" ? <Notes />
          : pg.startsWith("my-") && pg !== "my-file" ? <Settings tab={pg} s={settings ?? mergeSettings(null)} onChange={changeSettings} onPage={setPage} sum={data} net={net} version={version} onLock={lockNow} onStatus={(x) => void setStatus(x)} pins={navP.pins} />
          : <ComingSoon title={PAGES[pg] ?? "This page"} onBack={() => setPage("dashboard")} />}</Guard>
          </div>))}
      </div>
      <ConfirmHost />
      <Captions />
      {cheat && settings && <CheatSheet s={settings} onClose={() => setCheat(false)} />}
      {locked && settings?.security.pinHash && <LockScreen pinHash={settings.security.pinHash} name={data.me.name} onUnlock={() => setLocked(false)} onSignOut={() => { setLocked(false); void window.cn.auth.logout(); }} />}
      {myFile && <FileWindow id={data.me.uid} me={data.me.role} onClose={() => setMyFile(false)} />}
      {error && <div role="status" className="fixed bottom-3 left-1/2 -translate-x-1/2 border border-amber bg-panel px-4 py-2 text-[12px] text-amber">⚠ {error} — showing the last data</div>}
      {toast && <div role="alert" className="fixed bottom-3 left-1/2 -translate-x-1/2 border border-bad bg-panel px-4 py-2 text-[12px] text-bad">{toast}</div>}
    </div>
  );
}

/** Page not built into the app yet — stays in the app (never sends you to the website). */
function ComingSoon(p: { title: string; onBack: () => void }) {
  return (
    <main className="grid min-w-0 flex-1 place-items-center p-6">
      <section className="rise w-[460px] max-w-full border border-cyan/30 bg-panel/90 p-8 text-center" style={{ borderTop: "3px solid #f59e0b" }}>
        <div className="text-[30px] text-amber" aria-hidden="true">◷</div>
        <h1 className="mt-1 font-head text-[22px] font-bold tracking-[4px] text-white">{p.title.toUpperCase()}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#aeb9c4]">Coming to the Command Network app soon. It's being built page by page.</p>
        <button type="button" onClick={p.onBack} className="mt-6 min-h-[44px] w-full border border-cyan/40 font-head text-[14px] font-bold tracking-[3px] text-cyan hover:bg-cyan/10">← BACK TO DASHBOARD</button>
      </section>
    </main>
  );
}

function Screen(p: { icon: string; title: string; text?: string; error?: string; color?: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="w-[460px] max-w-full border border-cyan/35 bg-panel/90 p-8 text-center" style={{ borderTop: `3px solid ${p.color ?? "#00d9ff"}` }} aria-live="polite">
        <img src={logo} alt="505th" className="mx-auto mb-3 h-20 w-20 object-contain" />
        <div className="text-[30px]" style={{ color: p.color ?? "#00d9ff" }} aria-hidden="true">{p.icon}</div>
        <h1 className="mt-1 font-head text-[22px] font-bold tracking-[4px]" style={{ color: p.color ?? "#fff" }}>{p.title}</h1>
        {p.text && <p className="mt-2 text-[14px] leading-relaxed text-[#aeb9c4]">{p.text}</p>}
        {p.error && <p role="alert" className="mt-4 border-l-[3px] border-bad bg-bad/10 px-3 py-2 text-left text-[13px] text-white">{p.error}</p>}
        <div className="mt-6 flex flex-col gap-2">{p.children}</div>
      </section>
    </main>
  );
}
function Btn(p: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={p.onClick}
      className={`min-h-[46px] cursor-pointer border font-head text-[14px] font-bold tracking-[3px] ${p.primary ? "border-[#7b86ff] bg-[#5865F2] text-white" : "border-cyan/40 bg-transparent text-cyan hover:bg-cyan/10"}`}>
      {p.children}
    </button>
  );
}
