import type { Metadata } from "next";
import { faArrowUpRightFromSquare, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FitLetter } from "@/components/admin/fit-letter";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buildLetterSnapshot, getBusiness, getPrintableTemplate, renderLetter } from "@/lib/letters/data";
import { companyLetters } from "@/lib/print/queries";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";
import { requireCompany, runBadge } from "../data";

export const metadata: Metadata = { title: "Letters" };

export default async function CompanyLettersPage({ params }: PageProps<"/new-companies/[number]/letters">) {
  const { number } = await params;
  const c = await requireCompany(number);
  const [letters, business] = await Promise.all([companyLetters(c.id), getBusiness()]);
  const canGetLetter = c.state === "not_reviewed" || c.state === "added";

  // Right-hand side: the letter exactly as printed (frozen snapshot), or a live preview from the default template.
  const printed = letters.find((l) => l.status !== "cancelled" && l.letter);
  const tpl = printed ? null : await getPrintableTemplate();
  const snapshot =
    printed?.letter ??
    buildLetterSnapshot(
      {
        name: c.rawName,
        companyNumber: c.number,
        directorFirstName: c.directorFirstName,
        directorFullName: c.directorFullName,
        incorporatedOn: c.incorporatedOn,
        registeredOffice: c.registeredOffice,
        postingAddress: c.postingAddress,
      },
      tpl!,
      business,
      dateInTz(new Date(), UK_TZ),
    );
  const rendered = await renderLetter(snapshot, business);

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-4 xl:grid-cols-[1060fr_500fr]">
      <Card padding="p-6">
        <CardHeader
          title="Letters"
          aside={
            letters.length ? (
              <span className="text-[11px] font-medium text-muted">
                {letters.length} {letters.length === 1 ? "print run" : "print runs"}
              </span>
            ) : null
          }
        />
        {letters.length === 0 ? (
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
        ) : null}

        {letters.length === 0 ? <p className="mt-6 text-[13px] leading-[18px] text-ink">When letters are printed they appear here</p> : null}
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
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
              {letters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-[12px] text-muted">
                    No letters yet · reference will be {business.prefix}
                    {c.number}
                  </td>
                </tr>
              ) : (
                letters.map((l) => {
                  const badge = runBadge(l);
                  return (
                    <tr key={l.runId} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <span className="block whitespace-nowrap text-ink">{l.printedAt}</span>
                        <span className="block text-[11px] text-muted">by {l.printedBy}</span>
                      </td>
                      <td className="px-4 py-3 text-ink">{l.template}</td>
                      <td className="px-4 py-3">
                        <span className="block whitespace-nowrap font-medium text-ink">{l.runReference}</span>
                        <StatusBadge tone={badge.tone} size="sm" className="mt-1">
                          {badge.label}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-ink">{l.reference}</td>
                      <td className="px-4 py-3">
                        {l.status === "cancelled" ? (
                          <span className="text-[12px] text-muted">Not sent</span>
                        ) : (
                          <a
                            href={`/print-doc/${l.runId}/letters?from=${l.position}&to=${l.position}`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-brand hover:underline"
                          >
                            View / reprint
                            <Icon icon={faArrowUpRightFromSquare} size={10} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-label="This company’s letter" className="flex flex-col items-center gap-4 rounded-[14px] border border-line bg-mint/60 p-6">
        <div className="flex flex-col items-center gap-0.5 text-center">
          <h2 className="text-[13px] font-medium text-muted">{printed ? "Letter as printed" : "This company’s letter (preview)"}</h2>
          <p className="text-[11px] text-muted">
            {printed ? `${printed.runReference} · ${printed.template} · ${printed.printedDay}` : `Using ${tpl!.name} · ${tpl!.version} — final text is fixed when printed`}
          </p>
        </div>
        <FitLetter max={384} letter={rendered} />
      </section>
    </div>
  );
}
