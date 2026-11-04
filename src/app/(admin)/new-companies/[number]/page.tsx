import type { Metadata } from "next";
import Link from "next/link";
import { faBan, faCheck, faCircleCheck, faPen, faPlus } from "@fortawesome/free-solid-svg-icons";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { findCompany } from "@/lib/mock-data";
import { ActivityTimeline } from "./parts";
import { ExcludeButton } from "./exclude-button";

export async function generateMetadata({ params }: PageProps<"/new-companies/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: findCompany(number)?.name ?? "Company" };
}

const CHECKS = [
  "Company type is Ltd",
  "Address is complete",
  "Not at your own office address",
  "Not a shared or agent address",
  "Not a Companies House default address",
  "Not excluded",
  "Not printed before",
];

export default async function CompanyOverviewPage({ params }: PageProps<"/new-companies/[number]">) {
  const { number } = await params;
  const company = findCompany(number)!;

  const left: Array<[string, string, string?]> = [
    ["Company status", "Active"],
    ["Company type", "Private limited company"],
    ["Date of creation", "22 Sep 2026"],
    ["Registered office", company.address],
  ];
  const right: Array<[string, string, string?]> = [
    ["SIC codes", "62012 · Business and domestic software development", "Primary activity"],
    ["Accounts", "First accounts not yet filed", "Accounts data sourced from company profile"],
    ["Confirmation statement", "First statement not yet due", "Status shown from Companies House profile"],
    ["Import source", "Advanced company search", "Imported 22 Sep 2026 at 06:00"],
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1028fr_532fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader
            title="Companies House information"
            aside={
              <span className="inline-flex h-[27px] items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">
                From Companies House · 06:00
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
        <ActivityTimeline />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Why it gets a letter" aside={<StatusBadge tone="info">Added</StatusBadge>} />
          <ul className="mt-3 flex flex-col gap-2.5">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-2.5 text-[13px] leading-[18px] text-ink">
                <span className="flex size-[18px] items-center justify-center rounded-full bg-mint text-brand">
                  <Icon icon={faCheck} size={9} />
                </span>
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-2 rounded-[10px] bg-mint px-3 py-2.5 text-[12px] font-medium leading-4 text-brand">
            <Icon icon={faCircleCheck} size={12} />
            Passed 7 of 7 — included in today’s print run
          </p>
        </Card>

        <Card padding="p-[18px]">
          <h2 className="flex items-center gap-2 text-[14px] font-bold leading-[19px] text-ink">
            <Icon icon={faBan} size={13} />
            Exclude
          </h2>
          <p className="mt-2 text-[11px] leading-[15px] text-muted">
            Use this when a company opts out or must not be contacted again.
          </p>
          <ExcludeButton name={company.name} />
        </Card>

        <Card padding="p-[18px]">
          <CardHeader
            size="sm"
            title="Print history"
            aside={<StatusBadge tone="neutral" size="sm">None</StatusBadge>}
          />
          <p className="mt-1.5 text-[11px] leading-[15px] text-muted">No letter has been printed for this company yet.</p>
          <Link
            href="/print/preview"
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold leading-[15px] text-ink hover:text-brand"
          >
            <Icon icon={faPlus} size={10} />
            Print letter
          </Link>
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
          <p className="mt-1 text-[11px] leading-[15px] text-muted">No internal notes yet. Notes are visible to your team only.</p>
        </Card>
      </div>
    </div>
  );
}
