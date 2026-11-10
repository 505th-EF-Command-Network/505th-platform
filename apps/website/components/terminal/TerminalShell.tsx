"use client";

/**
 * Command Terminal frame: top bar (operator + SIGN OUT), grouped sidebar,
 * mobile drawer. Same look as the live admin panel, refined.
 */
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TERMINAL_NAV, findLink } from "./nav";

export type ShellUser = { name: string; roleLabel: string; avatar: string | null };

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-[rgba(0,217,255,0.6)] bg-transparent px-3.5 text-[10px] tracking-[2px] text-[#bebebe] transition hover:border-[#ef4444] hover:text-[#ef4444] focus-visible:border-[#ef4444] focus-visible:text-[#ef4444] focus-visible:outline-none ${className}`}
      >
        ⏻ SIGN OUT
      </button>
    </form>
  );
}

export default function TerminalShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname() || "/terminal";
  const here = findLink(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>(() => (here ? { [here.group.key]: true } : { personnel: true }));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isOverview = pathname === "/terminal";

  const sidebar = (
    <nav aria-label="Command Terminal" className="flex h-full flex-col overflow-y-auto py-4">
      <a
        href="/terminal"
        aria-current={isOverview ? "page" : undefined}
        className={`mb-1 flex items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-[13px] tracking-[1.5px] no-underline transition ${
          isOverview ? "border-[#00D9FF] bg-[rgba(0,217,255,0.07)] text-[#00D9FF]" : "border-transparent text-[#d8d8d8] hover:bg-[rgba(0,217,255,0.04)]"
        }`}
      >
        <span className="w-5 text-center" aria-hidden="true">
          ◫
        </span>
        COMMAND OVERVIEW
      </a>
      <hr className="mx-4 my-3 border-0 border-t border-[rgba(0,217,255,0.25)]" />
      {TERMINAL_NAV.map((g) => {
        const isOpen = !!open[g.key];
        const cur = here?.group.key === g.key;
        return (
          <div key={g.key}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`tg-${g.key}`}
              onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              className={`flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left text-[14px] tracking-[1.5px] transition hover:bg-[rgba(0,217,255,0.04)] focus-visible:bg-[rgba(0,217,255,0.06)] focus-visible:outline-none ${
                isOpen || cur ? "text-[#00D9FF]" : "text-[#d8d8d8]"
              }`}
            >
              <span className="w-5 text-center" aria-hidden="true">
                {g.icon}
              </span>
              {g.label}
              <span aria-hidden="true" className={`ml-auto text-[8px] transition-transform ${isOpen ? "rotate-90" : ""}`}>
                ▶
              </span>
            </button>
            <div id={`tg-${g.key}`} hidden={!isOpen} className="pl-8">
              {g.links.map((l) => {
                const active = here?.link.href === l.href;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 border-l-2 px-4 py-[7px] text-[13px] tracking-[1px] no-underline transition hover:bg-[rgba(0,217,255,0.04)] hover:text-[#e8e8e8] ${
                      active ? "border-[#00D9FF] bg-[rgba(0,217,255,0.05)] text-[#00D9FF]" : "border-transparent text-[#d0d0d0]"
                    }`}
                  >
                    {l.label}
                    {!l.ready && <span className="ml-auto border border-[#3c4a54] px-1 text-[8px] tracking-[1px] text-[#6B7B87]">SOON</span>}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
      <hr className="mx-4 my-3 border-0 border-t border-[rgba(0,217,255,0.25)]" />
      <a href="/profile" className="flex items-center gap-2.5 px-4 py-2 text-[12px] tracking-[1.5px] text-[#c0c0c0] no-underline hover:text-[#e0e0e0]">
        <span className="w-5 text-center" aria-hidden="true">
          ☺
        </span>
        MY SERVICE RECORD
      </a>
      <a href="/home" className="flex items-center gap-2.5 px-4 py-2 text-[12px] tracking-[1.5px] text-[#c0c0c0] no-underline hover:text-[#e0e0e0]">
        <span className="w-5 text-center" aria-hidden="true">
          ⌂
        </span>
        PUBLIC WEBSITE
      </a>
    </nav>
  );

  return (
    <div className="relative z-[1] min-h-screen">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999] bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.12),rgba(0,0,0,0.12)_1px,transparent_1px,transparent_2px)]" />

      <header className="sticky top-0 z-[100] flex h-[52px] items-center justify-between border-b border-[rgba(0,217,255,0.4)] bg-[rgba(8,10,14,0.92)] px-5 backdrop-blur-md max-[600px]:px-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="hidden h-[38px] w-[38px] cursor-pointer items-center justify-center border border-[rgba(0,217,255,0.35)] bg-transparent text-xl text-[#00D9FF] max-[900px]:flex"
          >
            ☰
          </button>
          <a href="/terminal" className="flex items-center gap-3 no-underline">
            <img src="/images/logo.png" alt="" className="h-8 w-8 drop-shadow-[0_0_8px_rgba(0,217,255,0.5)]" />
            <span className="font-[Rajdhani,sans-serif] text-base font-bold tracking-[3px] text-[#00D9FF] [text-shadow:0_0_10px_rgba(0,217,255,0.5)] max-[600px]:hidden">
              505TH COMMAND TERMINAL
            </span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a href="/profile" className="flex items-center gap-2.5 text-right no-underline" title="My service record">
            <span className="max-[600px]:hidden">
              <span className="block text-xs tracking-[1px] text-[#e0e0e0]">{user.name}</span>
              <span className="block text-[9px] tracking-[3px] text-[#f9b93b]">{user.roleLabel.toUpperCase()}</span>
            </span>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-8 w-8 border border-[rgba(0,217,255,0.5)] object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center border border-[rgba(0,217,255,0.5)] text-[#00D9FF]">◉</span>
            )}
          </a>
          <SignOutButton />
        </div>
      </header>

      <div className="relative z-[1] flex min-h-[calc(100vh-52px)]">
        <aside className="sticky top-[52px] h-[calc(100vh-52px)] w-[250px] shrink-0 border-r border-[rgba(0,217,255,0.35)] bg-[rgba(8,10,14,0.95)] max-[900px]:hidden">
          {sidebar}
        </aside>

        {/* mobile drawer */}
        <div className={`fixed inset-0 z-[200] min-[901px]:hidden ${drawer ? "visible" : "pointer-events-none invisible"}`}>
          <div className={`absolute inset-0 bg-black/60 transition-opacity ${drawer ? "opacity-100" : "opacity-0"}`} onClick={() => setDrawer(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command Terminal navigation"
            className={`absolute bottom-0 left-0 top-0 w-[min(300px,85vw)] border-r-2 border-[#00D9FF] bg-[rgba(8,10,14,0.98)] transition-transform duration-300 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
          >
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-3 z-10 h-10 w-10 cursor-pointer border border-[rgba(0,217,255,0.5)] bg-transparent text-[#00D9FF]"
            >
              ✕
            </button>
            <div className="h-full pt-12">{sidebar}</div>
          </div>
        </div>

        <main className="min-w-0 flex-1 p-6 max-[600px]:p-3.5">{children}</main>
      </div>
    </div>
  );
}
