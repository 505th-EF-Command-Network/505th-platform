import { AttendanceView } from "@/components/terminal/views/TableViews";
import { getOps } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page() {
  await requireTerminal();
  return <AttendanceView ops={await getOps()} />;
}
