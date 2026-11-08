import type { Metadata } from "next";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { addressLines, formatLongDate } from "@/lib/companies/format";
import { loadCompany } from "../data";

export const metadata: Metadata = { title: "Letters" };

export default async function CompanyLettersPage({ params }: PageProps<"/new-companies/[number]/letters">) {
  const { number } = await params;
  const c = (await loadCompany(number))!;
  const canGetLetter = c.state === "not_reviewed" || c.state === "added";
  const lines = addressLines(c.posting);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1060fr_500fr]">
      <Card padding="p-6">
        <CardHeader title="Letters" />
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-canvas px-6 py-10 text-center">
          <span className="text-brand">
            <Icon icon={faEnvelope} size={18} />
          </span>
          <p className="mt-1 text-[15px] font-bold leading-5 text-ink">No letter printed yet</p>
          <p className="text-[12px] leading-4 text-muted">
            {c.state === "added"
              ? "It’s in today’s print run and will be printed with the next batch."
              : canGetLetter
                ? "Add it to a print run from New Companies to send a letter."
                : c.state === "address_issue"
                  ? "Fix the posting address first — then it can go in a print run."
                  : "This company won’t get a letter."}
          </p>
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
                <td colSpan={5} className="px-4 py-5 text-center text-[12px] text-muted">
                  No letters yet · reference will be ABF-{c.number}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-label="This company’s letter" className="flex flex-col items-center gap-4 rounded-[14px] border border-line bg-mint/60 p-6">
        <h2 className="text-[13px] font-medium text-muted">This company’s letter (preview)</h2>
        <PrintedLetter
          width={384}
          data={{
            directorFullName: c.directorFullName ?? "The Director",
            directorFirstName: c.directorFirstName ?? "",
            companyName: c.name,
            addressLines: lines.length ? lines : ["Address missing"],
            reference: `ABF-${c.number}`,
            incorporatedLong: formatLongDate(c.incorporatedOn),
            letterDate: formatLongDate(new Date()),
          }}
        />
      </section>
    </div>
  );
}
