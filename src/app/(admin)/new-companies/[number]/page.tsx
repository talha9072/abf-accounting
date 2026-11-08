import type { Metadata } from "next";
import Link from "next/link";
import { faBan, faCheck, faCircleCheck, faPen, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatAddress, formatDate, sicLabel } from "@/lib/companies/format";
import { getCompanyActivity } from "@/lib/companies/queries";
import { latestNote } from "@/lib/notes/queries";
import { companyLetters } from "@/lib/print/queries";
import { formatSaTime } from "@/lib/pull/dates";
import { cn } from "@/lib/cn";
import { ExcludeCard } from "./company-actions";
import { loadCompany, requireCompany, runBadge, STATE_BADGE } from "./data";
import { ActivityTimeline } from "./parts";

export async function generateMetadata({ params }: PageProps<"/new-companies/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: (await loadCompany(number))?.name ?? "Company" };
}

export default async function CompanyOverviewPage({ params }: PageProps<"/new-companies/[number]">) {
  const { number } = await params;
  const c = await requireCompany(number);
  const [activity, note, letters] = await Promise.all([getCompanyActivity(c), latestNote(c.id), companyLetters(c.id)]);
  const badge = STATE_BADGE[c.state];

  const left: Array<[string, string, string?]> = [
    ["Company status", c.status.replace(/^\w/, (s) => s.toUpperCase())],
    ["Company type", c.typeLabel],
    ["Date of creation", c.incorporated],
    ["Registered office", c.registeredAddress || "No address on record"],
  ];
  const right: Array<[string, string, string?]> = [
    ["SIC codes", c.sicCodes.length ? sicLabel(c.sicCodes[0]) : "None given", c.sicCodes.length > 1 ? `+ ${c.sicCodes.slice(1).join(", ")}` : "Primary activity"],
    ["Director (letter goes to)", c.directorFullName ?? (c.officersFetched ? "No active director listed" : "Not fetched yet"), c.directorFirstName ? `Letter opens “Dear ${c.directorFirstName},”` : "Letter opens “To whom it may concern,”"],
    ["Posting address", formatAddress(c.posting) || "—", c.postingAddress ? "Fixed by your team" : "Same as registered office"],
    ["Import source", "Advanced company search", `Imported ${formatDate(c.importedAt.toISOString())} at ${formatSaTime(c.importedAt)}`],
  ];

  const passedAll = c.passedCount === c.checks.length;

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-4 xl:grid-cols-[1028fr_532fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader
            title="Companies House information"
            aside={
              <span className="inline-flex h-[27px] items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">
                From Companies House · {formatSaTime(c.importedAt)}
              </span>
            }
          />
          <dl className="mt-3 grid gap-x-6 md:grid-cols-2">
            {[left, right].map((col, ci) => (
              <div key={ci} className="flex flex-col">
                {col.map(([label, value, sub]) => (
                  <div key={label} className="flex min-h-[58px] flex-col gap-0.5 border-b border-line py-2">
                    <dt className="text-[10px] font-medium leading-[14px] text-muted">{label}</dt>
                    <dd className="text-[12px] font-medium leading-4 text-ink">{value}</dd>
                    {sub ? <dd className="text-[10px] leading-[14px] text-muted">{sub}</dd> : null}
                  </div>
                ))}
              </div>
            ))}
          </dl>
        </Card>
        <ActivityTimeline items={activity} limit={5} />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Why it gets a letter" aside={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>} />
          <ul className="mt-3 flex flex-col gap-2.5">
            {c.checks.map((x) => (
              <li key={x.key} className={cn("flex items-center gap-2.5 text-[13px] leading-[18px]", x.passed ? "text-ink" : "font-medium text-danger")}>
                <span
                  className={cn(
                    "flex size-[18px] items-center justify-center rounded-full",
                    x.passed ? "bg-mint text-brand" : "bg-danger-subtle text-danger",
                  )}
                >
                  <Icon icon={x.passed ? faCheck : faXmark} size={9} />
                </span>
                {x.label}
              </li>
            ))}
          </ul>
          <p
            className={cn(
              "mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[12px] font-medium leading-4",
              passedAll && c.state !== "excluded" ? "bg-mint text-brand" : "bg-danger-subtle text-danger",
            )}
          >
            <Icon icon={passedAll && c.state !== "excluded" ? faCircleCheck : faTriangleExclamation} size={12} />
            {c.state === "excluded"
              ? "Excluded — it won’t get a letter"
              : c.state === "skipped" && c.skipReason === "manual"
                ? "Skipped by your team — it won’t get a letter"
                : passedAll
                  ? `Passed ${c.passedCount} of ${c.checks.length}${c.state === "added" ? " — included in today’s print run" : " — ready for a print run"}`
                  : `Passed ${c.passedCount} of ${c.checks.length}${c.state === "address_issue" ? " — fix the address to send a letter" : " — no letter"}`}
          </p>
        </Card>

        <Card padding="p-[18px]">
          <h2 className="flex items-center gap-2 text-[14px] font-bold leading-[19px] text-ink">
            <Icon icon={faBan} size={13} />
            Exclude
          </h2>
          <p className="mt-2 text-[11px] leading-[15px] text-muted">
            {c.exclusion
              ? `Excluded ${formatDate(c.exclusion.createdAt.toISOString())}${c.exclusion.reason ? ` · ${c.exclusion.reason}` : ""}`
              : "Use this when a company opts out or must not be contacted again."}
          </p>
          <ExcludeCard number={c.number} name={c.name} state={c.state} />
        </Card>

        <Card padding="p-[18px]">
          <CardHeader
            size="sm"
            title="Print history"
            aside={
              letters[0] ? (
                <StatusBadge tone={runBadge(letters[0]).tone} size="sm">
                  {runBadge(letters[0]).label}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral" size="sm">
                  None
                </StatusBadge>
              )
            }
          />
          {letters.length === 0 ? (
            <p className="mt-1.5 text-[11px] leading-[15px] text-muted">No letter has been printed for this company yet.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {letters.slice(0, 3).map((l) => (
                <li key={l.runId} className="flex flex-col">
                  <span className="text-[12px] font-medium leading-4 text-ink">
                    {l.runReference} · {l.template}
                  </span>
                  <span className="text-[11px] leading-[15px] text-muted">
                    Printed {l.printedAt}
                    {l.confirmedDay ? ` · posted ${l.confirmedDay}` : ""}
                    {l.status === "cancelled" ? " · run cancelled" : ""}
                  </span>
                </li>
              ))}
              <li>
                <Link href={`/new-companies/${number}/letters`} className="text-[11px] font-medium text-brand hover:underline">
                  View letters
                </Link>
              </li>
            </ul>
          )}
        </Card>

        <Card padding="p-[18px]">
          <CardHeader
            size="sm"
            title="Notes"
            aside={
              <Link href={`/new-companies/${number}/notes`} aria-label="Add a note" className="text-muted hover:text-ink">
                <Icon icon={faPen} size={11} />
              </Link>
            }
          />
          {note ? (
            <Link href={`/new-companies/${number}/notes`} className="mt-1.5 flex flex-col gap-1 rounded-lg bg-canvas px-3 py-2.5 hover:bg-mint">
              <span className="line-clamp-3 whitespace-pre-wrap text-[12px] leading-[17px] text-ink">{note.body}</span>
              <span className="text-[11px] leading-[15px] text-muted">
                {note.author} · {note.when}
                {note.total > 1 ? ` · ${note.total - 1} more` : ""}
              </span>
            </Link>
          ) : (
            <p className="mt-1 text-[11px] leading-[15px] text-muted">No notes yet. Notes are visible to your team only.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
