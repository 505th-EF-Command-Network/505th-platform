import { useEffect, useState } from "react";
import type { AuthState, NetState } from "../../preload/api";
import { Dashboard } from "./components/Dashboard";
import { RightBar } from "./components/RightBar";
import { PAGES, SideNav } from "./components/SideNav";
import { TopBar } from "./components/TopBar";
import type { StateKey } from "./ui";
import { useSummary } from "./useSummary";
import { Personnel } from "./pages/Personnel";
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

/** Signed in: top bar · left nav · page · right sidebar (approved app layout). */
function Shell({ net }: { net: NetState }) {
  const { data, error, reload } = useSummary();
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState<string | null>(null);
  const setStatus = async (s: StateKey) => {
    const r = await window.cn.hub.setStatus({ state: s });
    if (r.error) setToast(r.error); else void reload();
  };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);
  if (!data) return <Screen icon={error ? "⚠" : "◷"} color={error ? "#f59e0b" : undefined} title={error ? "CAN'T LOAD" : "LOADING…"} text={error ?? undefined}>{error && <Btn onClick={() => void reload()}>⟳ TRY AGAIN</Btn>}</Screen>;
  return (
    <div className="flex h-full flex-col">
      <TopBar data={data} net={net} page={page === "dashboard" ? "Dashboard" : PAGES[page] ?? page} onStatus={(s) => void setStatus(s)} onSignOut={() => void window.cn.auth.logout()} />
      <div className="flex min-h-0 flex-1">
        <SideNav access={data.me.access} page={page} onPage={setPage} cortanaOk={data.system.cortana.online} />
        {page === "dashboard" ? <Dashboard data={data} onStatus={(s) => void setStatus(s)} onPage={setPage} />
          : page === "panel-active" ? <Personnel />
          : <ComingSoon title={PAGES[page] ?? "This page"} onBack={() => setPage("dashboard")} />}
        <RightBar staff={data.staff} myUid={data.me.uid} />
      </div>
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
