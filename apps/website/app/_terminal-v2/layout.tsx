import type { Metadata } from "next";
import type { ReactNode } from "react";
import TerminalShell from "@/components/terminal/TerminalShell";
import { requireTerminal } from "@/lib/terminal/guard";
import "@/styles/tw/terminal.css";

export const metadata: Metadata = { title: "505th Command Terminal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const v = await requireTerminal();
  return <TerminalShell user={{ name: v.member.displayName, roleLabel: v.member.roleLabel, avatar: v.avatar }}>{children}</TerminalShell>;
}
