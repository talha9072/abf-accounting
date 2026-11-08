import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { getBusiness, renderLetter } from "@/lib/letters/data";
import { getRun } from "@/lib/print/queries";
import { PrintToolbar } from "../../print-toolbar";

export const metadata: Metadata = { title: "Print letters" };

/** A4 at 96 dpi: 210 mm = 793.7 px. */
const A4_WIDTH_PX = 793.7;

export default async function PrintLettersDocument({ params, searchParams }: PageProps<"/print-doc/[id]/letters">) {
  const { id } = await params;
  const sp = await searchParams;
  const run = await getRun(id);
  if (!run || run.status === "cancelled") notFound();

  const total = run.items.length;
  const from = Math.max(1, Math.min(total, Number(sp.from) || 1));
  const to = Math.max(from, Math.min(total, Number(sp.to) || total));
  const business = await getBusiness();
  const items = run.items.filter((i) => i.position >= from && i.position <= to && i.letter);
  const letters = await Promise.all(items.map((i) => renderLetter(i.letter!, business)));
  const range = from === 1 && to === total ? `${total} letters` : `letters ${from}–${to} of ${total}`;

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar
        title={`${run.reference} · ${range}`}
        detail={`${run.template} · printed ${run.printedAt} by ${run.printedBy} · A4, one letter per page — set margins to “None” and scale to 100%`}
        auto={sp.auto === "1"}
      />
      <main className="flex flex-col items-center gap-6 py-8 print:block print:gap-0 print:p-0">
        {letters.map((l) => (
          <div
            key={l.companyNumber}
            className="h-[297mm] w-[210mm] overflow-hidden bg-white shadow-[0_2px_10px_rgb(9_36_45/0.12)] print:shadow-none [break-after:page] last:[break-after:auto]"
          >
            <PrintedLetter letter={l} width={A4_WIDTH_PX} flat />
          </div>
        ))}
      </main>
    </>
  );
}
