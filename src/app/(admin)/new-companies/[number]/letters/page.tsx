import type { Metadata } from "next";
import Link from "next/link";
import { faChevronRight, faEnvelope, faPrint } from "@fortawesome/free-solid-svg-icons";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { findCompany } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Letters" };

export default async function CompanyLettersPage({ params }: PageProps<"/new-companies/[number]/letters">) {
  const { number } = await params;
  const c = findCompany(number)!;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1060fr_500fr]">
      <Card padding="p-6">
        <CardHeader
          title="Letters"
          aside={
            <ButtonLink href="/print/preview" icon={faPrint}>
              Print letter now
            </ButtonLink>
          }
        />
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-canvas px-6 py-10 text-center">
          <span className="text-brand">
            <Icon icon={faEnvelope} size={18} />
          </span>
          <p className="mt-1 text-[15px] font-bold leading-5 text-ink">No letter printed yet</p>
          <p className="text-[12px] leading-4 text-muted">It will be included in the next print run unless it’s skipped or excluded.</p>
        </div>

        <p className="mt-6 text-[13px] leading-[18px] text-ink">When letters are printed they appear here</p>
        <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line bg-n100/60 text-[11px] font-medium text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Printed</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Print run</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3.5 font-medium text-ink">21 Sep 2026 (example)</td>
                <td className="px-4 py-3.5 text-ink">Welcome Letter v3</td>
                <td className="px-4 py-3.5 text-muted">PR-0921 · letter 4 of 10</td>
                <td className="px-4 py-3.5 text-muted tabular-nums">ABF-{c.number}</td>
                <td className="px-4 py-3.5">
                  <Link href="/print/preview" className="inline-flex items-center gap-1.5 text-muted hover:text-brand">
                    View PDF <Icon icon={faChevronRight} size={8} />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-label="This company’s letter" className="flex flex-col items-center gap-4 rounded-[14px] border border-line bg-mint/60 p-6">
        <h2 className="text-[13px] font-medium text-muted">This company’s letter</h2>
        <PrintedLetter
          width={384}
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
      </section>
    </div>
  );
}
