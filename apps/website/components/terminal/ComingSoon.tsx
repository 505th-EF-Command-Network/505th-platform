import { notFound } from "next/navigation";
import { findLink } from "./nav";
import { PanelTitle, Tile } from "./ui";

/** Honest placeholder for sidebar modules that are not built yet. */
export default function ComingSoon({ path }: { path: string }) {
  const hit = findLink(path);
  if (!hit || hit.link.href !== path) notFound();
  return (
    <>
      <PanelTitle sub={hit.group.label}>{hit.link.label.toUpperCase()}</PanelTitle>
      <Tile>
        <p className="py-10 text-center text-[12px] leading-6 tracking-[2px] text-[#bbb]">
          <span className="block text-[#f59e0b]">◌ MODULE NOT ONLINE YET</span>
          This section is planned and will be built in a later stage.
        </p>
      </Tile>
    </>
  );
}
