import ComingSoon from "@/components/terminal/ComingSoon";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  await requireTerminal();
  return <ComingSoon path={`/terminal/${(await params).slug.join("/")}`} />;
}
