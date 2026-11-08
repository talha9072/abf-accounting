"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  faBan,
  faCheck,
  faClock,
  faEnvelopeOpenText,
  faEye,
  faInbox,
  faPrint,
  faRotateRight,
  faSpinner,
  faTag,
  faTriangleExclamation,
  faXmark,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { DataRow, DataTable } from "@/components/admin/table";
import { PrintSetupBanner, PrintSteps, ReprintModal, usePrintFlow, type FlowRun } from "@/components/admin/print-parts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { removeFromRunAction } from "@/lib/companies/actions";
import { cancelRunAction } from "@/lib/print/actions";
import type { QueueRow, RunSummary } from "@/lib/print/queries";
import { cn } from "@/lib/cn";

const COLUMNS = "28px 40px minmax(220px,520fr) 210px minmax(240px,380fr) 100px 110px 84px";

type Props = {
  queue: { rows: QueueRow[]; addressIssues: number; incorporatedLabel: string };
  openRuns: RunSummary[];
  recentRuns: RunSummary[];
  templates: Array<{ id: string; name: string; greeting: string }>;
  templateId: string | null;
};

const toFlow = (r: RunSummary): FlowRun & { printedDay: string } => ({
  id: r.id,
  reference: r.reference,
  letters: r.letters,
  template: r.template,
  printedDay: r.printedDay,
});

