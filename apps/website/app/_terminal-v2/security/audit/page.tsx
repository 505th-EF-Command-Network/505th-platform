import { AuditView } from "@/components/terminal/views/TableViews";
import { getAudit } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page() {
  await requireTerminal();
  return <AuditView rows={await getAudit()} />;
}
