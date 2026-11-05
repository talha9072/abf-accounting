"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  faArrowUpRightFromSquare,
  faBan,
  faBuilding,
  faCalendar,
  faChevronRight,
  faEllipsisVertical,
  faEye,
  faFileExport,
  faLocationDot,
  faMagnifyingGlass,
  faPlus,
  faPrint,
  faShieldHalved,
  faTags,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { DataRow, DataTable, Pager } from "@/components/admin/table";
import { ExportModal, FixAddressModal } from "@/components/admin/company-modals";
import { usePull, usePullHeadline } from "@/components/admin/pull-center";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { DotState } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { MenuItem, Popover } from "@/components/ui/popover";
import { ViewChips } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { companies, feedCounts, type CompanyRow } from "@/lib/mock-data";

const COLUMNS =
  "28px minmax(220px,388fr) 96px 150px minmax(220px,300fr) 104px minmax(170px,220fr) 96px 84px";

type ModalKey = "export" | "fix" | null;

export function CompaniesFeed({ view, initialModal }: { view: string; initialModal: ModalKey }) {
  const router = useRouter();
  const toast = useToast();
  const pull = usePullHeadline();
  const { open: openPull } = usePull();
  const [modal, setModal] = useState<ModalKey>(initialModal);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(companies.filter((c) => c.state === "added").map((c) => c.number)),
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? companies.filter((c) => c.name.toLowerCase().includes(term) || c.number.includes(term)) : companies;
  }, [query]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.number));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.number));

  const toggle = (n: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const views = [
    { key: "all", label: "All", count: feedCounts.all },
    { key: "not-reviewed", label: "Not reviewed", count: feedCounts.notReviewed },
    { key: "in-run", label: "Added to print run", count: feedCounts.addedToRun },
    { key: "sent", label: "Sent", count: feedCounts.sent },
    { key: "address-issue", label: "Address issue", count: feedCounts.addressIssue },
    { key: "excluded", label: "Excluded", count: feedCounts.excluded },
  ];

  return (
    <>
      <PageHeader
        title="New Companies"
        description="Every morning we pull every company incorporated since the last successful pull from Companies House. Choose who gets a letter and send them to print."
        actions={
          <>
            <Button variant="secondary" icon={faFileExport} onClick={() => setModal("export")}>
              Export
            </Button>
            <ButtonLink href="/print" icon={faPrint}>
              Go to print ({selected.size})
            </ButtonLink>
          </>
        }
      />

      {/* Today's pull banner — live from the latest pull */}
      <div
        className={
          pull.failed && !pull.running
            ? "flex min-h-[46px] flex-wrap items-center gap-2.5 rounded-[10px] bg-danger-subtle px-3.5 py-2 text-[#7f1d1d]"
            : "flex min-h-[46px] flex-wrap items-center gap-2.5 rounded-[10px] bg-mint px-3.5 py-2 text-ink"
        }
      >
        <Icon icon={pull.failed && !pull.running ? faTriangleExclamation : faShieldHalved} size={13} />
        <p className="flex-1 text-[12px] font-medium leading-4">
          {pull.running ? (
            <>Pulling new companies from Companies House… the list updates when it finishes</>
          ) : pull.failed ? (
            <>
              {pull.failedManual
                ? `The last “Run pull now” didn’t finish (${pull.lastCheck}) — nothing was changed.`
                : `Today’s pull didn’t finish (${pull.lastCheck}) — it retries every 30 minutes.`}{" "}
              <button type="button" onClick={() => openPull("pull-failed")} className="font-bold underline">
                Details
              </button>
            </>
          ) : pull.time ? (
            <>
              Latest pull: {pull.found.toLocaleString("en-GB")} new companies found at {pull.time} ·{" "}
              {pull.ready.toLocaleString("en-GB")} ready for a letter · excluded companies are skipped automatically
            </>
          ) : (
            <>No pull has run yet — the first one runs at 06:00 (South Africa time), or start it now.</>
          )}
          {!pull.running && !pull.failed ? (
            <>
              {" "}
              <button type="button" onClick={() => openPull("pull")} className="font-bold underline underline-offset-2">
                {pull.time ? "Pull details" : "Run pull now"}
              </button>
            </>
          ) : null}
        </p>
        <Link
          href="/history?tab=excluded"
          className="inline-flex items-center gap-2.5 rounded text-[11px] font-bold leading-[15px] hover:underline"
        >
          View excluded ({feedCounts.excluded})
          <Icon icon={faChevronRight} size={9} />
        </Link>
      </div>

      <ViewChips
        items={views.map((v) => ({
          label: v.label,
          count: v.count,
          href: v.key === "all" ? "/new-companies" : `/new-companies?view=${v.key}`,
          active: view === v.key,
        }))}
      />

      {/* Filters */}
      <section aria-label="Filters" className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput
            icon={faMagnifyingGlass}
            placeholder="Search company name or number"
            aria-label="Search company name or number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-[388px] flex-[2_1_260px]"
          />
          <FilterDropdown
            className="w-[168px]"
            icon={faCalendar}
            label="Incorporated"
            options={["Since last pull (default)", "Last 7 days", "Last 30 days", "Custom range…"]}
            footnote="Same pattern for Company type, SIC, Location and Letter filters."
          />
          <FilterDropdown
            className="w-[154px]"
            icon={faBuilding}
            label="Company type"
            options={["Ltd, LLP", "Ltd only", "LLP only", "All types"]}
          />
          <FilterDropdown
            className="w-[154px]"
            icon={faTags}
            label="SIC / industry"
            options={["All", "62 · IT & software", "70 · Consultancy", "47 · Retail", "68 · Property"]}
          />
          <FilterDropdown
            className="w-[142px]"
            icon={faLocationDot}
            label="Location"
            options={["All UK", "England", "Wales", "Scotland", "Northern Ireland"]}
          />
        </div>
        <div className="flex h-6 items-center justify-end gap-4 text-[11px] leading-[15px]">
          <button type="button" onClick={() => setQuery("")} className="font-medium text-muted hover:text-ink">
            Clear filters
          </button>
          <button type="button" className="font-bold text-ink hover:underline">
            Save as view
          </button>
        </div>
      </section>

      {/* Bulk toolbar — 52px tall so the 36px buttons sit inside it (Figma had 44px buttons overflowing a 44px bar). */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-3 rounded-[10px] border border-line bg-white py-2 pl-3 pr-2">
        <Checkbox
          aria-label="Select all on this page"
          checked={allSelected}
          indeterminate={someSelected}
          onChange={() =>
            setSelected(allSelected || someSelected ? new Set() : new Set(rows.map((r) => r.number)))
          }
        />
        <span className="text-[12px] font-medium leading-4 text-muted">{selected.size} selected</span>
        <span className="text-muted">·</span>
        <button
          type="button"
          onClick={() => setSelected(new Set(rows.map((r) => r.number)))}
          className="text-[12px] font-semibold leading-4 text-brand underline underline-offset-2 hover:text-brand-hover"
        >
          Select all {feedCounts.all}
        </button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={faBan}
            disabled={selected.size === 0}
            onClick={() => toast({ message: `${selected.size} companies excluded`, actionLabel: "Undo" })}
          >
            Exclude
          </Button>
          <Button
            size="sm"
            icon={faPlus}
            disabled={selected.size === 0}
            onClick={() => toast({ message: `${selected.size} companies added to today’s print run`, actionLabel: "Undo" })}
          >
            Add to print run
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        bodyClassName="max-h-[max(360px,calc(100vh-628px))]"
        header={
          <>
            <Checkbox
              aria-label="Select all on this page"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.number)))}
            />
            <span>Company</span>
            <span>Company no.</span>
            <span>Director</span>
            <span>Registered address</span>
            <span>Incorporated</span>
            <span>Industry (SIC)</span>
            <span>Print run</span>
            <span className="sr-only">Actions</span>
          </>
        }
        footer={
          <>
            <span className="text-[12px] text-muted">
              1–{rows.length} of {query ? rows.length : feedCounts.all} companies
            </span>
            <Pager />
          </>
        }
      >
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">No companies match “{query}”.</p>
        ) : (
          rows.map((c, i) => (
            <CompanyTableRow
              key={c.number}
              company={c}
              index={i}
              checked={selected.has(c.number)}
              onToggle={() => toggle(c.number)}
              onOpen={() => router.push(`/new-companies/${c.number}`)}
              onFix={() => setModal("fix")}
              onExclude={() => toast({ message: `${c.name} excluded`, actionLabel: "Undo" })}
            />
          ))
        )}
      </DataTable>

      <ExportModal open={modal === "export"} onClose={() => setModal(null)} selected={selected.size} />
      <FixAddressModal open={modal === "fix"} onClose={() => setModal(null)} />
    </>
  );
}

