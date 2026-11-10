import { notFound } from "next/navigation";
import ServiceRecordView from "@/components/terminal/views/ServiceRecordView";
import { getServiceRecord } from "@/lib/terminal/data";
import { requireTerminal } from "@/lib/terminal/guard";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireTerminal();
  const r = await getServiceRecord((await params).id);
  if (!r) notFound();
  return <ServiceRecordView r={r} back={{ href: "/terminal/personnel", label: "ROSTER" }} />;
}
