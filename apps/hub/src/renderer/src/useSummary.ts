import { useCallback, useEffect, useRef, useState } from "react";
import type { Summary } from "../../preload/api";

/** Topics on the 505th Net that change what the Dashboard shows. */
const TOPICS = new Set(["users", "presence_sessions", "community_events", "notifications", "bot_status", "attendance_events"]);

/** Loads /api/hub/summary, then reloads when the 505th Net signals a change (and every 2 min as a backup). */
export function useSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false), again = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      const r = await window.cn.hub.summary();
      if (r && "error" in r) setError(r.error);
      else if (r) { setData(r); setError(null); }
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void load(); }
    }
  }, []);
  useEffect(() => {
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = window.cn.net.onTopic((topic) => {
      if (!TOPICS.has(topic)) return;
      clearTimeout(t);
      t = setTimeout(() => void load(), 300); // several signals at once → one reload
    });
    const timer = setInterval(() => void load(), 120_000);
    return () => { off(); clearInterval(timer); clearTimeout(t); };
  }, [load]);
  return { data, error, reload: load };
}
