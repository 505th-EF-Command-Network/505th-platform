import logo from "../../../../assets/logo.png";

/**
 * 19 Nov: the Hub's own title bar (the window has no Windows title bar now, so it matches the Hub theme).
 * Drag it to move the window; double-click to maximise. Windows draws the − □ ✕ buttons on the right in the theme colours.
 */
export function TitleBar() {
  return (
    <div className="flex h-[30px] shrink-0 select-none items-center gap-2 border-b border-cyan/15 bg-panel pl-2.5 pr-[150px] text-[12px] tracking-[1px] text-[#c6d0da]"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <img src={logo} alt="" className="h-[18px] w-[18px]" />
      <span>505th Command Network</span>
    </div>
  );
}
