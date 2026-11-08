"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  faArrowUpRightFromSquare,
  faBan,
  faBuilding,
  faCalendar,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faEllipsisVertical,
  faEye,
  faFileExport,
  faLocationDot,
  faMagnifyingGlass,
  faMinus,
  faPlus,
  faPrint,
  faShieldHalved,
  faSpinner,
  faTags,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { DataRow, DataTable } from "@/components/admin/table";
import { ExportModal, FixAddressModal, type FixAddressTarget } from "@/components/admin/company-modals";
import { usePull, usePullHeadline } from "@/components/admin/pull-center";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { DotState, type Tone } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { MenuItem, Popover } from "@/components/ui/popover";
import { ViewChips } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  addToRunAction,
  excludeCompaniesAction,
  removeFromRunAction,
  undoExcludeAction,
  type ActionResult,
  type Target,
} from "@/lib/companies/actions";
import type { FeedCounts, FeedFilters, FeedRow } from "@/lib/companies/queries";
import { SIC_SECTIONS } from "@/lib/companies/format";
import { cn } from "@/lib/cn";

const COLUMNS = "28px minmax(220px,388fr) 96px 150px minmax(220px,300fr) 104px minmax(170px,220fr) 120px 96px";

const VIEWS: Array<{ key: FeedFilters["view"]; label: string }> = [
  { key: "all", label: "All" },
  { key: "not-reviewed", label: "Not reviewed" },
  { key: "in-run", label: "Added to print run" },
  { key: "sent", label: "Sent" },
  { key: "address-issue", label: "Address issue" },
  { key: "excluded", label: "Excluded" },
  { key: "skipped", label: "Skipped by rules" },
];

const SKIP_LABEL: Record<string, string> = {
  company_type: "Company type",
  not_shared_address: "Agent address",
  not_own_office: "Our office",
  not_ch_default: "CH default address",
  not_printed_before: "Printed before",
  manual: "Skipped by hand",
};

const fmt = (n: number) => n.toLocaleString("en-GB");

type Data = { rows: FeedRow[]; counts: FeedCounts; total: number; page: number; pages: number };

