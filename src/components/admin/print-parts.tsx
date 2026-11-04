"use client";

import Link from "next/link";
import {
  faCheck,
  faCircleInfo,
  faEye,
  faPaperPlane,
  faPrint,
  faRotateLeft,
  faRotateRight,
  faSliders,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal, Note } from "@/components/ui/modal";
import { companies } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { useState } from "react";

export function PrintSetupBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center gap-2.5 rounded-[10px] bg-mint px-3.5 py-2", className)}>
      <span className="text-ink">
        <Icon icon={faPaperPlane} size={12} />
      </span>
      <span className="text-[11px] font-bold leading-[15px] text-ink">Print setup</span>
      <span className="text-[11px] leading-[15px] text-muted">
        A4 · one letter per page · address positioned for DL window envelopes · printed on your own printer
      </span>
    </div>
  );
}

const STEPS = [
  { n: 1, label: "Select companies", href: "/print" },
  { n: 2, label: "Choose template", href: "/letter-templates" },
  { n: 3, label: "Preview", href: "/print/preview" },
  { n: 4, label: "Print letters & confirm", href: "/print/preview?confirm=1" },
  { n: 5, label: "Print labels", href: "/print?labels=1" },
];

export function PrintSteps({ current }: { current: number }) {
  return (
    <nav aria-label="Print steps" className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((s) => (
        <Link
          key={s.n}
          href={s.href}
          aria-current={s.n === current ? "step" : undefined}
          className={cn(
            "inline-flex h-7 items-center rounded-[9px] px-[11px] text-[11px] leading-[14px] transition-colors",
            s.n === current ? "bg-mint font-bold text-ink" : "font-medium text-muted hover:bg-white hover:text-ink",
          )}
        >
          {s.n} · {s.label}
        </Link>
      ))}
    </nav>
  );
}

/* Did all letters print? ------------------------------------------------ */

export function ConfirmPrintedModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      hideClose
      icon={faPrint}
      title="Did all 10 letters print correctly?"
      footer={
        <div className="ml-auto flex flex-wrap gap-3">
          <Button variant="secondary" icon={faRotateRight} onClick={onClose}>
            Not yet — reprint
          </Button>
          <Button icon={faCheck} onClick={onConfirm}>
            Yes — mark sent &amp; print labels
          </Button>
        </div>
      }
    >
      <p className="-mt-1 text-[13px] leading-[19px] text-muted">
        Marking them as sent stops these companies getting a second letter. Next, you can print the address labels — 12 per A4 sheet,
        in the same order.
      </p>
      <ul className="flex flex-col gap-2 rounded-[10px] bg-mint px-4 py-3.5 text-[12px] leading-4 text-ink">
        <li>10 letters · Welcome Letter v3</li>
        <li>Companies incorporated 22 Sep 2026</li>
        <li>2 excluded (excluded or address issue)</li>
      </ul>
    </Modal>
  );
}

/* Address labels -------------------------------------------------------- */

const LABELS = companies.slice(0, 10);

export function LabelsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      icon={faTag}
      title="Print address labels"
      subtitle="This print session · 10 labels on 1 sheet · same order as the letters"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" icon={faSliders}>
            Print a test sheet
          </Button>
          <Button icon={faPrint} className="ml-auto" onClick={onClose}>
            Print labels
          </Button>
        </>
      }
    >
      {/* A4 sheet: 2 × 6 labels */}
      <div className="mx-auto w-[304px] rounded-sm border border-line bg-white p-2 shadow-[0_1px_2px_rgb(9_36_45/0.06)]">
        <div className="grid grid-cols-2 gap-1">
          {Array.from({ length: 12 }, (_, i) => {
            const c = LABELS[i];
            if (!c)
              return (
                <div key={i} className="flex h-[66px] items-center justify-center rounded-[3px] border border-dashed border-line text-[7px] text-n400">
                  Empty
                </div>
              );
            return (
              <div key={i} className="h-[66px] rounded-[3px] border border-line px-2.5 py-2 text-[6.5px] leading-[1.45]">
                <p className="text-ink">{c.director}</p>
                <p className="text-ink">{c.name}</p>
                {c.addressLines.map((l) => (
                  <p key={l} className="text-muted">
                    {l}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <Note tone="neutral" icon={faTag}>
        A4 · 2 columns × 6 rows · 12 labels of 98 × 46 mm · margins 6 mm sides, 10.5 mm top ·{" "}
        <span className="font-medium text-ink">Change in Settings › Printing</span>
      </Note>
      <Field label="Start at label" htmlFor="start-label" hint="Using a part-used sheet? Start from the first empty label.">
        <Input id="start-label" type="number" min={1} max={12} defaultValue={1} inputMode="numeric" />
      </Field>
    </Modal>
  );
}

/* Reprint a run --------------------------------------------------------- */

export function ReprintModal({ open, onClose, date = "21 Sep 2026" }: { open: boolean; onClose: () => void; date?: string }) {
  const [mode, setMode] = useState<"all" | "range">("range");
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faRotateLeft}
      title={`Reprint ${date} run`}
      subtitle="10 letters · Welcome Letter v3"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={faEye} className="ml-auto" onClick={onClose}>
            Open print preview
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">What to reprint</legend>
        <Radio name="reprint" label="Reprint all 10 letters" checked={mode === "all"} onChange={() => setMode("all")} />
        <Radio
          name="reprint"
          label="Reprint a range"
          description="Use this after a paper jam"
          checked={mode === "range"}
          onChange={() => setMode("range")}
        />
      </fieldset>
      {mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From letter" htmlFor="from-letter">
            <Input id="from-letter" type="number" min={1} max={10} defaultValue={4} />
          </Field>
          <Field label="To letter" htmlFor="to-letter">
            <Input id="to-letter" type="number" min={1} max={10} defaultValue={6} />
          </Field>
        </div>
      ) : null}
      <Note tone="mint" icon={faCircleInfo}>
        Reprinting doesn’t change printed dates or send anyone a second letter — it’s for replacing pages that didn’t print properly.
      </Note>
    </Modal>
  );
}
