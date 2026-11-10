import ComingSoon from "@/components/terminal/ComingSoon";
import { requireTerminal } from "@/lib/terminal/guard";

/** Static route so it is not caught by /terminal/personnel/[id]. */
export default async function Page() {
  await requireTerminal();
  return <ComingSoon path="/terminal/personnel/promotions" />;
}