export function CompaniesFeed({
  data,
  filters,
  initialModal,
}: {
  data: Data;
  filters: FeedFilters;
  initialModal: "export" | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const pull = usePullHeadline();
  const { open: openPull } = usePull();
  const [busy, startTransition] = useTransition();

  const [modal, setModal] = useState<"export" | "fix" | null>(initialModal);
  const [fixTarget, setFixTarget] = useState<FixAddressTarget | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [query, setQuery] = useState(filters.q);

  // The selection belongs to one page of one list — clear it when the list changes.
  const listKey = searchParams.toString();
  const lastKey = useRef(listKey);
  useEffect(() => {
    if (lastKey.current !== listKey) {
      lastKey.current = listKey;
      setSelected(new Set());
      setAllMatching(false);
    }
  }, [listKey]);

  /* ---------- URL helpers ---------- */
  const hrefWith = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all" || (k === "inc" && v === "since-last") || (k === "page" && v === 1) || (k === "per" && v === 50))
        sp.delete(k);
      else sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const go = (patch: Record<string, string | number | null>) => router.push(hrefWith({ page: null, ...patch }), { scroll: false });

  // Debounced search box → ?q=
  useEffect(() => {
    if (query.trim() === filters.q) return;
    const t = setTimeout(() => router.replace(hrefWith({ q: query.trim() || null, page: null }), { scroll: false }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /* ---------- selection ---------- */
  const pageNumbers = useMemo(() => data.rows.map((r) => r.number), [data.rows]);
  const allOnPage = pageNumbers.length > 0 && pageNumbers.every((n) => selected.has(n));
  const someOnPage = !allOnPage && pageNumbers.some((n) => selected.has(n));
  const selectedCount = allMatching ? data.total : selected.size;
  const target: Target = allMatching ? { query: listKey } : { numbers: [...selected] };

  const toggle = (n: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected(allOnPage || someOnPage ? new Set() : new Set(pageNumbers));
  };

  /* ---------- actions ---------- */
  const run = (
    action: () => Promise<ActionResult>,
    describe: (count: number) => string,
    undo?: (numbers: string[]) => Promise<ActionResult>,
  ) =>
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        toast({ message: r.message });
        return;
      }
      setSelected(new Set());
      setAllMatching(false);
      router.refresh();
      toast({
        message: r.count ? describe(r.count) : "Nothing changed — those companies can’t take that action",
        ...(undo && r.count
          ? {
              actionLabel: "Undo",
              onAction: () =>
                startTransition(async () => {
                  await undo(r.numbers);
                  router.refresh();
                }),
            }
          : {}),
      });
    });

  const exclude = (t: Target) =>
    run(() => excludeCompaniesAction(t), (n) => `${fmt(n)} ${n === 1 ? "company" : "companies"} excluded`, undoExcludeAction);
  const addToRun = (t: Target) =>
    run(() => addToRunAction(t), (n) => `${fmt(n)} added to today’s print run`, removeFromRunAction);
  const removeFromRun = (numbers: string[]) =>
    run(() => removeFromRunAction(numbers), (n) => `${fmt(n)} removed from the print run`);
  const unexclude = (numbers: string[]) =>
    run(() => undoExcludeAction(numbers), (n) => `${fmt(n)} ${n === 1 ? "company is" : "companies are"} no longer excluded`);

  const openFix = (r: FeedRow) => {
    setFixTarget({ number: r.number, name: r.name, ...r.fix });
    setModal("fix");
  };

  const sicOptions = [{ value: "all", label: "All" }, ...SIC_SECTIONS.map((s) => ({ value: s.key, label: `${s.key} · ${s.label}` }))];
  const first = (data.page - 1) * filters.per + 1;
  const last = first + data.rows.length - 1;

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
              Go to print ({fmt(data.counts["in-run"])})
            </ButtonLink>
          </>
        }
      />

      {/* Latest pull banner */}
      <div
        className={cn(
          "flex min-h-[46px] flex-wrap items-center gap-2.5 rounded-[10px] px-3.5 py-2",
          pull.failed && !pull.running ? "bg-danger-subtle text-[#7f1d1d]" : "bg-mint text-ink",
        )}
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
              Latest pull: {fmt(pull.found)} new companies found at {pull.time} · {fmt(pull.ready)} ready for a letter · excluded companies
              are skipped automatically{" "}
              <button type="button" onClick={() => openPull("pull")} className="font-bold underline underline-offset-2">
                Pull details
              </button>
            </>
          ) : (
            <>
              No pull has run yet — the first one runs at 06:00 (South Africa time).{" "}
              <button type="button" onClick={() => openPull("pull")} className="font-bold underline underline-offset-2">
                Run pull now
              </button>
            </>
          )}
        </p>
        <Link
          href={hrefWith({ view: "excluded", page: null })}
          className="inline-flex items-center gap-2.5 rounded text-[11px] font-bold leading-[15px] hover:underline"
        >
          View excluded ({fmt(data.counts.excluded)})
          <Icon icon={faChevronRight} size={9} />
        </Link>
      </div>

      <ViewChips
        items={VIEWS.map((v) => ({
          label: v.label,
          count: fmt(data.counts[v.key]),
          href: hrefWith({ view: v.key, page: null }),
          active: filters.view === v.key,
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
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-[388px] flex-[2_1_260px]"
          />
          <FilterDropdown
            className="w-[168px]"
            icon={faCalendar}
            label="Incorporated"
            value={filters.inc}
            onChange={(v) => go({ inc: v })}
            options={[
              { value: "since-last", label: "Since last pull (default)" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "all", label: "Any date" },
            ]}
          />
          <FilterDropdown
            className="w-[154px]"
            icon={faBuilding}
            label="Company type"
            value={filters.type}
            onChange={(v) => go({ type: v })}
            options={[
              { value: "all", label: "All types" },
              { value: "ltd", label: "Ltd" },
              { value: "llp", label: "LLP" },
              { value: "other", label: "Other types" },
            ]}
          />
          <FilterDropdown
            className="w-[180px]"
            icon={faTags}
            label="SIC / industry"
            value={filters.sic}
            onChange={(v) => go({ sic: v })}
            options={sicOptions}
          />
          <FilterDropdown
            className="w-[150px]"
            icon={faLocationDot}
            label="Location"
            value={filters.loc}
            onChange={(v) => go({ loc: v })}
            options={[
              { value: "all", label: "All UK" },
              { value: "england", label: "England" },
              { value: "wales", label: "Wales" },
              { value: "scotland", label: "Scotland" },
              { value: "northern-ireland", label: "Northern Ireland" },
            ]}
          />
        </div>
        <div className="flex h-6 items-center justify-end gap-4 text-[11px] leading-[15px]">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.push(filters.view === "all" ? pathname : `${pathname}?view=${filters.view}`, { scroll: false });
            }}
            className="font-medium text-muted hover:text-ink"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* Bulk toolbar — 52px tall so the 36px buttons sit inside it. */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-3 rounded-[10px] border border-line bg-white py-2 pl-3 pr-2">
        <Checkbox aria-label="Select all on this page" checked={allOnPage} indeterminate={someOnPage} onChange={togglePage} />
        <span className="text-[12px] font-medium leading-4 text-muted">{fmt(selectedCount)} selected</span>
        {data.total > data.rows.length && (allOnPage || allMatching) ? (
          <>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={() => setAllMatching((v) => !v)}
              className="text-[12px] font-semibold leading-4 text-brand underline underline-offset-2 hover:text-brand-hover"
            >
              {allMatching ? "Select this page only" : `Select all ${fmt(data.total)}`}
            </button>
          </>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" icon={busy ? faSpinner : faBan} disabled={busy || selectedCount === 0} onClick={() => exclude(target)}>
            Exclude
          </Button>
          <Button size="sm" icon={busy ? faSpinner : faPlus} disabled={busy || selectedCount === 0} onClick={() => addToRun(target)}>
            Add to print run
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        className={busy ? "opacity-70 transition-opacity" : "transition-opacity"}
        bodyClassName="max-h-[max(360px,calc(100vh-628px))]"
        header={
          <>
            <Checkbox aria-label="Select all on this page" checked={allOnPage} indeterminate={someOnPage} onChange={togglePage} />
            <span>Company</span>
            <span>Company no.</span>
            <span>Director</span>
            <span>Posting address</span>
            <span>Incorporated</span>
            <span>Industry (SIC)</span>
            <span>Print run</span>
            <span>
              <span className="sr-only">Actions</span>
            </span>
          </>
        }
        footer={
          <>
            <span className="text-[12px] text-muted">
              {data.total ? `${fmt(first)}–${fmt(last)} of ${fmt(data.total)} companies` : "No companies"}
            </span>
            <PagerLinks page={data.page} pages={data.pages} per={filters.per} hrefFor={(p) => hrefWith({ page: p })} onPer={(per) => go({ per })} />
          </>
        }
      >
        {data.rows.length === 0 ? (
          <EmptyState filtered={Boolean(filters.q) || filters.type !== "all" || filters.sic !== "all" || filters.loc !== "all"} />
        ) : (
          data.rows.map((r, i) => (
            <CompanyTableRow
              key={r.number}
              row={r}
              index={i}
              checked={allMatching || selected.has(r.number)}
              onToggle={() => toggle(r.number)}
              onOpen={() => router.push(`/new-companies/${r.number}`)}
              onFix={() => openFix(r)}
              onExclude={() => exclude({ numbers: [r.number] })}
              onAdd={() => addToRun({ numbers: [r.number] })}
              onRemove={() => removeFromRun([r.number])}
              onUnexclude={() => unexclude([r.number])}
            />
          ))
        )}
      </DataTable>

      <ExportModal
        open={modal === "export"}
        onClose={() => setModal(null)}
        filtered={data.total}
        selected={allMatching ? [] : [...selected]}
        query={listKey}
      />
      <FixAddressModal
        open={modal === "fix"}
        onClose={() => setModal(null)}
        target={fixTarget}
        onSaved={(message) => {
          router.refresh();
          toast({ message });
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function stateView(r: FeedRow): { tone: Tone; label: string } {
  switch (r.state) {
    case "added":
      return { tone: "info", label: "Added" };
    case "address_issue":
      return { tone: "warning", label: "Address issue" };
    case "excluded":
      return { tone: "danger", label: "Excluded" };
    case "skipped":
      return { tone: "neutral", label: SKIP_LABEL[r.skipReason ?? ""] ?? "Skipped" };
    case "printed":
      return { tone: "success", label: "Printed" };
    case "posted":
      return { tone: "success", label: "Sent" };
    default:
      return { tone: "neutral", label: "Not added" };
  }
}

function CompanyTableRow({
  row: r,
  index,
  checked,
  onToggle,
  onOpen,
  onFix,
  onExclude,
  onAdd,
  onRemove,
  onUnexclude,
}: {
  row: FeedRow;
  index: number;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onFix: () => void;
  onExclude: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onUnexclude: () => void;
}) {
  const st = stateView(r);
  const primary =
    r.state === "not_reviewed"
      ? { label: "Exclude", onClick: onExclude }
      : r.state === "added"
        ? { label: "Remove", onClick: onRemove }
        : r.state === "address_issue"
          ? { label: "Fix address", onClick: onFix }
          : r.state === "excluded"
            ? { label: "Undo", onClick: onUnexclude }
            : null;

  return (
    <DataRow index={index} highlight={r.state === "address_issue" ? "warning" : undefined}>
      <Checkbox aria-label={`Select ${r.name}`} checked={checked} onChange={onToggle} />
      <Link
        href={`/new-companies/${r.number}`}
        prefetch={false}
        className={cn("truncate font-medium hover:text-brand hover:underline", r.state === "skipped" || r.state === "excluded" ? "text-muted" : "text-ink")}
        title={r.name}
      >
        {r.name}
      </Link>
      <span className="text-muted tabular-nums">{r.number}</span>
      <span className="truncate text-ink" title={r.director}>
        {r.director}
      </span>
      <span className={cn("truncate", r.state === "address_issue" ? "text-warning" : "text-muted")} title={r.address}>
        {r.address || "No address"}
        {r.postingFixed ? <span className="ml-1.5 rounded bg-mint px-1 text-[10px] text-brand">fixed</span> : null}
      </span>
      <span className="text-muted">{r.incorporated}</span>
      <span className="truncate text-muted" title={r.sic}>
        {r.sic}
      </span>
      <span>
        <DotState tone={st.tone}>{st.label}</DotState>
      </span>
      <span className="flex items-center justify-between gap-1">
        {primary ? (
          <button type="button" onClick={primary.onClick} className="text-brand hover:underline">
            {primary.label}
          </button>
        ) : (
          <span className="text-muted">—</span>
        )}
        <Popover
          fixed
          panelClassName="w-[260px]"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={`More actions for ${r.name}`}
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
              {r.state === "not_reviewed" ? (
                <MenuItem icon={faPlus} onClick={() => (close(), onAdd())}>
                  Add to print run
                </MenuItem>
              ) : null}
              {r.state === "added" ? (
                <MenuItem icon={faMinus} onClick={() => (close(), onRemove())}>
                  Remove from print run
                </MenuItem>
              ) : null}
              <MenuItem icon={faLocationDot} onClick={() => (close(), onFix())}>
                Fix posting address
              </MenuItem>
              <MenuItem icon={faArrowUpRightFromSquare} href={`https://find-and-update.company-information.service.gov.uk/company/${r.number}`}>
                Open on Companies House
              </MenuItem>
              {r.state === "excluded" ? (
                <MenuItem icon={faBan} onClick={() => (close(), onUnexclude())}>
                  Remove exclusion
                </MenuItem>
              ) : r.state !== "printed" && r.state !== "posted" ? (
                <MenuItem icon={faBan} tone="danger" onClick={() => (close(), onExclude())}>
                  Exclude
                </MenuItem>
              ) : null}
            </div>
          )}
        </Popover>
      </span>
    </DataRow>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
      <p className="text-[14px] font-bold text-ink">{filtered ? "No companies match these filters" : "No companies here yet"}</p>
      <p className="text-[12px] text-muted">
        {filtered ? "Try clearing the filters or searching for something else." : "They appear after the next pull from Companies House."}
      </p>
    </div>
  );
}

/** Page links that keep every other filter in the URL. */
function PagerLinks({
  page,
  pages,
  per,
  hrefFor,
  onPer,
}: {
  page: number;
  pages: number;
  per: number;
  hrefFor: (p: number) => string;
  onPer: (per: number) => void;
}) {
  const nums = new Set<number>([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages));
  const list = [...nums].sort((a, b) => a - b);
  const cell = "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 transition-colors";
  return (
    <div className="ml-auto flex items-center gap-3">
      <label className="relative inline-flex h-7 items-center rounded-md border border-line text-[12px] font-medium text-ink hover:bg-canvas">
        <span className="sr-only">Companies per page</span>
        <select
          value={per}
          onChange={(e) => onPer(Number(e.target.value))}
          className="h-full cursor-pointer appearance-none bg-transparent pl-2.5 pr-7 outline-none"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 text-muted">
          <Icon icon={faChevronDown} size={8} />
        </span>
      </label>
      <nav aria-label="Pagination" className="flex items-center gap-0.5 text-[12px] font-medium text-ink">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} scroll={false} aria-label="Previous page" className={cn(cell, "hover:bg-canvas")}>
            <Icon icon={faChevronLeft} size={9} />
          </Link>
        ) : (
          <span className={cn(cell, "opacity-40")}>
            <Icon icon={faChevronLeft} size={9} />
          </span>
        )}
        {list.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - list[i - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
            <Link
              href={hrefFor(p)}
              scroll={false}
              aria-current={p === page ? "page" : undefined}
              className={cn(cell, p === page ? "bg-mint font-bold" : "hover:bg-canvas")}
            >
              {p}
            </Link>
          </span>
        ))}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} scroll={false} aria-label="Next page" className={cn(cell, "hover:bg-canvas")}>
            <Icon icon={faChevronRight} size={9} />
          </Link>
        ) : (
          <span className={cn(cell, "opacity-40")}>
            <Icon icon={faChevronRight} size={9} />
          </span>
        )}
      </nav>
    </div>
  );
}
