import Link from "next/link";
import { notFound } from "next/navigation";
import {
  faArrowRight,
  faArrowsRotate,
  faBuilding,
  faCheck,
  faChevronRight,
  faLocationDot,
  faPaperPlane,
  faPrint,
  faTags,
  faUpRightFromSquare,
  faXmark,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { CompanyDetail } from "@/lib/companies/queries";
import { formatDate, sicDescription } from "@/lib/companies/format";
import { formatSaTime } from "@/lib/pull/dates";
import { cn } from "@/lib/cn";
import { CompanyActions } from "./company-actions";
import { CompanyTabs } from "./company-tabs";
import { loadCompany, STATE_BADGE } from "./data";

export default async function CompanyLayout({ children, params }: LayoutProps<"/new-companies/[number]">) {
  const { number } = await params;
  const c = await loadCompany(number);
  if (!c) notFound();

  const badge = STATE_BADGE[c.state];
  const primarySic = c.sicCodes[0];

  return (
    <>
      <nav aria-label="Breadcrumb" className="-mb-0.5 flex items-center gap-[7px] text-[11px] font-medium leading-[15px]">
        <Link href="/new-companies" className="text-muted hover:text-ink hover:underline">
          New Companies
        </Link>
        <span className="text-muted">
          <Icon icon={faChevronRight} size={8} />
        </span>
        <span aria-current="page" className="text-ink">
          {c.name}
        </span>
      </nav>

      <PageHeader
        className="min-h-[78px]"
        title={c.name}
        badge={<StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
        description={
          <span className="text-[12px] leading-[17px]">
            Company no. {c.number} · {c.status.replace(/^\w/, (s) => s.toUpperCase())} · Incorporated {c.incorporated}
          </span>
        }
        actions={
          <>
            <ButtonLink
              variant="secondary"
              icon={faUpRightFromSquare}
              href={`https://find-and-update.company-information.service.gov.uk/company/${c.number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Companies House
            </ButtonLink>
            <CompanyActions
              number={c.number}
              name={c.name}
              state={c.state}
              fix={{
                number: c.number,
                name: c.name,
                registeredText: `${c.registeredAddress || "no address"}${c.registeredOffice.postcode ? "" : " — postcode missing"}`,
                line1: c.posting.line1 ?? "",
                line2: c.posting.line2 ?? "",
                town: c.posting.town ?? "",
                postcode: c.posting.postcode ?? "",
              }}
            />
          </>
        }
      />

      {/* Summary strip */}
      <section aria-label="Summary" className="rounded-[14px] border border-line bg-white p-[18px]">
        <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-[340fr_300fr_300fr_300fr_300fr]">
          <SummaryItem
            icon={faLocationDot}
            label={c.postingAddress ? "Posting address (fixed)" : "Registered office"}
            value={c.posting.line1 || "No address"}
            sub={[c.posting.town, c.posting.postcode].filter(Boolean).join(" · ") || "Postcode missing"}
            first
          />
          <SummaryItem icon={faBuilding} label="Company type" value={c.typeLabel} />
          <SummaryItem
            icon={faTags}
            label="Primary SIC"
            value={primarySic ?? "—"}
            sub={primarySic ? sicDescription(primarySic) || undefined : undefined}
          />
          <SummaryItem
            icon={faArrowsRotate}
            label="Record"
            value={`Imported ${formatSaTime(c.importedAt)}`}
            sub={`Found in the ${formatDate(c.importedAt.toISOString())} pull`}
          />
          <SummaryItem
            icon={faPaperPlane}
            label="Letter"
            value={c.state === "printed" || c.state === "posted" ? "Printed" : "Not printed yet"}
            sub={c.state === "excluded" ? "Excluded" : c.state === "skipped" ? "Won’t get a letter" : "Not excluded"}
          />
        </div>
      </section>

      <LetterJourney c={c} />
      <CompanyTabs number={c.number} />
      {children}
    </>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  sub,
  first,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  sub?: string;
  first?: boolean;
}) {
  return (
    <div className={cn("flex min-h-[90px] min-w-0 items-center gap-3 px-3.5", !first && "lg:border-l lg:border-line")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-canvas text-ink">
        <Icon icon={icon} size={13} />
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[10px] font-medium leading-[14px] text-muted">{label}</span>
        <span className="truncate text-[12px] font-medium leading-4 text-ink" title={value}>
          {value}
        </span>
        {sub ? (
          <span className="truncate text-[11px] leading-[15px] text-muted" title={sub}>
            {sub}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LetterJourney({ c }: { c: CompanyDetail }) {
  const blocked = c.state === "excluded" || c.state === "skipped" || c.state === "address_issue";
  const failed = c.checks.find((x) => !x.passed);
  const order = ["found", "checked", "run", "printed", "posted"] as const;
  const reachedIndex =
    c.state === "posted" ? 4 : c.state === "printed" ? 3 : c.state === "added" ? 2 : blocked ? 1 : 1;

  const steps = [
    { key: "found", label: "Found", sub: `${c.incorporated} · ${formatSaTime(c.importedAt)}` },
    {
      key: "checked",
      label: blocked ? (c.state === "excluded" ? "Excluded" : c.state === "address_issue" ? "Address issue" : "Skipped") : "Checked",
      sub: blocked ? (c.state === "excluded" ? "On the do-not-contact list" : failed?.label ?? "Skipped by hand") : `Passed all ${c.checks.length} checks`,
    },
    { key: "run", label: c.state === "added" ? "In today’s print run" : "Print run", sub: c.state === "added" ? "Waiting to print" : "—" },
    { key: "printed", label: "Printed", sub: "—" },
    { key: "posted", label: "Posted", sub: "—" },
  ];

  const next =
    c.state === "added"
      ? "Next: prints in today’s run"
      : c.state === "not_reviewed"
        ? "Next: add to a print run"
        : c.state === "address_issue"
          ? "Next: fix the posting address"
          : c.state === "printed"
            ? "Next: confirm it was posted"
            : null;

  return (
    <section
      aria-label="Letter journey"
      className={cn("flex flex-col gap-3.5 rounded-2xl border bg-white px-6 py-5", blocked ? "border-line" : "border-info-subtle")}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="text-[16px] font-bold leading-[22px] text-ink">Letter journey</h2>
        <p className="text-[12px] leading-4 text-muted">Each company gets one letter — this is where it is right now</p>
        {next ? (
          <span className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-full bg-info-subtle pl-2.5 pr-3 text-[12px] font-medium text-info">
            <Icon icon={faArrowRight} size={10} />
            {next}
          </span>
        ) : null}
      </div>
      <ol className="flex">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const done = i < reachedIndex || (i === reachedIndex && (s.key === "posted" || (s.key === "checked" && !blocked)));
          const current = i === reachedIndex && !done;
          const stopped = s.key === "checked" && blocked;
          return (
            <li key={s.key} className={cn("flex flex-col gap-2", last ? "shrink-0" : "flex-1")}>
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    stopped ? "bg-danger-subtle text-danger" : done || current ? "bg-brand text-white" : "bg-n100 text-muted",
                    current && !stopped && "shadow-[0_0_0_4px_rgb(3_168_78/0.16)]",
                  )}
                >
                  {stopped ? (
                    <Icon icon={faXmark} size={11} />
                  ) : done ? (
                    <Icon icon={faCheck} size={11} />
                  ) : current ? (
                    <Icon icon={faPrint} size={11} />
                  ) : (
                    i + 1
                  )}
                </span>
                {!last ? <span className={cn("h-0.5 flex-1", i < reachedIndex && !stopped ? "bg-brand" : "bg-n100")} /> : null}
              </div>
              <span
                className={cn(
                  "text-[13px] leading-[18px]",
                  current || stopped ? "font-bold text-ink" : i <= reachedIndex ? "font-medium text-ink" : "font-medium text-muted",
                )}
              >
                {s.label}
              </span>
              <span className="text-[11px] leading-[15px] text-muted">{order[i] === "found" || i <= reachedIndex ? s.sub : "—"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
