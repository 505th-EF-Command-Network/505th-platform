import { Component, type ReactNode } from "react";

/** Safety net: if one part of the app crashes, show what broke + a reload button instead of a blank window. */
export class Guard extends Component<{ children: ReactNode; label?: string; small?: boolean }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(`[Command Network] ${this.props.label ?? "screen"} crashed:`, err); }
  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    if (this.props.small) return <div className="p-3 text-[11px] text-amber">⚠ This widget couldn't load. <button type="button" className="underline" onClick={() => this.setState({ err: null })}>Retry</button></div>;
    return (
      <main className="grid min-w-0 flex-1 place-items-center p-6">
        <section role="alert" className="w-[520px] max-w-full border border-amber/60 bg-panel p-6 text-center" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="text-[28px] text-amber">⚠</div>
          <h1 className="mt-1 font-head text-[20px] font-bold tracking-[3px] text-white">{(this.props.label ?? "This page").toUpperCase()} HIT A PROBLEM</h1>
          <p className="mt-2 text-[13px] text-[#aeb9c4]">The rest of the app still works. If the website was just updated, deploy it first, then reload.</p>
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap border border-cyan/15 bg-black/40 p-2 text-left text-[11px] text-dim">{err.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => this.setState({ err: null })} className="border border-cyan/40 px-4 py-2 text-[12px] tracking-[2px] text-cyan">↻ TRY AGAIN</button>
            <button type="button" onClick={() => location.reload()} className="border border-amber px-4 py-2 text-[12px] tracking-[2px] text-amber">⟳ RELOAD APP</button>
          </div>
        </section>
      </main>
    );
  }
}
