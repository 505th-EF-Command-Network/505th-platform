"use client";

/**
 * SiteShell v2 — shared navigation for every public page.
 *
 * Desktop (≥1024px): original 505th logo header, 72px icon rail with labels and
 * Desktop: expanded sidebar (approved option A, 2026-11-11) with in-place sections, « collapse to icons (remembered),
 * account + JOIN pinned at the bottom. Mobile: top bar + drawer, plus bottom tabs with a section sheet. Account pop-up (Discord login).
 * Mobile (<1024px): compact 56px top bar + "you are here" strip, and a slide-in
 * menu with an account card, numbered sections and a JOIN THE 505TH button.
 *
 * The header logo and footer keep the original live-site look through the
 * page's shell style set (`styles`). Links are plain <a> on purpose: each page
 * loads its own stylesheet, as on the live site.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import CmsApply from "@/components/CmsApply";
import { usePathname } from "next/navigation";
import type { ShellStyles } from "./shell-styles";
import { DISCORD_INVITE, NAV_SECTIONS, locate, type PanelKey } from "./nav-data";
import "./nav-v2.css";

const LOGIN_HREF = "/login";

type Me = null | { signedIn: true; name: string; role: string | null; avatar: string | null; terminal: boolean };

function Avatar({ me, size }: { me: NonNullable<Me>; size: number }) {
  return me.avatar ? (
    <img src={me.avatar} alt="" className="nav-hex object-cover" style={{ width: size - 4, height: size - 4 }} />
  ) : (
    <img src="/images/icons/Account.png" alt="" style={{ width: size / 2.4, height: size / 2.4 }} className="opacity-75" />
  );
}

function SignOut({ className }: { className: string }) {
  return (
    <form action="/api/auth/logout" method="post" className="contents">
      <button type="submit" className={className}>
        ⏻ SIGN OUT
      </button>
    </form>
  );
}

function DiscordIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 71 55" aria-hidden="true" className={`fill-white ${className}`}>
      <path d="M60 4.6A58 58 0 0 0 45.6 0l-1.8 3.7a54 54 0 0 0-16.2 0L25.8 0A58 58 0 0 0 11.4 4.6C2.3 18.1-.2 31.3 1 44.3a58 58 0 0 0 17.7 9l3.8-5.2a38 38 0 0 1-6-2.9l1.5-1.1a41.7 41.7 0 0 0 35.6 0l1.5 1.1a38 38 0 0 1-6 2.9l3.8 5.2a58 58 0 0 0 17.7-9C72 29.2 68 16.1 60 4.6zM23.7 36.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2z" />
    </svg>
  );
}

function Hex({ size, children, lit = false }: { size: number; children: ReactNode; lit?: boolean }) {
  return (
    <span
      className={`nav-hex flex shrink-0 items-center justify-center ${lit ? "bg-[#00D9FF] shadow-[0_0_10px_#00D9FF]" : "bg-[rgba(0,217,255,0.15)]"}`}
      style={{ width: size, height: size }}
    >
      <span className="nav-hex flex items-center justify-center bg-[#0d1317]" style={{ width: size - 4, height: size - 4 }}>
        {children}
      </span>
    </span>
  );
}

const acctBtn =
  "flex min-h-10 w-full items-center justify-center border border-[rgba(0,217,255,0.45)] text-[0.75rem] font-bold tracking-[2px] text-[#00D9FF] no-underline transition hover:bg-[rgba(0,217,255,0.08)] focus-visible:outline-2 focus-visible:outline-[#00D9FF]";

const sideRow =
  "relative flex min-h-11 items-center gap-3 border-l-[3px] border-transparent px-4 text-[0.82rem] font-bold tracking-[2px] text-[#A8B5BF] no-underline transition-colors hover:bg-[rgba(0,217,255,0.05)] hover:text-[#E8EEF2] focus-visible:bg-[rgba(0,217,255,0.06)] focus-visible:text-[#E8EEF2] focus-visible:outline-none cursor-pointer";
const tabBtn =
  "flex flex-col items-center justify-center gap-1 font-mono text-[0.55rem] font-bold tracking-[1px] text-[#6B7B87] no-underline active:bg-[rgba(0,217,255,0.08)] focus-visible:outline-2 focus-visible:outline-[#00D9FF]";
const sideOn = "!border-l-[#00D9FF] bg-[rgba(0,217,255,0.06)] !text-[#00D9FF]";

export default function SiteShell({ children, styles }: { children: ReactNode; styles: ShellStyles }) {
  const tw = (c: string) => c.split(" ").map((k) => (styles[k] ? `${k} ${styles[k]}` : k)).join(" ");
  const pathname = usePathname() || "/";
  const here = locate(pathname);
  const isHome = pathname === "/home" || pathname === "/";

  // desktop
  const [collapsed, setCollapsed] = useState(false);
  const [groups, setGroups] = useState<PanelKey[]>(here.section ? [here.section.key] : []);
  const [sheet, setSheet] = useState<PanelKey | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [tip, setTip] = useState<{ top: number; title: string; sub: string } | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const acctRef = useRef<HTMLDivElement>(null);
  // mobile
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<PanelKey | null>(here.section?.key ?? null);
  const [barHidden, setBarHidden] = useState(false);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  // signed-in state (stays signed in until Sign out or the 7-day session ends)
  const [me, setMe] = useState<Me>(null);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.signedIn ? d : null))
      .catch(() => setMe(null));
  }, []);

  // content shift + enable its transition only after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("nav-ready")));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    try { if (localStorage.getItem("nav-collapsed") === "1") setCollapsed(true); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    document.body.classList.toggle("nav-collapsed", collapsed);
    try { localStorage.setItem("nav-collapsed", collapsed ? "1" : "0"); } catch { /* storage blocked */ }
    return () => document.body.classList.remove("nav-collapsed");
  }, [collapsed]);

  // outside click / Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (acctOpen && !acctRef.current?.contains(t) && !(t as Element).closest?.("[data-acct-btn]")) setAcctOpen(false);
      if (sheet && !sheetRef.current?.contains(t) && !(t as Element).closest?.("[data-tabbar]")) setSheet(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSheet(null);
      setAcctOpen(false);
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [acctOpen, sheet]);

  // mobile: lock scroll + focus close button while menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    if (menuOpen) setTimeout(() => menuCloseRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // mobile: hide bar on scroll down, show again on any scroll up
  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const y = window.pageYOffset;
      if (y <= 80 || y < last - 2) setBarHidden(false);
      else if (y > last + 2) setBarHidden(true);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showTip = (el: HTMLElement, title: string, sub: string) => {
    const r = el.getBoundingClientRect();
    setTip({ top: r.top + r.height / 2 - 18, title, sub });
  };
  const tipProps = (title: string, sub: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(e.currentTarget, title, sub),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e.currentTarget, title, sub),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });

  const toggleGroup = (k: PanelKey) => {
    if (collapsed) { setCollapsed(false); setGroups([k]); setTip(null); return; }
    setGroups((g) => (g.includes(k) ? g.filter((x) => x !== k) : [...g, k]));
  };
  const sheetSection = sheet ? NAV_SECTIONS.find((x) => x.key === sheet)! : null;

  return (
    <>
      {/* ───────── DESKTOP (≥1024px) ───────── */}
      <a href="/home" className={tw("desktop-logo-header")}>
        <img src="/images/logo.png" alt="505th Logo" />
        <span className={tw("hdr-title")}>505TH EXPEDITIONARY FORCE</span>
      </a>

      <nav
        ref={railRef}
        aria-label="Site navigation"
        className={`fixed bottom-0 left-0 top-[72px] z-[300] hidden flex-col border-r border-[rgba(0,217,255,0.18)] bg-linear-to-b from-[#0d1317] to-[#080b0e] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none min-[1024px]:flex ${
          collapsed ? "w-[72px]" : "w-[248px]"
        }`}
      >
        <div className="nav-scanlines pointer-events-none absolute inset-0" />
        <button
          type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          onClick={() => { setCollapsed((c) => !c); setTip(null); }}
          className={`relative flex h-11 shrink-0 items-center border-b border-b-[rgba(0,217,255,0.12)] bg-transparent font-mono text-[0.6rem] tracking-[2px] text-[#6B7B87] hover:text-[#00D9FF] focus-visible:text-[#00D9FF] focus-visible:outline-none ${collapsed ? "justify-center" : "justify-between px-4"}`}
          {...(collapsed ? tipProps("EXPAND", "Show page names") : {})}
        >
          {!collapsed && <span>NAVIGATION</span>}
          <span aria-hidden="true" className="text-[0.95rem] text-[#00D9FF]">{collapsed ? "»" : "«"}</span>
        </button>

        <div className="relative flex-1 overflow-y-auto overflow-x-hidden py-2">
          <a
            href="/home"
            aria-current={isHome ? "page" : undefined}
            className={`${sideRow} ${collapsed ? "justify-center px-0" : ""} ${isHome ? sideOn : ""}`}
            {...(collapsed ? tipProps("HOME", "00 // Main page") : {})}
          >
            <img src="/images/icons/Home.png" alt="" className={`h-6 w-6 shrink-0 ${isHome ? "opacity-100" : "opacity-60"}`} />
            {!collapsed && <span className="truncate">HOME</span>}
          </a>

          {NAV_SECTIONS.map((sec) => {
            const open = !collapsed && groups.includes(sec.key);
            const cur = here.section?.key === sec.key;
            return (
              <div key={sec.key}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`sg-${sec.key}`}
                  onClick={() => toggleGroup(sec.key)}
                  className={`${sideRow} w-full bg-transparent text-left ${collapsed ? "justify-center px-0" : ""} ${cur ? sideOn : ""}`}
                  {...(collapsed ? tipProps(sec.label, `${sec.code} // ${sec.items.length} pages`) : {})}
                >
                  <img src={sec.icon} alt="" className={`h-6 w-6 shrink-0 ${cur ? "opacity-100" : "opacity-60"}`} />
                  {!collapsed && (
                    <>
                      <span className="truncate">{sec.label}</span>
                      <span aria-hidden="true" className="ml-auto font-mono text-[0.85rem] text-[#3d5560]">{open ? "−" : "+"}</span>
                    </>
                  )}
                </button>
                {!collapsed && (
                  <div id={`sg-${sec.key}`} className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <ul className="m-0 list-none overflow-hidden p-0" inert={!open}>
                      {sec.items.map((i) => {
                        const on = i.href === pathname;
                        return (
                          <li key={i.href}>
                            <a
                              href={i.href}
                              aria-current={on ? "page" : undefined}
                              className={`flex min-h-9 items-center gap-2.5 py-1.5 pl-[50px] pr-3 text-[0.88rem] font-semibold tracking-[0.6px] no-underline transition before:h-1.5 before:w-1.5 before:shrink-0 before:border hover:text-[#E8EEF2] focus-visible:text-[#E8EEF2] focus-visible:outline-none ${
                                on ? "text-[#E8EEF2] before:border-[#00D9FF] before:bg-[#00D9FF]" : "text-[#A8B5BF] before:border-[#3d5560]"
                              }`}
                            >
                              <span className="truncate">{i.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={`relative flex shrink-0 gap-2 border-t border-t-[rgba(0,217,255,0.12)] p-3 ${collapsed ? "flex-col items-center" : "items-center"}`}>
          <button
            type="button"
            data-acct-btn
            aria-label="Account"
            aria-expanded={acctOpen}
            onClick={() => { setAcctOpen((o) => !o); setTip(null); }}
            className={`flex min-w-0 items-center gap-2 bg-transparent text-left ${collapsed ? "" : "flex-1"} focus-visible:outline-2 focus-visible:outline-[#00D9FF]`}
            {...(collapsed ? tipProps("ACCOUNT", me ? `${me.name} // signed in` : "Guest // not signed in") : {})}
          >
            <Hex size={34} lit={acctOpen || !!me}>
              {me ? <Avatar me={me} size={34} /> : <img src="/images/icons/Account.png" alt="" className="h-4 w-4 opacity-75" />}
            </Hex>
            {!collapsed && (
              <span className="min-w-0">
                <b className="block truncate text-[0.78rem] tracking-[1px] text-[#E8EEF2]">{me ? me.name : "SIGN IN"}</b>
                <small className={`block font-mono text-[0.55rem] tracking-[1.5px] ${me ? "text-[#4ee68a]" : "text-[#FFD700]"}`}>{me ? "● SIGNED IN" : "● GUEST"}</small>
              </span>
            )}
          </button>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex shrink-0 items-center justify-center gap-1.5 border border-[#6B8235] bg-[#4A5D23] font-bold tracking-[2px] text-[#E8EEF2] no-underline hover:brightness-125 focus-visible:outline-2 focus-visible:outline-[#00D9FF] ${collapsed ? "h-10 w-10" : "h-9 px-3 text-[0.72rem]"}`}
            {...(collapsed ? tipProps("JOIN THE 505TH", "Opens Discord") : {})}
            aria-label={collapsed ? "Join the 505th on Discord" : undefined}
          >
            <img src="/images/icons/Join Us.png" alt="" className="h-[18px] w-[18px]" />
            {!collapsed && "JOIN"}
          </a>
        </div>
      </nav>

      {/* collapsed-rail tooltip */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed left-20 z-[400] hidden whitespace-nowrap border border-[rgba(0,217,255,0.35)] bg-[rgba(8,10,14,0.96)] px-2.5 py-[5px] text-[0.68rem] font-bold tracking-[2px] text-[#00D9FF] transition-[opacity,transform] duration-100 min-[1024px]:block ${
          tip && collapsed ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
        }`}
        style={{ top: tip?.top ?? 0 }}
      >
        {tip?.title}
        <small className="block font-mono text-[0.55rem] font-normal tracking-[1px] text-[#6B7B87]">{tip?.sub}</small>
      </div>

      {/* account pop-up */}
      <div
        ref={acctRef}
        role="dialog"
        aria-label="Account"
        className={`fixed bottom-3 ${collapsed ? "left-20" : "left-[256px]"} z-[400] hidden w-[280px] border border-[rgba(0,217,255,0.4)] bg-linear-to-b from-[#141B1F] to-[#0A0E12] p-4 shadow-[0_0_30px_rgba(0,217,255,0.12),0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-200 min-[1024px]:block ${
          acctOpen ? "visible translate-y-0 opacity-100" : "invisible translate-y-1.5 opacity-0"
        }`}
      >
        <i className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#00D9FF]" />
        <i className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#00D9FF]" />
        {me ? (
          <>
            <div className="mb-3.5 flex items-center gap-3">
              <Hex size={46} lit>
                <Avatar me={me} size={46} />
              </Hex>
              <div className="min-w-0">
                <b className="block truncate text-[0.9rem] tracking-[1px] text-[#E8EEF2]">{me.name}</b>
                <small className="block font-mono text-[0.6rem] tracking-[1.5px] text-[#4ee68a]">● SIGNED IN{me.role ? ` · ${me.role.toUpperCase()}` : ""}</small>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a href="/profile" className={acctBtn}>MY SERVICE RECORD</a>
              {me.terminal && <a href="/boot" className={acctBtn}>◈ COMMAND TERMINAL</a>}
              <SignOut className={`${acctBtn} cursor-pointer bg-transparent hover:!border-[#ef4444] hover:!text-[#ef4444]`} />
            </div>
          </>
        ) : (
          <>
            <div className="mb-3.5 flex items-center gap-3">
              <Hex size={46}>
                <img src="/images/icons/Account.png" alt="" className="h-5 w-5 opacity-75" />
              </Hex>
              <div>
                <b className="block text-[0.9rem] tracking-[2px] text-[#E8EEF2]">GUEST</b>
                <small className="block font-mono text-[0.6rem] tracking-[1.5px] text-[#FFD700]">● NOT SIGNED IN</small>
              </div>
            </div>
            <p className="mb-3 text-[0.82rem] font-medium leading-[1.45] text-[#A8B5BF]">
              Sign in with Discord to see your service record, rank and the Command Terminal.
            </p>
            <a
              href={LOGIN_HREF}
              className="flex min-h-[42px] items-center justify-center gap-2 border border-[#7b86ff] bg-[#5865F2] text-[0.78rem] font-bold tracking-[2px] text-white no-underline hover:shadow-[0_0_14px_rgba(88,101,242,0.5)] hover:brightness-110"
            >
              <DiscordIcon className="h-3.5 w-[18px]" />
              LOGIN WITH DISCORD
            </a>
          </>
        )}
      </div>

      {/* ───────── MOBILE (<1024px) ───────── */}
      <header
        className={`fixed inset-x-0 top-0 z-[1000] flex h-14 items-center justify-between border-b-2 border-[#00D9FF] bg-[rgba(10,14,18,0.96)] px-1.5 shadow-[0_2px_16px_rgba(0,217,255,0.18)] backdrop-blur-md transition-transform duration-200 min-[1024px]:hidden ${
          barHidden ? "-translate-y-[calc(100%+22px)]" : ""
        }`}
      >
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center border border-transparent bg-transparent text-[#00D9FF] active:border-[rgba(0,217,255,0.5)] active:bg-[rgba(0,217,255,0.12)] focus-visible:border-[rgba(0,217,255,0.5)] focus-visible:bg-[rgba(0,217,255,0.12)] focus-visible:outline-none"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h12" />
          </svg>
        </button>
        <a href="/home" aria-label="505th Expeditionary Force home" className="flex items-center gap-2 no-underline">
          <img src="/images/logo.png" alt="" className="h-[34px] w-[34px] drop-shadow-[0_0_8px_rgba(0,217,255,0.5)]" />
          <span className="whitespace-nowrap text-[1.05rem] font-bold tracking-[4px] text-[#00D9FF] [text-shadow:0_0_10px_rgba(0,217,255,0.45)]">505TH EF</span>
        </a>
        <a
          href={me ? "/profile" : LOGIN_HREF}
          aria-label={me ? "My service record" : "Account / Login"}
          className="flex h-11 w-11 items-center justify-center active:bg-[rgba(0,217,255,0.12)] focus-visible:bg-[rgba(0,217,255,0.12)] focus-visible:outline-none"
        >
          {me?.avatar ? <img src={me.avatar} alt="" className="nav-hex h-8 w-8 object-cover" /> : <img src="/images/icons/Account.png" alt="" className="h-6 w-6" />}
        </a>
      </header>
      <div
        aria-label="You are here"
        className={`fixed inset-x-0 top-14 z-[999] flex h-[22px] items-center gap-1.5 overflow-hidden whitespace-nowrap border-b border-[rgba(0,217,255,0.15)] bg-[rgba(20,27,31,0.95)] px-3.5 font-mono text-[0.66rem] tracking-[1.5px] text-[#6B7B87] transition-transform duration-200 min-[1024px]:hidden ${
          barHidden ? "-translate-y-20" : ""
        }`}
      >
        <i className="not-italic text-[#00D9FF]">◈</i>
        {here.section ? (
          <>
            {here.section.label} // <b className="font-normal text-[#00D9FF]">{here.item!.label.toUpperCase()}</b>
          </>
        ) : (
          <b className="font-normal text-[#00D9FF]">HOME</b>
        )}
      </div>

      {/* mobile slide-in menu */}
      <div className={`fixed inset-0 z-[2000] min-[1024px]:hidden ${menuOpen ? "visible" : "pointer-events-none invisible"}`}>
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)}
        />
        <nav
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={`absolute bottom-0 left-0 top-0 flex w-[min(420px,92vw)] flex-col overflow-hidden border-r-2 border-[#00D9FF] bg-linear-to-b from-[#141B1F] to-[#0A0E12] shadow-[8px_0_40px_rgba(0,217,255,0.15)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
            menuOpen ? "translate-x-0" : "-translate-x-[102%]"
          }`}
        >
          <div className="nav-scanlines pointer-events-none absolute inset-0" />
          <div className="relative flex items-center gap-3 border-b border-[rgba(0,217,255,0.2)] px-4 pb-3.5 pt-4">
            <img src="/images/logo.png" alt="" className="h-9 w-9 drop-shadow-[0_0_10px_rgba(0,217,255,0.5)] min-[421px]:h-11 min-[421px]:w-11" />
            <div className="min-w-0 flex-1">
              <h2 className="m-0 whitespace-nowrap text-[0.9rem] font-bold leading-tight tracking-[2px] text-[#00D9FF] [text-shadow:0_0_12px_rgba(0,217,255,0.5)] min-[421px]:text-[1.05rem] min-[421px]:tracking-[3px]">
                COMMAND TERMINAL
              </h2>
              <p className="mt-[3px] font-mono text-[0.6rem] tracking-[2px] text-[#6B7B87]">505TH EXPEDITIONARY FORCE</p>
            </div>
            <button
              ref={menuCloseRef}
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center border border-[rgba(0,217,255,0.5)] bg-transparent text-[1.2rem] text-[#00D9FF] active:bg-[rgba(0,217,255,0.15)] focus-visible:bg-[rgba(0,217,255,0.15)] focus-visible:outline-none"
            >
              ✕
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-3.5 pb-2.5 pt-3.5">
            {me ? (
              <div className="mb-4 border border-[rgba(0,217,255,0.25)] bg-[rgba(10,14,18,0.7)] p-3">
                <div className="mb-3 flex items-center gap-3">
                  <Hex size={42} lit>
                    <Avatar me={me} size={42} />
                  </Hex>
                  <span className="min-w-0">
                    <b className="block truncate text-[0.85rem] tracking-[1px] text-[#E8EEF2]">{me.name}</b>
                    <small className="block whitespace-nowrap font-mono text-[0.6rem] tracking-[1.5px] text-[#4ee68a]">● SIGNED IN{me.role ? ` · ${me.role.toUpperCase()}` : ""}</small>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href="/profile" className={`${acctBtn} min-h-11`}>PROFILE</a>
                  {me.terminal ? <a href="/boot" className={`${acctBtn} min-h-11`}>TERMINAL</a> : <span />}
                  <SignOut className={`${acctBtn} col-span-2 min-h-11 cursor-pointer bg-transparent active:!border-[#ef4444] active:!text-[#ef4444]`} />
                </div>
              </div>
            ) : (
            <div className="mb-4 flex items-center gap-3 border border-[rgba(0,217,255,0.25)] bg-[rgba(10,14,18,0.7)] p-3">
                <Hex size={42}>
                  <img src="/images/icons/Account.png" alt="" className="h-5 w-5 opacity-70" />
                </Hex>
                <span>
                  <b className="block text-[0.8rem] tracking-[2px] text-[#E8EEF2]">GUEST</b>
                  <small className="block whitespace-nowrap font-mono text-[0.6rem] tracking-[1.5px] text-[#FFD700]">● NOT SIGNED IN</small>
                </span>
                <a
                  href={LOGIN_HREF}
                  className="ml-auto flex min-h-10 items-center gap-1.5 whitespace-nowrap border border-[#7b86ff] bg-[#5865F2] px-3 text-[0.72rem] font-bold tracking-[1.5px] text-white no-underline active:brightness-125"
                >
                  <DiscordIcon className="h-3 w-4" />
                  LOGIN
                </a>
              </div>
            )}

            <div className="mx-0.5 mb-2 flex items-center gap-2 font-mono text-[0.6rem] tracking-[2px] text-[#6B7B87] after:h-px after:flex-1 after:bg-linear-to-r after:from-[rgba(0,217,255,0.25)] after:to-transparent">
              NAVIGATION
            </div>

            <a
              href="/home"
              aria-current={isHome ? "page" : undefined}
              className={`mb-1.5 flex min-h-[54px] items-center gap-3 border border-[rgba(0,217,255,0.1)] border-l-[3px] px-3 text-[0.95rem] font-bold tracking-[2.5px] text-[#E8EEF2] no-underline active:bg-[rgba(0,217,255,0.1)] ${
                isHome ? "border-l-[#00D9FF] bg-linear-to-r from-[rgba(0,217,255,0.12)] to-[rgba(28,37,41,0.55)]" : "border-l-transparent bg-[rgba(28,37,41,0.55)]"
              }`}
            >
              <span className={`w-[18px] font-mono text-[0.62rem] tracking-[1px] ${isHome ? "text-[#00D9FF]" : "text-[#6B7B87]"}`}>00</span>
              <img src="/images/icons/Home.png" alt="" className="h-6 w-6 opacity-85" />
              HOME
            </a>

            {NAV_SECTIONS.map((s) => {
              const open = openGroup === s.key;
              const cur = here.section?.key === s.key;
              return (
                <div key={s.key} className="mb-1.5">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`mm-${s.key}`}
                    onClick={() => setOpenGroup(open ? null : s.key)}
                    className={`flex min-h-[54px] w-full cursor-pointer items-center gap-3 border border-l-[3px] px-3 text-left text-[0.95rem] font-bold tracking-[2.5px] text-[#E8EEF2] active:bg-[rgba(0,217,255,0.1)] focus-visible:outline-none ${
                      open ? "border-[rgba(0,217,255,0.35)]" : "border-[rgba(0,217,255,0.1)]"
                    } ${cur ? "border-l-[#00D9FF] bg-linear-to-r from-[rgba(0,217,255,0.12)] to-[rgba(28,37,41,0.55)]" : "border-l-transparent bg-[rgba(28,37,41,0.55)]"}`}
                  >
                    <span className={`w-[18px] font-mono text-[0.62rem] tracking-[1px] ${cur ? "text-[#00D9FF]" : "text-[#6B7B87]"}`}>{s.code}</span>
                    <img src={s.icon} alt="" className="h-6 w-6 opacity-85" />
                    {s.label}
                    <span className="ml-auto font-mono text-[0.62rem] tracking-[1px] text-[#6B7B87]">{s.items.length}</span>
                    <span className={`w-[18px] text-center text-[0.8rem] text-[#00D9FF] transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                  </button>
                  <div id={`mm-${s.key}`} className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <ul className="relative m-0 list-none border border-t-0 border-[rgba(0,217,255,0.35)] bg-[rgba(10,14,18,0.75)] py-1 pb-1.5 pl-[18px] before:absolute before:bottom-3.5 before:left-[23px] before:top-0 before:w-px before:bg-[rgba(0,217,255,0.25)]">
                        {s.items.map((i) => {
                          const curItem = i.href === pathname;
                          return (
                            <li key={i.href}>
                              <a
                                href={i.href}
                                aria-current={curItem ? "page" : undefined}
                                className={`relative flex min-h-11 items-center pl-[22px] pr-3 text-[0.9rem] font-semibold tracking-[1.2px] no-underline before:absolute before:left-[5px] before:top-1/2 before:h-px before:w-2.5 before:bg-[rgba(0,217,255,0.35)] active:bg-[rgba(0,217,255,0.08)] active:text-[#00D9FF] ${
                                  curItem ? "text-[#00D9FF] [text-shadow:0_0_8px_rgba(0,217,255,0.45)]" : "text-[#A8B5BF]"
                                }`}
                              >
                                {i.label}
                                {curItem && (
                                  <span className="ml-auto bg-[#00D9FF] px-1.5 py-0.5 font-mono text-[0.55rem] tracking-[1.5px] text-[#0A0E12] [text-shadow:none]">YOU ARE HERE</span>
                                )}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative border-t border-[rgba(0,217,255,0.2)] bg-[rgba(10,14,18,0.85)] px-3.5 pb-3.5 pt-3">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2.5 border border-[#6B8235] bg-[#4A5D23] text-[0.95rem] font-bold tracking-[3px] text-[#E8EEF2] no-underline shadow-[0_0_18px_rgba(107,130,53,0.35)] active:brightness-125"
            >
              <img src="/images/icons/Join Us.png" alt="" className="h-[22px] w-[22px]" />
              JOIN THE 505TH
            </a>
            <div className="mt-2.5 flex justify-between font-mono text-[0.55rem] tracking-[1.5px] text-[#4b5a65]">
              <span>
                CLASSIFICATION: <b className="font-normal text-[#7FFF7F]">UNCLASSIFIED</b>
              </span>
              <span>NAV v2.0</span>
            </div>
          </div>
        </nav>
      </div>

      {/* mobile bottom tabs + section sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={sheetSection ? sheetSection.label : "Section"}
        className={`fixed inset-x-0 bottom-[58px] z-[1001] border-t-2 border-[#00D9FF] bg-linear-to-b from-[#141B1F] to-[#0A0E12] px-3 pb-2 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.55)] transition-transform duration-200 motion-reduce:transition-none min-[1024px]:hidden ${
          sheetSection ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+60px)]"
        }`}
      >
        {sheetSection && (
          <>
            <div className="mb-1 flex items-center justify-between font-mono text-[0.6rem] tracking-[2px] text-[#6B7B87]">
              <span>{sheetSection.code} // {sheetSection.label}</span>
              <button type="button" aria-label="Close" onClick={() => setSheet(null)} className="h-9 w-9 bg-transparent text-[1rem] text-[#00D9FF]">✕</button>
            </div>
            <ul className="m-0 max-h-[55vh] list-none overflow-y-auto p-0">
              {sheetSection.items.map((i) => {
                const on = i.href === pathname;
                return (
                  <li key={i.href}>
                    <a
                      href={i.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex min-h-12 items-center border-b border-[rgba(0,217,255,0.1)] px-2 text-[0.95rem] font-semibold tracking-[0.8px] no-underline active:bg-[rgba(0,217,255,0.08)] ${on ? "text-[#00D9FF]" : "text-[#E8EEF2]"}`}
                    >
                      {i.label}
                      {on && <span className="ml-auto bg-[#00D9FF] px-1.5 py-0.5 font-mono text-[0.55rem] tracking-[1.5px] text-[#0A0E12]">HERE</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <nav
        data-tabbar
        aria-label="Site sections"
        className="fixed inset-x-0 bottom-0 z-[1002] grid h-[58px] grid-cols-5 border-t border-[rgba(0,217,255,0.25)] bg-[rgba(8,11,14,0.97)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md min-[1024px]:hidden"
      >
        <a href="/home" aria-current={isHome ? "page" : undefined} className={`${tabBtn} ${isHome ? "text-[#00D9FF]" : ""}`}>
          <img src="/images/icons/Home.png" alt="" className={`h-[22px] w-[22px] ${isHome ? "" : "opacity-60"}`} />HOME
        </a>
        {NAV_SECTIONS.map((sec) => {
          const on = sheet === sec.key || (!sheet && here.section?.key === sec.key);
          return (
            <button
              key={sec.key}
              type="button"
              aria-expanded={sheet === sec.key}
              onClick={() => setSheet(sheet === sec.key ? null : sec.key)}
              className={`${tabBtn} bg-transparent ${on ? "text-[#00D9FF]" : ""}`}
            >
              <img src={sec.icon} alt="" className={`h-[22px] w-[22px] ${on ? "" : "opacity-60"}`} />
              {sec.key === "resources" ? "INFO" : sec.short}
            </button>
          );
        })}
        <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={`${tabBtn} text-[#9fb36a]`}>
          <img src="/images/icons/Join Us.png" alt="" className="h-[22px] w-[22px] opacity-85" />JOIN
        </a>
      </nav>

      {children}
      <CmsApply />

      <footer className={tw("page-footer")}>
        <p>© 2026 505th Expeditionary Force • 505th Dev Team</p>
      </footer>
    </>
  );
}
