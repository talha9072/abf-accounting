"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faChevronLeft, faChevronRight, faMagnifyingGlass, faRotateRight, faSpinner, faTag } from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { DataRow, DataTable } from "@/components/admin/table";
import { LabelsModal, ReprintModal, usePrintFlow, type FlowRun } from "@/components/admin/print-parts";
import { StatusBadge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { BoxedTabs } from "@/components/ui/tabs";
import { getRunDetailAction } from "@/lib/print/actions";
import type { historyExcluded, historyNotSent, historySent, RunSummary } from "@/lib/print/queries";
import { cn } from "@/lib/cn";

export type HistoryTab = "sent" | "excluded" | "not-sent" | "print-runs";

type Data = {
  sent: Awaited<ReturnType<typeof historySent>>;
  excluded: Awaited<ReturnType<typeof historyExcluded>>;
  notSent: Awaited<ReturnType<typeof historyNotSent>>;
  runs: RunSummary[];
};
type Counts = { sent: number; excluded: number; notSent: number; printRuns: number };

const SENT_COLS = "minmax(220px,466fr) 100px 170px minmax(220px,320fr) 110px 110px 130px 92px";
const EXCLUDED_COLS = "minmax(220px,1fr) 110px minmax(200px,1fr) 140px 120px";
const NOT_SENT_COLS = "minmax(220px,1fr) 110px 170px minmax(220px,1fr) 120px 160px";
const RUN_COLS = "120px 190px 90px minmax(160px,1fr) 150px 120px 130px 100px";

const STATE: Record<string, { tone: Tone; label: string }> = {
  not_reviewed: { tone: "neutral", label: "Not reviewed" },
  added: { tone: "info", label: "In print run" },
  address_issue: { tone: "warning", label: "Address issue" },
  skipped: { tone: "neutral", label: "Skipped" },
};
const fmt = (n: number) => n.toLocaleString("en-GB");

export function HistoryView({ tab, q, page, per, counts, data }: { tab: HistoryTab; q: string; page: number; per: number; counts: Counts; data: Data }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const flow = usePrintFlow();
  const [query, setQuery] = useState(q);
  const [runId, setRunId] = useState<string | null>(null);
  const [reprintRun, setReprintRun] = useState<(FlowRun & { printedDay: string }) | null>(null);
  const [labelsRun, setLabelsRun] = useState<FlowRun | null>(null);

  const href = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || (k === "page" && v === 1) || (k === "tab" && v === "sent")) sp.delete(k);
      else sp.set(k, String(v));
    }
    return sp.size ? `${pathname}?${sp}` : pathname;
  };

  useEffect(() => {
    if (query.trim() === q) return;
    const t = setTimeout(() => router.replace(href({ q: query.trim() || null, page: null }), { scroll: false }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const rowsShown =
    tab === "sent" ? data.sent.length : tab === "excluded" ? data.excluded.length : tab === "not-sent" ? data.notSent.length : data.runs.length;
  const totalForTab = tab === "sent" ? counts.sent : tab === "excluded" ? counts.excluded : tab === "not-sent" ? counts.notSent : counts.printRuns;
  const footer = (label: string) => (
    <>
      <span className="text-[12px] text-muted">
        {rowsShown ? `${fmt((page - 1) * per + 1)}–${fmt((page - 1) * per + rowsShown)} ${q ? `matching “${q}”` : `of ${fmt(totalForTab)}`} ${label}` : `No ${label}`}
      </span>
      <nav aria-label="Pagination" className="ml-auto flex items-center gap-1 text-[12px] font-medium">
        <PageLink disabled={page <= 1} href={href({ page: page - 1 })} label="Previous page" icon={faChevronLeft} />
        <span className="px-2 text-ink">Page {page}</span>
        <PageLink disabled={rowsShown < per} href={href({ page: page + 1 })} label="Next page" icon={faChevronRight} />
      </nav>
    </>
  );

  return (
    <>
      <PageHeader title="History" description="Every company you’ve sent a letter to, excluded, or not sent to yet." />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          icon={faMagnifyingGlass}
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company name or number"
          aria-label="Search company name or number"
          className="h-10 w-full max-w-[360px]"
          inputClassName="text-[13px]"
        />
        <span className="ml-auto text-[12px] leading-4 text-muted">Kept for 12 months</span>
      </div>

      <BoxedTabs
        className="self-start"
        items={[
          { label: "Sent", count: fmt(counts.sent), href: href({ tab: "sent", page: null }), active: tab === "sent" },
          { label: "Excluded", count: fmt(counts.excluded), href: href({ tab: "excluded", page: null }), active: tab === "excluded" },
          { label: "Not sent", count: fmt(counts.notSent), href: href({ tab: "not-sent", page: null }), active: tab === "not-sent" },
          { label: "Print runs", count: fmt(counts.printRuns), href: href({ tab: "print-runs", page: null }), active: tab === "print-runs" },
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
              <span>
                <span className="sr-only">Action</span>
              </span>
            </>
          }
          footer={footer("letters sent")}
        >
          {data.sent.length === 0 ? (
            <Empty text={q ? "Nothing matches that search." : "No letters printed yet. They appear here after a print run."} />
          ) : (
            data.sent.map((r, i) => (
              <DataRow key={`${r.number}-${r.runId}`} index={i}>
                <Link href={`/new-companies/${r.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                  {r.name}
                </Link>
                <span className="text-muted tabular-nums">{r.number}</span>
                <span className="truncate text-ink">{r.director}</span>
                <span className="truncate text-muted" title={r.address}>
                  {r.address}
                </span>
                <span className="text-muted">
                  {r.sentOn}
                  {r.confirmed ? null : <span className="ml-1 text-[10px] text-warning">(unconfirmed)</span>}
                </span>
                <button type="button" onClick={() => setRunId(r.runId)} className="text-left text-muted hover:text-ink hover:underline">
                  {r.printRun}
                </button>
                <span className="truncate text-muted">{r.printedBy}</span>
                <a href={`/print-doc/${r.runId}/letters`} target="_blank" rel="noopener" className="text-brand hover:underline">
                  View letter
                </a>
              </DataRow>
            ))
          )}
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
            </>
          }
          footer={footer("excluded")}
        >
          {data.excluded.length === 0 ? (
            <Empty text="Nobody is on the do-not-contact list." />
          ) : (
            data.excluded.map((r, i) => (
              <DataRow key={`${r.number}-${i}`} index={i}>
                {r.number ? (
                  <Link href={`/new-companies/${r.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-ink">{r.name}</span>
                )}
                <span className="text-muted tabular-nums">{r.number || "—"}</span>
                <span className="truncate text-ink">{r.reason}</span>
                <span className="text-muted">{r.by}</span>
                <span className="text-muted">{r.date}</span>
              </DataRow>
            ))
          )}
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
              <span>Address</span>
              <span>Incorporated</span>
              <span>Status</span>
            </>
          }
          footer={footer("not sent")}
        >
          {data.notSent.length === 0 ? (
            <Empty text="Every company has had a letter or was excluded." />
          ) : (
            data.notSent.map((c, i) => (
              <DataRow key={c.number} index={i}>
                <Link href={`/new-companies/${c.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                  {c.name}
                </Link>
                <span className="text-muted tabular-nums">{c.number}</span>
                <span className="truncate text-ink">{c.director}</span>
                <span className="truncate text-muted">{c.address}</span>
                <span className="text-muted">{c.incorporated}</span>
                <span>
                  <StatusBadge tone={STATE[c.state]?.tone ?? "neutral"} size="sm">
                    {STATE[c.state]?.label ?? c.state}
                  </StatusBadge>
                </span>
              </DataRow>
            ))
          )}
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
              <span>Status</span>
              <span>Labels</span>
              <span>
                <span className="sr-only">Action</span>
              </span>
            </>
          }
          footer={footer("print runs")}
        >
          {data.runs.length === 0 ? (
            <Empty text="No print runs yet." />
          ) : (
            data.runs.map((r, i) => (
              <DataRow key={r.id} index={i}>
                <span className="font-medium text-ink">{r.reference}</span>
                <span className="text-muted">{r.printedAt}</span>
                <span className="text-ink tabular-nums">{r.letters}</span>
                <span className="truncate text-ink">{r.template}</span>
                <span className="truncate text-muted">{r.printedBy}</span>
                <span>
                  <StatusBadge tone={r.status === "confirmed" ? "success" : "warning"} size="sm">
                    {r.status === "confirmed" ? "Sent" : "Not confirmed"}
                  </StatusBadge>
                </span>
                <span>
                  <StatusBadge tone={r.labelsPrinted ? "success" : "neutral"} size="sm">
                    {r.labelsPrinted ? "Printed" : "Not printed"}
                  </StatusBadge>
                </span>
                <button type="button" onClick={() => setRunId(r.id)} className="text-left text-brand hover:underline">
                  View run
                </button>
              </DataRow>
            ))
          )}
        </DataTable>
      ) : null}

      <PrintRunModal
        runId={runId}
        onClose={() => setRunId(null)}
        onReprint={(r) => (setRunId(null), setReprintRun(r))}
        onLabels={(r) => (setRunId(null), setLabelsRun(r))}
      />
      <ReprintModal
        key={reprintRun?.id ?? "none"}
        open={reprintRun !== null}
        run={reprintRun}
        onClose={() => setReprintRun(null)}
        onOpen={(from, to) => reprintRun && flow.reprint(reprintRun, from, to)}
      />
      <LabelsModal open={labelsRun !== null} run={labelsRun} onClose={() => setLabelsRun(null)} />
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted">{text}</p>;
}

function PageLink({ disabled, href, label, icon }: { disabled: boolean; href: string; label: string; icon: typeof faChevronLeft }) {
  const cls = "inline-flex size-7 items-center justify-center rounded-md";
  return disabled ? (
    <span className={cn(cls, "opacity-40")}>
      <Icon icon={icon} size={9} />
    </span>
  ) : (
    <Link href={href} scroll={false} aria-label={label} className={cn(cls, "hover:bg-canvas")}>
      <Icon icon={icon} size={9} />
    </Link>
  );
}

type RunDetail = NonNullable<Awaited<ReturnType<typeof getRunDetailAction>>>;

function PrintRunModal({
  runId,
  onClose,
  onReprint,
  onLabels,
}: {
  runId: string | null;
  onClose: () => void;
  onReprint: (r: FlowRun & { printedDay: string }) => void;
  onLabels: (r: FlowRun) => void;
}) {
  const [loaded, setLoaded] = useState<RunDetail | null>(null);
  const [, start] = useTransition();
  const run = loaded && loaded.id === runId ? loaded : null;

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    start(async () => {
      const d = await getRunDetailAction(runId);
      if (alive && d) setLoaded(d);
    });
    return () => {
      alive = false;
    };
  }, [runId]);

  const flowRun = run ? { id: run.id, reference: run.reference, letters: run.letters, template: run.template, printedDay: run.printedDay } : null;

  return (
    <Modal
      open={runId !== null}
      onClose={onClose}
      width={620}
      title={run ? `Print run · ${run.reference}` : "Print run"}
      subtitle={run ? `${run.letters} letters · ${run.template} · printed ${run.printedAt} by ${run.printedBy}` : "Loading…"}
      footer={
        run && flowRun ? (
          <>
            <a href={`/print-doc/${run.id}/letters`} target="_blank" rel="noopener" className="text-[13px] font-medium text-brand hover:underline">
              Open letters (PDF via print)
            </a>
            <div className="ml-auto flex flex-wrap gap-3">
              <Button variant="secondary" icon={faTag} onClick={() => onLabels(flowRun)}>
                Reprint labels
              </Button>
              <Button variant="secondary" icon={faRotateRight} onClick={() => onReprint(flowRun)}>
                Reprint
              </Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        ) : null
      }
    >
      {!run ? (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Icon icon={faSpinner} size={12} spin /> Loading run…
        </p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto rounded-[10px] border border-line scroll-area">
          {run.items.map((it) => (
            <li key={it.number} className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium leading-[18px] text-ink">{it.name}</span>
                <span className="truncate text-[11px] leading-[15px] text-muted">
                  {it.director}
                  {it.town ? ` · ${it.town}` : ""}
                </span>
              </div>
              <StatusBadge tone={it.state === "posted" ? "success" : it.state === "printed" ? "warning" : "neutral"}>
                {it.state === "posted" ? "Posted" : it.state === "printed" ? "Printed" : "Changed"}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