export function PrintLetters({ queue, openRuns, recentRuns, templates, templateId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const flow = usePrintFlow();
  const [busy, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reprintRun, setReprintRun] = useState<(FlowRun & { printedDay: string }) | null>(null);

  const rows = queue.rows;
  const n = rows.length;
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const allSel = n > 0 && rows.every((r) => selected.has(r.number));
  const someSel = !allSel && rows.some((r) => selected.has(r.number));
  const templateQs = template && template.id !== templates[0]?.id ? `?template=${template.id}` : "";

  const remove = (numbers: string[]) =>
    start(async () => {
      const r = await removeFromRunAction(numbers);
      if (!r.ok) return toast({ message: r.message });
      setSelected(new Set());
      router.refresh();
      toast({ message: `${r.count} removed from the print run` });
    });

  const cancelRun = (run: RunSummary) =>
    start(async () => {
      const r = await cancelRunAction(run.id);
      if (!r.ok) return toast({ message: r.message });
      router.refresh();
      toast({ message: `${run.reference} cancelled — ${r.count} companies are back in the print run` });
    });

  const setTemplate = (id: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (id === templates[0]?.id) sp.delete("template");
    else sp.set("template", id);
    router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false });
  };

  const lastRun = openRuns[0] ?? recentRuns[0];

  return (
    <>
      <PageHeader
        title="Print Letters"
        description="Preview the personalised letters for everyone in the print run and print them on the office printer. Printed companies are marked so nobody gets a second letter."
        actions={
          <>
            <Button variant="secondary" icon={faTag} disabled={!lastRun} onClick={() => lastRun && flow.openLabels(toFlow(lastRun))}>
              Print labels (after letters)
            </Button>
            <Button icon={flow.pending ? faSpinner : faPrint} disabled={n === 0 || flow.pending} onClick={() => flow.printQueue(template?.id ?? null, queue.incorporatedLabel)}>
              Print {n} {n === 1 ? "letter" : "letters"}
            </Button>
          </>
        }
      />

      <PrintSetupBanner className="-mt-0.5" />

      {/* Runs printed but not confirmed yet */}
      {openRuns.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-warning/30 bg-warning-subtle px-4 py-3 text-[#7c2d12]">
          <Icon icon={faTriangleExclamation} size={13} />
          <p className="flex-1 text-[12px] font-medium leading-4">
            {r.reference} · {r.letters} letters printed {r.printedAt} by {r.printedBy} — not confirmed yet. Confirm once they’re in the post, or
            cancel to put the companies back in the print run.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={faRotateRight} onClick={() => flow.reprint(toFlow(r))}>
              Print again
            </Button>
            <Button size="sm" variant="secondary" icon={faXmark} disabled={busy} onClick={() => cancelRun(r)}>
              Cancel run
            </Button>
            <Button size="sm" icon={faCheck} onClick={() => flow.openConfirm(toFlow(r))}>
              Confirm sent
            </Button>
          </div>
        </div>
      ))}

      <section aria-label="Print run summary" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi tone="brand" icon={faInbox} label="Selected for this print run" value={String(n)} sub={queue.incorporatedLabel} />
        <div className="flex min-h-[120px] flex-col gap-[7px] rounded-[14px] border border-line bg-white p-4">
          <div className="flex items-center gap-[9px]">
            <span className="flex size-[30px] items-center justify-center rounded-lg bg-canvas text-ink">
              <Icon icon={faClock} size={12} />
            </span>
            <span className="text-[11px] font-medium leading-[15px] text-muted">Template</span>
          </div>
          {templates.length > 1 ? (
            <FilterDropdown
              variant="inline"
              icon={faEnvelopeOpenText}
              label="Template"
              value={template?.id}
              onChange={setTemplate}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          ) : (
            <span className="mt-1 truncate text-[24px] font-bold leading-[30px] text-ink">{template?.name ?? "—"}</span>
          )}
          <span className="truncate text-[10px] leading-[13px] text-muted">{template?.greeting}</span>
        </div>
        <Kpi icon={faCheck} iconTone="mint" label="Letters" value={String(n)} sub="one per company" />
        <Link href="/new-companies?view=address-issue&inc=all" className="contents">
          <Kpi icon={faBan} iconTone="coral" label="Need an address fix" value={String(queue.addressIssues)} sub="fix before printing →" hover />
        </Link>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PrintSteps current={2} />
      </div>

      {/* Toolbar (52px so the 36px buttons fit inside — Figma buttons overflowed the 48px bar) */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 rounded-[10px] border border-line bg-white py-2 pl-3 pr-2">
        <Checkbox
          aria-label="Select all"
          checked={allSel}
          indeterminate={someSel}
          onChange={() => setSelected(allSel || someSel ? new Set() : new Set(rows.map((r) => r.number)))}
        />
        <span className="text-[12px] font-bold leading-4 text-ink">{selected.size ? `${selected.size} selected` : `${n} in this run`}</span>
        {selected.size ? (
          <Button size="sm" variant="secondary" icon={faXmark} disabled={busy} onClick={() => remove([...selected])}>
            Remove from run
          </Button>
        ) : (
          <>
            <span className="inline-flex h-6 items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">In this run</span>
            <span className="inline-flex h-6 items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">Address OK</span>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <ButtonLink size="sm" variant="secondary" icon={faEye} href={`/print/preview${templateQs}`} aria-disabled={n === 0} className={n === 0 ? "pointer-events-none opacity-55" : ""}>
            Preview letters
          </ButtonLink>
          <Button size="sm" icon={flow.pending ? faSpinner : faPrint} disabled={n === 0 || flow.pending} onClick={() => flow.printQueue(template?.id ?? null, queue.incorporatedLabel)}>
            Print &amp; mark printed
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        bodyClassName="max-h-[max(360px,calc(100vh-640px))]"
        className={busy ? "opacity-70" : undefined}
        header={
          <>
            <span>
              <span className="sr-only">Select</span>
            </span>
            <span>#</span>
            <span>Company</span>
            <span>Director (letter goes to)</span>
            <span>Address on the letter</span>
            <span>Company no.</span>
            <span>Incorporated</span>
            <span>
              <span className="sr-only">Action</span>
            </span>
          </>
        }
        footer={<span className="text-[12px] text-muted">{n ? `${n} ${n === 1 ? "company" : "companies"} ready to print` : "The print run is empty"}</span>}
      >
        {n === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            <p className="text-[14px] font-bold text-ink">Nothing in the print run yet</p>
            <p className="text-[12px] text-muted">
              Pick companies on{" "}
              <Link href="/new-companies?view=not-reviewed" className="font-medium text-brand underline">
                New Companies
              </Link>{" "}
              and choose “Add to print run”.
            </p>
          </div>
        ) : (
          rows.map((c, i) => (
            <DataRow key={c.number} index={i}>
              <Checkbox
                aria-label={`Select ${c.name}`}
                checked={selected.has(c.number)}
                onChange={() =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (next.has(c.number)) next.delete(c.number);
                    else next.add(c.number);
                    return next;
                  })
                }
              />
              <span className="text-muted tabular-nums">{i + 1}</span>
              <Link href={`/new-companies/${c.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                {c.name}
              </Link>
              <span className={cn("truncate", c.noDirector ? "text-warning" : "text-ink")} title={c.director}>
                {c.director}
              </span>
              <span className="truncate text-muted" title={c.address}>
                {c.address}
              </span>
              <span className="text-muted tabular-nums">{c.number}</span>
              <span className="text-muted">{c.incorporated}</span>
              <button type="button" disabled={busy} onClick={() => remove([c.number])} className="text-left text-brand hover:underline">
                Remove
              </button>
            </DataRow>
          ))
        )}
      </DataTable>

      {recentRuns.length ? (
        <section aria-label="Recent print runs" className="grid gap-4 md:grid-cols-3">
          {recentRuns.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReprintRun(toFlow(r))}
              className="flex min-h-[104px] flex-col gap-1.5 rounded-[14px] border border-line bg-white p-4 text-left transition-colors hover:border-n400"
            >
              <span className="text-[13px] font-bold leading-[18px] text-ink">{r.printedDay}</span>
              <span className="text-[12px] leading-4 text-ink">
                {r.letters} letters · {r.reference}
              </span>
              <span className="text-[10px] leading-[14px] text-muted">
                {r.template} · by {r.printedBy} · Reprint
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {flow.modals}
      <ReprintModal
        key={reprintRun?.id ?? "none"}
        open={reprintRun !== null}
        run={reprintRun}
        onClose={() => setReprintRun(null)}
        onOpen={(from, to) => reprintRun && flow.reprint(reprintRun, from, to)}
      />
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
  iconTone = "canvas",
  hover,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  sub: string;
  tone?: "brand";
  iconTone?: "canvas" | "mint" | "coral";
  hover?: boolean;
}) {
  const brand = tone === "brand";
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col gap-[7px] rounded-[14px] p-4",
        brand ? "bg-brand text-white" : "border border-line bg-white",
        hover && "transition-colors hover:border-n400",
      )}
    >
      <div className="flex items-center gap-[9px]">
        <span
          className={cn(
            "flex size-[30px] items-center justify-center rounded-lg",
            brand ? "bg-white/16" : iconTone === "mint" ? "bg-mint text-brand" : iconTone === "coral" ? "bg-coral/15 text-danger" : "bg-canvas text-ink",
          )}
        >
          <Icon icon={icon} size={12} />
        </span>
        <span className={cn("text-[11px] font-medium leading-[15px]", brand ? "text-white" : "text-muted")}>{label}</span>
      </div>
      <span className={cn("mt-1 text-[24px] font-bold leading-[30px]", brand ? "text-white" : "text-ink")}>{value}</span>
      <span className={cn("text-[10px] leading-[13px]", brand ? "text-white/90" : "text-muted")}>{sub}</span>
    </div>
  );
}
