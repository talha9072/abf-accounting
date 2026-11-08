import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addressLines } from "@/lib/companies/format";
import { getRun } from "@/lib/print/queries";
import { PrintToolbar } from "../../print-toolbar";

export const metadata: Metadata = { title: "Print labels" };

const PER_SHEET = 12; // 2 columns × 6 rows, 98 × 46 mm, 6 mm side margins, 10.5 mm top

export default async function PrintLabelsDocument({ params, searchParams }: PageProps<"/print-doc/[id]/labels">) {
  const { id } = await params;
  const sp = await searchParams;
  const run = await getRun(id);
  if (!run || run.status === "cancelled") notFound();

  const test = sp.test === "1";
  const startAt = Math.max(1, Math.min(PER_SHEET, Number(sp.start) || 1));
  const labels = run.items.map((i) => [
    i.letter?.directorFullName ?? "The Director",
    i.letter?.companyName ?? "",
    ...(i.letter?.addressLines ?? addressLines(i.address)),
  ]);

  // Blank cells for already-used labels on a part-used first sheet.
  const cells: Array<string[] | null> = test ? Array.from({ length: PER_SHEET }, () => null) : [...Array(startAt - 1).fill(null), ...labels];
  const sheets: Array<Array<string[] | null>> = [];
  for (let i = 0; i < cells.length; i += PER_SHEET) sheets.push(cells.slice(i, i + PER_SHEET));

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar
        title={test ? `${run.reference} · test sheet` : `${run.reference} · ${labels.length} address labels`}
        detail="A4 · 2 × 6 labels of 98 × 46 mm · margins 6 mm sides, 10.5 mm top — print at 100% scale with margins “None”"
        auto={sp.auto === "1"}
      />
      <main className="flex flex-col items-center gap-6 py-8 print:block print:p-0">
        {sheets.map((sheet, s) => (
          <div
            key={s}
            className="grid h-[297mm] w-[210mm] grid-cols-[98mm_98mm] grid-rows-[repeat(6,46mm)] content-start justify-center bg-white pt-[10.5mm] shadow-[0_2px_10px_rgb(9_36_45/0.12)] print:shadow-none [break-after:page] last:[break-after:auto]"
          >
            {Array.from({ length: PER_SHEET }, (_, i) => {
              const lines = sheet[i];
              return (
                <div
                  key={i}
                  className={
                    test
                      ? "flex items-center justify-center border border-dashed border-[#9fb3a8] text-[11pt] text-[#7c8f86]"
                      : "flex flex-col justify-center overflow-hidden px-[7mm] text-[10pt] leading-[1.3] text-black"
                  }
                >
                  {test ? (
                    `Label ${i + 1}`
                  ) : lines ? (
                    lines.map((l, j) => (
                      <span key={j} className={j === 0 ? "truncate font-semibold" : "truncate"}>
                        {l}
                      </span>
                    ))
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </main>
    </>
  );
}
