import type { Metadata } from "next";
import { getOpenRuns, getQueueLetters, listRuns } from "@/lib/print/queries";
import { PrintPreview } from "./print-preview";

export const metadata: Metadata = { title: "Preview letters" };

const PREVIEW_MAX = 100;

export default async function PrintPreviewPage({ searchParams }: PageProps<"/print/preview">) {
  const sp = await searchParams;
  const requested = typeof sp.template === "string" ? sp.template : null;
  const [{ template: tpl, letters, total }, openRuns, [latestRun]] = await Promise.all([getQueueLetters(requested, PREVIEW_MAX), getOpenRuns(), listRuns(1)]);
  const openRun = openRuns[0];

  return (
    <PrintPreview
      letters={letters}
      total={total}
      template={{ id: tpl.id, name: tpl.name, version: tpl.version }}
      // Keep ?template= on links only when it picked a (non-default) template.
      templateParam={requested === tpl.id ? tpl.id : null}
      // ?confirm=1 — "Did all letters print?" for the newest run that's still waiting; ignored if there is none.
      confirmRun={sp.confirm === "1" && openRun ? { id: openRun.id, reference: openRun.reference, letters: openRun.letters, template: openRun.template } : null}
      openRun={Boolean(openRun)}
      labelsRun={Boolean(latestRun)}
    />
  );
}
