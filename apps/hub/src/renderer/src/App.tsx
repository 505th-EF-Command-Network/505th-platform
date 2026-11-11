import { Oob } from "./pages/Oob";
import { History } from "./pages/History";
import { Media } from "./pages/Media";
import { Guard } from "./components/Guard";
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
  const [page, setPage] = useState("dashboard");
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
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (!data) return <Screen icon={error ? "⚠" : "◷"} color={error ? "#f59e0b" : undefined} title={error ? "CAN'T LOAD" : "LOADING…"} text={error ?? undefined}>{error && <Btn onClick={() => void reload()}>⟳ TRY AGAIN</Btn>}</Screen>;
  const navP = nav ?? DEFAULT_NAV;
  return (
    <div className="flex h-full flex-col">
      <Guard label="Top bar" small><TopBar sum={data} ov={ov} net={net} access={data.me.access} page={page === "dashboard" ? "Dashboard" : PAGES[page] ?? page} onPage={setPage} onRefresh={refresh} /></Guard>
      <div className="flex min-h-0 flex-1">
        <SideNav sum={data} ov={ov} page={page} onPage={setPage} prefs={navP} onPrefs={(n) => { setNav(n); save({ nav: n }); }}
          onStatus={(s) => void setStatus(s)} onMyFile={() => setMyFile(true)} onSignOut={() => void window.cn.auth.logout()} version={version} />
        <Guard key={page} label={page === "dashboard" ? "Dashboard" : PAGES[page] ?? "This page"}>{page === "dashboard" ? <Dashboard sum={data} ov={ov} net={net} dash={dash ?? DEFAULT_DASH} onDash={(d) => { setDash(d); save({ dash: d }); }} onPage={setPage} onRefresh={refresh} />
          : page === "panel-active" ? <Personnel me={data.me.role} />
          : page === "panel-roster" ? <Roster me={data.me.role} />
          : page === "panel-attendance" ? <Attendance onPage={setPage} />
          : page === "panel-events" ? <Events onPage={setPage} />
          : page === "panel-aar" ? <Aars me={data.me.name} />
          : page === "panel-register" ? <Bct />
          : page === "panel-att-history" ? <History me={data.me.role} />
          : page === "panel-media" ? <Media />
          : page === "panel-unitcards" ? <Oob />
          : <ComingSoon title={PAGES[page] ?? "This page"} onBack={() => setPage("dashboard")} />}</Guard>
      </div>
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
