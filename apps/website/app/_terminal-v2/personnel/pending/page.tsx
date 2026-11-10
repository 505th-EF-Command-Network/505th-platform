import RosterView from "@/components/terminal/views/RosterView";
import { getRoster } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page() {
  await requireTerminal();
  return <RosterView rows={await getRoster({ status: ["PENDING"] })} title="PENDING APPROVALS" initialStatus="PENDING" />;
}
