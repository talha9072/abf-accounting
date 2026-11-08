"use client";

import Link from "next/link";
import { useState } from "react";
import { faArrowLeft, faChevronLeft, faChevronRight, faDownload, faPrint, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FitLetter } from "@/components/admin/fit-letter";
import { PrintSetupBanner, PrintSteps, usePrintFlow } from "@/components/admin/print-parts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { RenderedLetter } from "@/lib/letters/data";

export function PrintPreview({
  letters,
  total,
  template,
}: {
  letters: RenderedLetter[];
  total: number;
  template: { id: string; name: string; version: string };
}) {
  const flow = usePrintFlow();
  const [i, setI] = useState(0);
  const l = letters[i];
  const print = () => flow.printQueue(template.id);

  const options: Array<[string, string]> = [
    ["Letters", `${total} · one per page`],
    ["Template", `${template.name} (${template.version})`],
    ["Paper", "A4 · portrait"],
    ["Envelope", "DL window"],
    ["Address labels", "After letters · 12 per sheet"],
    ["Printer", "Browser print dialog"],
  ];

  return (
    <>
      <PageHeader
        title="Preview letters"
        description="Check each personalised letter before printing. The address block lines up with DL window envelopes."
        actions={
          <>
            <ButtonLink variant="secondary" icon={faArrowLeft} href="/print">
              Back to selection
            </ButtonLink>
            <Button icon={flow.pending ? faSpinner : faPrint} onClick={print} disabled={total === 0 || flow.pending}>
              Print {total} {total === 1 ? "letter" : "letters"}
            </Button>
          </>
        }
      />
      <PrintSetupBanner />
      <PrintSteps current={3} />

      {total === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-[15px] font-bold text-ink">The print run is empty</p>
          <p className="text-[12px] text-muted">
            Add companies on{" "}
            <Link href="/new-companies?view=not-reviewed" className="font-medium text-brand underline">
              New Companies
            </Link>{" "}
            to preview their letters.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-label="Letter preview" className="flex flex-col items-center gap-6 rounded-[14px] border border-line bg-mint/50 px-6 pb-7 pt-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous letter"
                disabled={i === 0}
                onClick={() => setI((v) => Math.max(0, v - 1))}
                className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-white disabled:opacity-30"
              >
                <Icon icon={faChevronLeft} size={11} />
              </button>
              <p className="min-w-[280px] text-center text-[13px] font-medium leading-[18px] text-ink" aria-live="polite">
                Letter {i + 1} of {total} · {l?.companyName}
              </p>
              <button
                type="button"
                aria-label="Next letter"
                disabled={i >= letters.length - 1}
                onClick={() => setI((v) => Math.min(letters.length - 1, v + 1))}
                className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-white disabled:opacity-30"
              >
                <Icon icon={faChevronRight} size={11} />
              </button>
            </div>
            {l ? <FitLetter showEnvelopeWindow letter={l} /> : null}
            <p className="text-[12px] leading-4 text-muted">
              Dashed area shows where the address appears through the envelope window. The guide does not print.
              {letters.length < total ? ` Showing the first ${letters.length} letters.` : ""}
            </p>
          </section>

          <Card padding="p-6" radius="rounded-[14px]" className="xl:sticky xl:top-[100px]">
            <h2 className="text-[18px] font-bold leading-[25px] text-ink">Print options</h2>
            <dl className="mt-3 flex flex-col">
              {options.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-3.5 text-[13px] leading-[18px]">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-[12px] leading-4 text-muted">
              Printing opens the letters in a new tab with your printer dialog. Afterwards you’ll be asked to confirm, then you can print
              the address labels (12 per sheet).
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Button icon={flow.pending ? faSpinner : faPrint} block onClick={print} disabled={flow.pending}>
                Print {total} {total === 1 ? "letter" : "letters"}
              </Button>
              <Button variant="secondary" icon={faDownload} block onClick={print} disabled={flow.pending} title="Choose “Save as PDF” in the print dialog">
                Download PDF
              </Button>
              <p className="text-center text-[11px] leading-[15px] text-muted">For a PDF, choose “Save as PDF” as the printer.</p>
            </div>
          </Card>
        </div>
      )}
      {flow.modals}
    </>
  );
}
