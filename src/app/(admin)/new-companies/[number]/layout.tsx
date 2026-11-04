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
  faPlus,
  faPrint,
  faTags,
  faUpRightFromSquare,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { CompanyTabs } from "./company-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { findCompany } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

export default async function CompanyLayout({ children, params }: LayoutProps<"/new-companies/[number]">) {
  const { number } = await params;
  const company = findCompany(number);
  if (!company) notFound();
  const [street, town, postcode] = company.addressLines;

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
          {company.name}
        </span>
      </nav>

      <PageHeader
        className="min-h-[78px]"
        title={company.name}
        badge={<StatusBadge tone="info">Added</StatusBadge>}
        description={
          <span className="text-[12px] leading-[17px]">
            Company no. {company.number} · Active · Incorporated 22 Sep 2026
          </span>
        }
        actions={
          <>
            <ButtonLink
              variant="secondary"
              icon={faUpRightFromSquare}
              href={`https://find-and-update.company-information.service.gov.uk/company/${company.number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Companies House
            </ButtonLink>
            <ButtonLink icon={faPlus} href="/print/preview">
              Print letter
            </ButtonLink>
          </>
        }
      />

      {/* Summary strip */}
      <section aria-label="Summary" className="rounded-[14px] border border-line bg-white p-[18px]">
        <div className="grid grid-cols-2 gap-y-3 lg:grid-cols-[340fr_300fr_300fr_300fr_300fr]">
          <SummaryItem icon={faLocationDot} label="Registered office" value={street} sub={`${town} · ${postcode}`} first />
          <SummaryItem icon={faBuilding} label="Company type" value="Private limited company" />
          <SummaryItem icon={faTags} label="Primary SIC" value={company.sic.split(" · ")[0]} sub="Computer consultancy activities" />
          <SummaryItem icon={faArrowsRotate} label="Record" value="Imported 06:00" sub="Found in the 06:00 pull" />
          <SummaryItem icon={faPaperPlane} label="Letter" value="Not printed yet" sub="Not excluded" />
        </div>
      </section>

      <LetterJourney />

      <CompanyTabs number={company.number} />

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
    <div className={cn("flex min-h-[90px] items-center gap-3 px-3.5", !first && "lg:border-l lg:border-line")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-canvas text-ink">
        <Icon icon={icon} size={13} />
      </span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[10px] font-medium leading-[14px] text-muted">{label}</span>
        <span className="truncate text-[12px] font-medium leading-4 text-ink">{value}</span>
        {sub ? <span className="truncate text-[11px] leading-[15px] text-muted">{sub}</span> : null}
      </div>
    </div>
  );
}

const STEPS = [
  { label: "Found", sub: "22 Sep 2026 · 06:00", state: "done" },
  { label: "Checked", sub: "Passed all 7 checks", state: "done" },
  { label: "In today’s print run", sub: "Letter 1 of 10", state: "current" },
  { label: "Printed", sub: "—", state: "todo" },
  { label: "Posted", sub: "—", state: "todo" },
] as const;

function LetterJourney() {
  return (
    <section aria-label="Letter journey" className="flex flex-col gap-3.5 rounded-2xl border border-info-subtle bg-white px-6 py-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="text-[16px] font-bold leading-[22px] text-ink">Letter journey</h2>
        <p className="text-[12px] leading-4 text-muted">Each company gets one letter — this is where it is right now</p>
        <span className="ml-auto inline-flex h-[26px] items-center gap-1.5 rounded-full bg-info-subtle pl-2.5 pr-3 text-[12px] font-medium text-info">
          <Icon icon={faArrowRight} size={10} />
          Next: prints in today’s run
        </span>
      </div>
      <ol className="flex">
        {STEPS.map((s, i) => {
          const last = i === STEPS.length - 1;
          const reached = s.state !== "todo";
          return (
            <li key={s.label} className={cn("flex flex-col gap-2", last ? "shrink-0" : "flex-1")}>
              <div className="flex items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    reached ? "bg-brand text-white" : "bg-n100 text-muted",
                    s.state === "current" && "shadow-[0_0_0_4px_rgb(3_168_78/0.16)]",
                  )}
                >
                  {s.state === "done" ? <Icon icon={faCheck} size={11} /> : s.state === "current" ? <Icon icon={faPrint} size={11} /> : i + 1}
                </span>
                {!last ? <span className={cn("h-0.5 flex-1", s.state === "done" ? "bg-brand" : "bg-n100")} /> : null}
              </div>
              <span
                className={cn(
                  "text-[13px] leading-[18px]",
                  s.state === "current" ? "font-bold text-ink" : reached ? "font-medium text-ink" : "font-medium text-muted",
                )}
              >
                {s.label}
              </span>
              <span className="text-[11px] leading-[15px] text-muted">{s.sub}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
