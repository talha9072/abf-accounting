import type { Metadata } from "next";
import { codeExample, REPLACE_CODES } from "@/lib/letters/codes";
import { getPreviewContext } from "@/lib/templates/preview";
import { loadTemplate } from "../data";

export const metadata: Metadata = { title: "Replace codes" };

export default async function ReplaceCodesPage({ params }: PageProps<"/letter-templates/[id]/replace-codes">) {
  const { id } = await params;
  const t = (await loadTemplate(id))!;
  const { values, recipient } = await getPreviewContext(t.offer);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-[18px] text-muted">
        Replace codes are written like ##COMPANY_NAME# (the same as eFiling) and are filled in automatically for each company. If a
        value is missing, the fallback is used — or the company is flagged as an address issue.
      </p>
      <div className="overflow-x-auto rounded-[14px] border border-line scroll-area">
        <table className="w-full min-w-[860px] text-left text-[13px] leading-[18px]">
          <thead className="bg-canvas text-[11px] text-muted">
            <tr>
              <th scope="col" className="px-4 py-3.5 font-medium">Field</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Example ({recipient.companyName})</th>
              <th scope="col" className="px-4 py-3.5 font-medium">Comes from</th>
              <th scope="col" className="px-4 py-3.5 font-medium">If missing</th>
            </tr>
          </thead>
          <tbody>
            {REPLACE_CODES.map((c) => (
              <tr key={c.code} className="border-t border-line">
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-ink">{c.code}</th>
                <td className="px-4 py-3 text-ink">{codeExample(c, values)}</td>
                <td className="px-4 py-3 text-muted">{c.source}</td>
                <td className="px-4 py-3 text-muted">{c.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
