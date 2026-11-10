import OverviewView from "@/components/terminal/views/OverviewView";
import { getOverview } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page() {
  const v = await requireTerminal();
  return <OverviewView data={await getOverview()} name={v.member.displayName} />;
}
