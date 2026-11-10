import { AarsView } from "@/components/terminal/views/TableViews";
import { getAars } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page() {
  await requireTerminal();
  return <AarsView aars={await getAars()} />;
}
