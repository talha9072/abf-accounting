"use client";

import { useState } from "react";
import { faArrowLeft, faChevronLeft, faChevronRight, faDownload, faInbox, faPrint } from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { ConfirmPrintedModal, LabelsModal, PrintSetupBanner, PrintSteps } from "@/components/admin/print-parts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { companies } from "@/lib/mock-data";

const RUN = companies.slice(0, 10);

const OPTIONS: Array<[string, string]> = [
  ["Letters", "10 · one per page"],
  ["Template", "Welcome Letter v3"],
  ["Paper", "A4 · portrait"],
  ["Envelope", "DL window"],
  ["Address labels", "After letters · 12 per sheet"],
  ["Printer", "Browser print dialog"],
];

export function PrintPreview({ initialConfirm }: { initialConfirm: boolean }) {
  const toast = useToast();
  const [i, setI] = useState(0);
  const [modal, setModal] = useState<"confirm" | "labels" | null>(initialConfirm ? "confirm" : null);
  const c = RUN[i];

  const print = () => {
    // Opens the system print dialog; the confirm step follows.
    setModal("confirm");
  };

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
            <Button icon={faPrint} onClick={print}>
              Print 10 letters
            </Button>
          </>
        }
      />
      <PrintSetupBanner />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PrintSteps current={3} />
        <FilterDropdown
          className="w-[150px]"
          variant="inline"
          icon={faInbox}
          label="Batch"
          options={["Since last pull (default)", "Last 7 days", "Last 30 days"]}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
              Letter {i + 1} of {RUN.length} · {c.name}
            </p>
            <button
              type="button"
              aria-label="Next letter"
              disabled={i === RUN.length - 1}
              onClick={() => setI((v) => Math.min(RUN.length - 1, v + 1))}
              className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-white disabled:opacity-30"
            >
              <Icon icon={faChevronRight} size={11} />
            </button>
          </div>

          <PrintedLetter
            showEnvelopeWindow
            data={{
              directorFullName: c.director,
              directorFirstName: c.directorFirstName,
              companyName: c.name,
              addressLines: c.addressLines,
              reference: `ABF-${c.number}`,
              incorporatedLong: "22 September 2026",
              letterDate: "23 September 2026",
            }}
          />
          <p className="text-[12px] leading-4 text-muted">
            Dashed area shows where the address appears through the envelope window. The guide does not print.
          </p>
        </section>

        <Card padding="p-6" radius="rounded-[14px]" className="xl:sticky xl:top-[100px]">
          <h2 className="text-[18px] font-bold leading-[25px] text-ink">Print options</h2>
          <dl className="mt-3 flex flex-col">
            {OPTIONS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-3.5 text-[13px] leading-[18px]">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-[12px] leading-4 text-muted">
            After printing you’ll be asked to confirm, then you can print the address labels (12 per sheet).
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Button icon={faPrint} block onClick={print}>
              Print 10 letters
            </Button>
            <Button variant="secondary" icon={faDownload} block>
              Download PDF
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmPrintedModal
        open={modal === "confirm"}
        onClose={() => setModal(null)}
        onConfirm={() => {
          setModal("labels");
          toast({ message: "10 letters marked as printed", actionLabel: "Undo" });
        }}
      />
      <LabelsModal open={modal === "labels"} onClose={() => setModal(null)} />
    </>
  );
}
