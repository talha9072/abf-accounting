"use client";

import Link from "next/link";
import { useState } from "react";
import {
  faBan,
  faCheck,
  faClock,
  faEye,
  faInbox,
  faPrint,
  faTag,
  faTriangleExclamation,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { FilterDropdown } from "@/components/admin/filter-dropdown";
import { DataRow, DataTable, Pager } from "@/components/admin/table";
import { FixAddressModal } from "@/components/admin/company-modals";
import {
  ConfirmPrintedModal,
  LabelsModal,
  PrintSetupBanner,
  PrintSteps,
  ReprintModal,
} from "@/components/admin/print-parts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { companies, recentRuns } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

const COLUMNS = "28px 32px minmax(220px,562fr) 190px minmax(240px,360fr) 100px 104px 84px";
const ISSUE_ROW = 8; // Kestrel Trading Ltd — missing postcode
const ROWS = companies.slice(0, 14);

type ModalKey = "confirm" | "labels" | "fix" | "reprint" | null;

export function PrintLetters({ initialModal }: { initialModal: ModalKey }) {
  const toast = useToast();
  const [modal, setModal] = useState<ModalKey>(initialModal);
  const [selected, setSelected] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4, 5, 6, 7, 9, 10]));
  const [reprintDate, setReprintDate] = useState(recentRuns[0].date);

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <PageHeader
        title="Print Letters"
        description="Select new companies, preview the personalised letters and print them on the office printer. Printed companies are marked so nobody gets a second letter."
        actions={
          <>
            <Button variant="secondary" icon={faTag} onClick={() => setModal("labels")}>
              Print labels (after letters)
            </Button>
            <ButtonLink href="/print/preview" icon={faPrint}>
              Print {selected.size} letters
            </ButtonLink>
          </>
        }
      />

      <PrintSetupBanner className="-mt-0.5" />

      <section aria-label="Print run summary" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi tone="brand" icon={faInbox} label="Selected for this print run" value={String(selected.size)} sub="incorporated 22 Sep 2026" />
        <Kpi icon={faClock} label="Template" value="Welcome v3" sub="Dear ##DIRECTOR_FIRSTNAME#" />
        <Kpi icon={faCheck} iconTone="mint" label="Letters" value={String(selected.size)} sub="one per company" />
        <Kpi icon={faBan} iconTone="coral" label="Need an address fix" value="1" sub="fix before printing" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PrintSteps current={1} />
        <FilterDropdown
          className="w-[150px]"
          variant="inline"
          icon={faInbox}
          label="Batch"
          options={["Since last pull (default)", "Last 7 days", "Last 30 days"]}
        />
      </div>

      {/* Toolbar (52px so the 36px buttons fit inside — Figma buttons overflowed the 48px bar) */}
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 rounded-[10px] border border-line bg-white py-2 pl-3 pr-2">
        <Checkbox
          aria-label="Select all"
          checked={selected.size === ROWS.length - 1}
          indeterminate={selected.size > 0 && selected.size < ROWS.length - 1}
          onChange={() =>
            setSelected((s) => (s.size ? new Set() : new Set(ROWS.map((_, i) => i).filter((i) => i !== ISSUE_ROW))))
          }
        />
        <span className="text-[12px] font-bold leading-4 text-ink">{selected.size} selected</span>
        <span className="inline-flex h-6 items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">In this run</span>
        <span className="inline-flex h-6 items-center rounded-full bg-mint px-2.5 text-[11px] font-medium text-ink">Address OK</span>
        <div className="ml-auto flex gap-2">
          <ButtonLink size="sm" variant="secondary" icon={faEye} href="/print/preview">
            Preview letters
          </ButtonLink>
          <Button size="sm" icon={faCheck} onClick={() => setModal("confirm")} disabled={selected.size === 0}>
            Print &amp; mark printed
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        bodyClassName="max-h-[448px]"
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
            <span className="sr-only">Action</span>
          </>
        }
        footer={
          <>
            <span className="text-[12px] text-muted">1–50 of 2,298 companies ready to print · {selected.size} selected</span>
            <Pager perPage={false} pages={46} />
          </>
        }
      >
        {ROWS.map((c, i) => {
          const issue = i === ISSUE_ROW;
          const isSel = selected.has(i);
          return (
            <DataRow key={c.number} index={i} highlight={issue ? "warning" : undefined}>
              <Checkbox aria-label={`Select ${c.name}`} checked={isSel} disabled={issue} onChange={() => toggle(i)} />
              <span className="text-muted tabular-nums">{i + 1}</span>
              <Link href={`/new-companies/${c.number}`} className="truncate font-medium text-ink hover:text-brand hover:underline">
                {c.name}
              </Link>
              <span className="truncate text-ink">{c.director}</span>
              {issue ? (
                <span className="flex items-center gap-1.5 truncate text-warning">
                  3 Clarendon Rd, Watford
                  <Icon icon={faTriangleExclamation} size={10} />
                  missing postcode
                </span>
              ) : (
                <span className="truncate text-muted">{c.address}</span>
              )}
              <span className="text-muted tabular-nums">{c.number}</span>
              <span className="text-muted">{c.incorporated}</span>
              {issue ? (
                <button type="button" onClick={() => setModal("fix")} className="text-left text-brand hover:underline">
                  Fix address
                </button>
              ) : (
                <button type="button" onClick={() => toggle(i)} className="text-left text-brand hover:underline">
                  {isSel ? "Remove" : "Add"}
                </button>
              )}
            </DataRow>
          );
        })}
      </DataTable>

      <section aria-label="Recent print runs" className="grid gap-4 md:grid-cols-3">
        {recentRuns.map((r) => (
          <button
            key={r.date}
            type="button"
            onClick={() => {
              setReprintDate(r.date);
              setModal("reprint");
            }}
            className="flex min-h-[104px] flex-col gap-1.5 rounded-[14px] border border-line bg-white p-4 text-left transition-colors hover:border-n400"
          >
            <span className="text-[13px] font-bold leading-[18px] text-ink">{r.date}</span>
            <span className="text-[12px] leading-4 text-ink">{r.letters}</span>
            <span className="text-[10px] leading-[14px] text-muted">{r.template}</span>
          </button>
        ))}
      </section>

      <ConfirmPrintedModal
        open={modal === "confirm"}
        onClose={() => setModal(null)}
        onConfirm={() => {
          setModal("labels");
          toast({ message: `${selected.size} letters marked as printed`, actionLabel: "Undo" });
        }}
      />
      <LabelsModal open={modal === "labels"} onClose={() => setModal(null)} />
      <FixAddressModal open={modal === "fix"} onClose={() => setModal(null)} />
      <ReprintModal open={modal === "reprint"} onClose={() => setModal(null)} date={reprintDate} />
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
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  sub: string;
  tone?: "brand";
  iconTone?: "canvas" | "mint" | "coral";
}) {
  const brand = tone === "brand";
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col gap-[7px] rounded-[14px] p-4",
        brand ? "bg-brand text-white" : "border border-line bg-white",
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
