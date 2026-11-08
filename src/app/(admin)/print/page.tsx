import type { Metadata } from "next";
import { listPrintableTemplates } from "@/lib/letters/data";
import { getOpenRuns, getPrintQueue, listRuns } from "@/lib/print/queries";
import { PrintLetters } from "./print-letters";

export const metadata: Metadata = { title: "Print Letters" };

export default async function PrintPage({ searchParams }: PageProps<"/print">) {
  const sp = await searchParams;
  const [queue, openRuns, recent, templates] = await Promise.all([getPrintQueue(), getOpenRuns(), listRuns(3), listPrintableTemplates()]);
  const templateId = typeof sp.template === "string" && templates.some((t) => t.id === sp.template) ? sp.template : templates[0]?.id ?? null;

  return (
    <PrintLetters
      queue={queue}
      openRuns={openRuns}
      recentRuns={recent.filter((r) => r.status === "confirmed")}
      templates={templates.map((t) => ({ id: t.id, name: t.name, greeting: t.greeting }))}
      templateId={templateId}
    />
  );
}
