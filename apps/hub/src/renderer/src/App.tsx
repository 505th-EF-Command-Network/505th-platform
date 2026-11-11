import { useEffect, useState } from "react";
import type { AuthState, NetState } from "../../preload/api";
import logo from "../../../assets/logo.png";

/** H1: sign-in screens + signed-in check (who you are, your access, 505th Net status). */
export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [net, setNet] = useState<NetState>({ state: "off", reason: null });
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    void window.cn.auth.get().then((s) => s && setAuth(s));
    void window.cn.net.get().then((s) => s && setNet(s));
    const a = window.cn.auth.onChange(setAuth);
    const b = window.cn.net.onState(setNet);
    const c = window.cn.net.onTopic((t) => {
      setLast(`${t} · ${new Date().toLocaleTimeString("en-GB")}`);
      if (t === "users") void window.cn.auth.retry(); // rank / role changed (e.g. by Cortana) → reload me
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

  const u = auth.user;
  const on = Object.entries(u.access).filter(([, v]) => v).length;
  const netC = net.state === "live" ? "#22e07a" : net.state === "connecting" ? "#f59e0b" : "#ff4d4d";
  return (
    <Screen icon="✓" color="#22e07a" title="ACCESS GRANTED" text={`Welcome, ${u.name}.`}>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-left text-[13px]">
        <dt className="text-dim">ROLE</dt><dd className="text-white uppercase">{u.role}</dd>
        <dt className="text-dim">DEVICE</dt><dd className="text-white">{u.deviceName}</dd>
        <dt className="text-dim">ACCESS</dt><dd className="text-white">{on} TERMINAL ITEMS</dd>
        <dt className="text-dim">505TH NET</dt><dd style={{ color: netC }}>● {net.state.toUpperCase()}{net.reason ? ` — ${net.reason}` : ""}</dd>
        <dt className="text-dim">LAST SIGNAL</dt><dd className="text-white">{last || "—"}</dd>
      </dl>
      <p className="mt-4 text-[12px] text-dim">Dashboard, messages and alerts arrive in the next step (H2).</p>
      <Btn onClick={() => void window.cn.auth.logout()}>⏻ SIGN OUT</Btn>
    </Screen>
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
