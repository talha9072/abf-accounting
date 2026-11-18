import type { Metadata } from "next";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { getQueueLetters } from "@/lib/print/queries";
import { PrintToolbar } from "../../print-toolbar";

export const metadata: Metadata = { title: "Letters (PDF)" };

/** A4 at 96 dpi: 210 mm = 793.7 px. */
const A4_WIDTH_PX = 793.7;

/**
 * The current print run (every company "Added to print run") merged with the chosen template —
 * the same A4 letters as /print-doc/{run}/letters, for "Download PDF". Nothing is recorded:
 * no print run is created and no company is marked printed.
 */
export default async function QueueLettersDocument({ searchParams }: PageProps<"/print-doc/queue/letters">) {
  const sp = await searchParams;
  const { template, letters, total } = await getQueueLetters(typeof sp.template === "string" ? sp.template : null);

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar
        title={`Print run (not printed yet) · ${total} ${total === 1 ? "letter" : "letters"}`}
        detail={`${template.name} ${template.version} · nothing is recorded — choose “Save as PDF” as the printer, margins “None”, scale 100%`}
        auto={sp.auto === "1" && total > 0}
      />
      <main className="flex flex-col items-center gap-6 py-8 print:block print:gap-0 print:p-0">
        {letters.length === 0 ? (
          <p className="py-16 text-[14px] text-muted print:hidden">The print run is empty — add companies on New Companies first.</p>
        ) : (
          letters.map((l) => (
            <div
              key={l.companyNumber}
              className="h-[297mm] w-[210mm] overflow-hidden bg-white shadow-[0_2px_10px_rgb(9_36_45/0.12)] print:shadow-none [break-after:page] last:[break-after:auto]"
            >
              <PrintedLetter letter={l} width={A4_WIDTH_PX} flat />
            </div>
          ))
        )}
      </main>
    </>
  );
}
