"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  faCalendarDays,
  faDownload,
  faFileArrowDown,
  faFilter,
  faMagnifyingGlass,
  faRotateRight,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { DataRow, DataTable, Pager } from "@/components/admin/table";
import { ReprintModal } from "@/components/admin/print-parts";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { BoxedTabs } from "@/components/ui/tabs";
import { companies, excludedHistory, historyCounts, printRunsHistory, sentHistory } from "@/lib/mock-data";

export type HistoryTab = "sent" | "excluded" | "not-sent" | "print-runs";

const SENT_COLS = "minmax(220px,466fr) 100px 150px minmax(220px,320fr) 110px 110px 120px 92px";
const EXCLUDED_COLS = "minmax(220px,1fr) 110px minmax(200px,1fr) 140px 120px 92px";
const NOT_SENT_COLS = "minmax(220px,1fr) 110px 160px minmax(220px,1fr) 120px 140px";
const RUN_COLS = "110px 170px 90px minmax(160px,1fr) 140px 120px 100px";

export function HistoryView({ tab }: { tab: HistoryTab }) {
  const [q, setQ] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);

  const sent = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? sentHistory.filter((r) => r.name.toLowerCase().includes(t) || r.number.includes(t)) : sentHistory;
  }, [q]);

  return (
    <>
      <PageHeader
        title="History"
        description="Every company you’ve sent a letter to, excluded, or not sent to yet."
        actions={
          <Button variant="secondary" icon={faFileArrowDown}>
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          icon={faMagnifyingGlass}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company name or number"
          aria-label="Search company name or number"
          className="h-10 w-full max-w-[360px]"
          inputClassName="text-[13px]"
        />
        <FilterDropdown
          variant="inline"
          className="w-[118px]"
          icon={faFilter}
          label="Town"
          options={["All towns", "Manchester", "Birmingham", "Leeds", "Bristol", "Luton"]}
        />
        <FilterDropdown
          variant="inline"
          className="w-[138px]"
          icon={faCalendarDays}
          label="Date range"
          options={["Last 30 days", "Last 7 days", "Last 12 months", "Custom range…"]}
        />
        <span className="ml-auto text-[12px] leading-4 text-muted">Kept for 12 months</span>
      </div>

      <BoxedTabs
        className="self-start"
        items={[
          { label: "Sent", count: historyCounts.sent, href: "/history", active: tab === "sent" },
          { label: "Excluded", count: historyCounts.excluded, href: "/history?tab=excluded", active: tab === "excluded" },
          { label: "Not sent", count: historyCounts.notSent, href: "/history?tab=not-sent", active: tab === "not-sent" },
          { label: "Print runs", count: historyCounts.printRuns, href: "/history?tab=print-runs", active: tab === "print-runs" },
        ]}
      />

      {tab === "sent" ? (
        <DataTable
          columns={SENT_COLS}
          bodyClassName="max-h-[max(360px,calc(100vh-470px))]"
          header={
            <>
              <span>Company</span>
              <span>Company no.</span>
              <span>Director</span>
              <span>Address</span>
              <span>Sent on</span>
              <span>Print run</span>
              <span>Printed by</span>
              <span className="sr-only">Action</span>
            </>
          }
          footer={
            <>
              <span className="text-[12px] text-muted">1–{sent.length} of {q ? sent.length : historyCounts.sent} letters sent</span>
              <Pager perPage={false} pages={29} />
            </>
          }
        >
          {sent.map((r, i) => (
            <DataRow key={r.number} index={i}>
              <span className="truncate font-medium text-ink">{r.name}</span>
              <span className="text-muted tabular-nums">{r.number}</span>
              <span className="truncate text-ink">{r.director}</span>
              <span className="truncate text-muted">{r.address}</span>
              <span className="text-muted">{r.sentOn}</span>
              <button type="button" onClick={() => setRunOpen(true)} className="text-left text-muted hover:text-ink hover:underline">
                {r.printRun}
              </button>
              <span className="truncate text-muted">{r.printedBy}</span>
              <Link href="/print/preview" className="text-brand hover:underline">
                View letter
              </Link>
            </DataRow>
          ))}
        </DataTable>
      ) : null}

      {tab === "excluded" ? (
        <DataTable
          columns={EXCLUDED_COLS}
          header={
            <>
              <span>Company</span>
              <span>Company no.</span>
              <span>Reason</span>
              <span>Excluded by</span>
              <span>Date</span>
              <span className="sr-only">Action</span>
            </>
          }
          footer={<span className="text-[12px] text-muted">1–{excludedHistory.length} of {historyCounts.excluded} excluded</span>}
        >
          {excludedHistory.map((r, i) => (
            <DataRow key={r.number} index={i}>
              <span className="truncate font-medium text-ink">{r.name}</span>
              <span className="text-muted tabular-nums">{r.number}</span>
              <span className="truncate text-ink">{r.reason}</span>
              <span className="text-muted">{r.by}</span>
              <span className="text-muted">{r.date}</span>
              <button type="button" className="text-left text-brand hover:underline">
                Remove
              </button>
            </DataRow>
          ))}
        </DataTable>
      ) : null}

      {tab === "not-sent" ? (
        <DataTable
          columns={NOT_SENT_COLS}
          bodyClassName="max-h-[max(360px,calc(100vh-470px))]"
          header={
            <>
              <span>Company</span>
              <span>Company no.</span>
              <span>Director</span>
              <span>Registered address</span>
              <span>Incorporated</span>
              <span>Status</span>
            </>
          }
          footer={
            <>
              <span className="text-[12px] text-muted">1–50 of {historyCounts.notSent} not sent</span>
              <Pager perPage={false} pages={923} />
            </>
          }
        >
          {companies.slice(10).map((c, i) => (
            <DataRow key={c.number} index={i}>
              <Link href={`/new-companies/${c.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                {c.name}
              </Link>
              <span className="text-muted tabular-nums">{c.number}</span>
              <span className="truncate text-ink">{c.director}</span>
              <span className="truncate text-muted">{c.address}</span>
              <span className="text-muted">{c.incorporated}</span>
              <span>
                <StatusBadge tone="neutral" size="sm">
                  Not reviewed
                </StatusBadge>
              </span>
            </DataRow>
          ))}
        </DataTable>
      ) : null}

      {tab === "print-runs" ? (
        <DataTable
          columns={RUN_COLS}
          header={
            <>
              <span>Print run</span>
              <span>Printed</span>
              <span>Letters</span>
              <span>Template</span>
              <span>Printed by</span>
              <span>Labels</span>
              <span className="sr-only">Action</span>
            </>
          }
          footer={<span className="text-[12px] text-muted">1–{printRunsHistory.length} of {historyCounts.printRuns} print runs</span>}
        >
          {printRunsHistory.map((r, i) => (
            <DataRow key={r.ref} index={i}>
              <span className="font-medium text-ink">{r.ref}</span>
              <span className="text-muted">{r.date}</span>
              <span className="text-ink tabular-nums">{r.letters}</span>
              <span className="truncate text-ink">{r.template}</span>
              <span className="text-muted">{r.by}</span>
              <span>
                <StatusBadge tone={r.labels === "Printed" ? "success" : "warning"} size="sm">
                  {r.labels}
                </StatusBadge>
              </span>
              <button type="button" onClick={() => setRunOpen(true)} className="text-left text-brand hover:underline">
                View run
              </button>
            </DataRow>
          ))}
        </DataTable>
      ) : null}

      <PrintRunModal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onReprint={() => {
          setRunOpen(false);
          setReprintOpen(true);
        }}
      />
      <ReprintModal open={reprintOpen} onClose={() => setReprintOpen(false)} date="23 Oct 2026" />
    </>
  );
}

const RUN_ITEMS = [
  ["Northfield Studio Labs Ltd", "Sarah Ahmed · Manchester"],
  ["Brightwell Systems Ltd", "James Okafor · Leeds"],
  ["Harbour & Pine Retail Ltd", "Mei Chen · Bristol"],
  ["Vela Operations Ltd", "Tom Price · Cardiff"],
  ["Oakline Advisory Services Ltd", "Aisha Khan · Birmingham"],
];

function PrintRunModal({ open, onClose, onReprint }: { open: boolean; onClose: () => void; onReprint: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Print run · Today 09:12"
      subtitle="10 letters · Welcome Letter v3 · printed by Abi Brown"
      footer={
        <>
          <Button variant="secondary" icon={faDownload}>
            Download PDF
          </Button>
          <div className="ml-auto flex flex-wrap gap-3">
            <Button variant="secondary" icon={faTag}>
              Reprint labels
            </Button>
            <Button variant="secondary" icon={faRotateRight} onClick={onReprint}>
              Reprint
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </>
      }
    >
      <ul className="overflow-hidden rounded-[10px] border border-line">
        {RUN_ITEMS.map(([name, sub]) => (
          <li key={name} className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-[18px] text-ink">{name}</span>
              <span className="text-[11px] leading-[15px] text-muted">{sub}</span>
            </div>
            <StatusBadge tone="success">Posted</StatusBadge>
          </li>
        ))}
        <li className="px-3.5 py-3 text-[12px] text-muted">…and 5 more</li>
      </ul>
    </Modal>
  );
}