function CompanyTableRow({
  company: c,
  index,
  checked,
  onToggle,
  onOpen,
  onFix,
  onExclude,
}: {
  company: CompanyRow;
  index: number;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onFix: () => void;
  onExclude: () => void;
}) {
  return (
    <DataRow index={index}>
      <Checkbox aria-label={`Select ${c.name}`} checked={checked} onChange={onToggle} />
      <Link href={`/new-companies/${c.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
        {c.name}
      </Link>
      <span className="text-muted tabular-nums">{c.number}</span>
      <span className="truncate text-ink">{c.director}</span>
      <span className="truncate text-muted">{c.address}</span>
      <span className="text-muted">{c.incorporated}</span>
      <span className="truncate text-muted">{c.sic}</span>
      <span>{checked ? <DotState tone="info">Added</DotState> : <DotState tone="neutral">Not added</DotState>}</span>
      <span className="flex items-center justify-between gap-1">
        <button type="button" onClick={onExclude} className="text-brand hover:underline">
          Exclude
        </button>
        <Popover
          panelClassName="w-[260px]"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={`More actions for ${c.name}`}
              aria-expanded={open}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-n100 hover:text-ink"
            >
              <Icon icon={faEllipsisVertical} size={12} />
            </button>
          )}
        >
          {(close) => (
            <div role="menu" className="flex flex-col gap-0.5">
              <MenuItem icon={faEye} onClick={onOpen}>
                View company
              </MenuItem>
              <MenuItem icon={faPrint} onClick={close}>
                Print letter now
              </MenuItem>
              <MenuItem
                icon={faLocationDot}
                onClick={() => {
                  close();
                  onFix();
                }}
              >
                Fix posting address
              </MenuItem>
              <MenuItem
                icon={faArrowUpRightFromSquare}
                href={`https://find-and-update.company-information.service.gov.uk/company/${c.number}`}
              >
                Open on Companies House
              </MenuItem>
              <MenuItem
                icon={faBan}
                tone="danger"
                onClick={() => {
                  close();
                  onExclude();
                }}
              >
                Exclude
              </MenuItem>
            </div>
          )}
        </Popover>
      </span>
    </DataRow>
  );
}
