import type { StaffRow } from "../../../preload/api";
import { pageName, ukTime } from "../ui";

/** Right sidebar (approved mock): Messages (H3) on top, Staff Status at the bottom. */
export function RightBar(p: { staff: StaffRow[]; myUid: string }) {
  const groups = [
    { k: "online", label: "ONLINE", color: "#22e07a" },
    { k: "dnd", label: "DO NOT DISTURB", color: "#ff4d4d" },
    { k: "offline", label: "OFFLINE", color: "#4b5765" },
  ] as const;
  const on = p.staff.filter((s) => s.state !== "offline").length;
  return (
    <aside aria-label="Messages and staff status" className="flex w-[330px] shrink-0 flex-col border-l border-cyan/20 bg-gradient-to-b from-[#0a0e14] to-[#080b10]">
      <h2 className="hdr">✉ MESSAGES</h2>
      <div className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-dim">
        Messenger-style chats arrive in the next step (H3). For now use Messages on the website.
        <button type="button" onClick={() => void window.cn.openSite("panel-msg2")} className="mt-3 block border border-cyan/30 px-3 py-1.5 text-cyan">OPEN MESSAGES ↗</button>
      </div>
      <section aria-label="Staff status" className="flex max-h-[48%] flex-col border-t border-cyan/20">
        <h2 className="hdr">◉ STAFF STATUS <span className="ml-auto text-[11px] text-dim">{on} / {p.staff.length} ON</span></h2>
        <div className="overflow-auto px-3 pb-3">
          {groups.map((g) => {
            const rows = p.staff.filter((s) => s.state === g.k);
            if (!rows.length) return null;
            return (
              <div key={g.k}>
                <div className="px-0.5 pb-1 pt-2.5 text-[10.5px] tracking-[2px] text-dimmer">{g.label} · {rows.length}</div>
                {rows.map((s) => {
                  const what = g.k === "online" ? pageName(s.page) : g.k === "dnd" ? [s.until ? `until ${ukTime(s.until)}` : "", s.note].filter(Boolean).join(" · ") : "";
                  return (
                    <div key={s.uid} className="flex items-center gap-2.5 px-0.5 py-1.5 font-head text-[14px] font-semibold tracking-[.5px] text-[#d6dde6]">
                      <i className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: g.color }} />
                      <span className="min-w-0 flex-1 truncate">{s.name}{s.uid === p.myUid && <small className="ml-1 text-[10px] text-dimmer">(YOU)</small>}</span>
                      <small className="max-w-[120px] truncate font-mono text-[10.5px] font-normal text-dim">{what}</small>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
