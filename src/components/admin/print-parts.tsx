"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  faCheck,
  faCircleInfo,
  faEye,
  faPaperPlane,
  faPrint,
  faRotateLeft,
  faRotateRight,
  faSpinner,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Radio } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal, Note } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  confirmRunAction,
  createRunAction,
  getRunLabelsAction,
  markLabelsPrintedAction,
  undoConfirmAction,
} from "@/lib/print/actions";
import { cn } from "@/lib/cn";

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
  { n: 1, label: "Select companies", href: "/new-companies?view=not-reviewed" },
  { n: 2, label: "Choose template", href: "/print" },
  { n: 3, label: "Preview", href: "/print/preview" },
  { n: 4, label: "Print letters & confirm", href: "/print" },
  { n: 5, label: "Print labels", href: "/print" },
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

/* ================================================================== */
/* Print flow: create run → print document → confirm → labels          */
/* ================================================================== */

export type FlowRun = { id: string; reference: string; letters: number; template: string; incorporatedLabel?: string };

/** Open a URL in a new tab without tripping popup blockers (tab is opened on the click itself). */
function openTab() {
  const w = window.open("about:blank", "_blank");
  return (url: string) => {
    if (w && !w.closed) w.location.href = url;
    else window.open(url, "_blank");
  };
}

export function usePrintFlow() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [run, setRun] = useState<FlowRun | null>(null);
  const [modal, setModal] = useState<"confirm" | "labels" | null>(null);

  /** "Print N letters" — creates the run and opens the printable letters. */
  const printQueue = (templateId: string | null, incorporatedLabel?: string) => {
    const go = openTab();
    start(async () => {
      const r = await createRunAction({ templateId });
      if (!r.ok) {
        go("about:blank");
        toast({ message: r.message });
        return;
      }
      go(`/print-doc/${r.runId}/letters?auto=1`);
      setRun({ id: r.runId, reference: r.reference, letters: r.letters, template: "", incorporatedLabel });
      setModal("confirm");
      router.refresh();
    });
  };

  const reprint = (r: FlowRun, from?: number, to?: number) => {
    const qs = new URLSearchParams({ auto: "1", ...(from ? { from: String(from) } : {}), ...(to ? { to: String(to) } : {}) });
    window.open(`/print-doc/${r.id}/letters?${qs}`, "_blank");
  };

  const confirm = () => {
    if (!run) return;
    const current = run;
    start(async () => {
      const r = await confirmRunAction(current.id);
      if (!r.ok) {
        toast({ message: r.message });
        return;
      }
      router.refresh();
      setModal("labels");
      toast({
        message: `${r.count} letters marked as sent`,
        actionLabel: "Undo",
        onAction: () => start(async () => (await undoConfirmAction(current.id), router.refresh(), setModal(null))),
      });
    });
  };

  const modals = (
    <>
      <ConfirmPrintedModal
        open={modal === "confirm" && run !== null}
        run={run}
        pending={pending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
        onReprint={() => run && reprint(run)}
      />
      <LabelsModal open={modal === "labels" && run !== null} run={run} onClose={() => setModal(null)} />
    </>
  );

  return {
    pending,
    printQueue,
    reprint,
    openConfirm: (r: FlowRun) => (setRun(r), setModal("confirm")),
    openLabels: (r: FlowRun) => (setRun(r), setModal("labels")),
    modals,
  };
}

/* Did all letters print? ------------------------------------------------ */

export function ConfirmPrintedModal({
  open,
  run,
  pending,
  onClose,
  onConfirm,
  onReprint,
}: {
  open: boolean;
  run: FlowRun | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReprint: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon={faPrint}
      title={`Did all ${run?.letters ?? ""} letters print correctly?`}
      footer={
        <div className="ml-auto flex flex-wrap gap-3">
          <Button variant="secondary" icon={faRotateRight} onClick={onReprint} disabled={pending}>
            Not yet — reprint
          </Button>
          <Button icon={pending ? faSpinner : faCheck} onClick={onConfirm} disabled={pending}>
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
        <li>
          {run?.letters} letters · {run?.reference}
          {run?.template ? ` · ${run.template}` : ""}
        </li>
        {run?.incorporatedLabel ? <li>Companies {run.incorporatedLabel}</li> : null}
        <li>The letters opened in a new tab — use your printer there, then come back here.</li>
      </ul>
    </Modal>
  );
}

/* Address labels -------------------------------------------------------- */

export function LabelsModal({ open, onClose, run }: { open: boolean; onClose: () => void; run: FlowRun | null }) {
  const [loaded, setLoaded] = useState<{ runId: string; labels: string[][] } | null>(null);
  const [startAt, setStartAt] = useState(1);
  const runId = run?.id;
  const labels = loaded && loaded.runId === runId ? loaded.labels : null;

  useEffect(() => {
    if (!open || !runId) return;
    let alive = true;
    getRunLabelsAction(runId).then((l) => alive && setLoaded({ runId, labels: l }));
    return () => {
      alive = false;
    };
  }, [open, runId]);

  const first = Math.min(Math.max(1, startAt), 12);
  const cells = Array.from({ length: 12 }, (_, i) => (i + 1 < first ? null : (labels?.[i - (first - 1)] ?? undefined)));
  const sheets = labels ? Math.ceil((labels.length + first - 1) / 12) : 0;

  const print = (test = false) => {
    if (!run) return;
    const qs = new URLSearchParams({ auto: "1", start: String(first), ...(test ? { test: "1" } : {}) });
    window.open(`/print-doc/${run.id}/labels?${qs}`, "_blank");
    if (!test) void markLabelsPrintedAction(run.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      icon={faTag}
      title="Print address labels"
      subtitle={
        labels
          ? `${run?.reference} · ${labels.length} labels on ${sheets} ${sheets === 1 ? "sheet" : "sheets"} · same order as the letters`
          : "Loading labels…"
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" icon={faTag} onClick={() => print(true)}>
            Print a test sheet
          </Button>
          <Button icon={faPrint} className="ml-auto" onClick={() => print(false)} disabled={!labels?.length}>
            Print labels
          </Button>
        </>
      }
    >
      {/* A4 sheet preview: 2 × 6 labels */}
      <div className="mx-auto w-[304px] rounded-sm border border-line bg-white p-2 shadow-[0_1px_2px_rgb(9_36_45/0.06)]">
        <div className="grid grid-cols-2 gap-1">
          {cells.map((lines, i) =>
            lines === null ? (
              <div key={i} className="flex h-[66px] items-center justify-center rounded-[3px] bg-n100 text-[7px] text-n500">
                Used
              </div>
            ) : !lines ? (
              <div key={i} className="flex h-[66px] items-center justify-center rounded-[3px] border border-dashed border-line text-[7px] text-n400">
                Empty
              </div>
            ) : (
              <div key={i} className="h-[66px] overflow-hidden rounded-[3px] border border-line px-2.5 py-2 text-[6.5px] leading-[1.45]">
                {lines.map((l, j) => (
                  <p key={j} className={j < 2 ? "truncate text-ink" : "truncate text-muted"}>
                    {l}
                  </p>
                ))}
              </div>
            ),
          )}
        </div>
      </div>
      <Note tone="neutral" icon={faTag}>
        A4 · 2 columns × 6 rows · 12 labels of 98 × 46 mm · margins 6 mm sides, 10.5 mm top
      </Note>
      <Field label="Start at label" htmlFor="start-label" hint="Using a part-used sheet? Start from the first empty label.">
        <Input
          id="start-label"
          type="number"
          min={1}
          max={12}
          value={startAt}
          onChange={(e) => setStartAt(Number(e.target.value) || 1)}
          inputMode="numeric"
        />
      </Field>
    </Modal>
  );
}

/* Reprint a run --------------------------------------------------------- */

export function ReprintModal({
  open,
  onClose,
  run,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  run: (FlowRun & { printedDay?: string }) | null;
  onOpen: (from?: number, to?: number) => void;
}) {
  const [mode, setMode] = useState<"all" | "range">("all");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(run?.letters ?? 1);
  const total = run?.letters ?? 0;
  const valid = mode === "all" || (from >= 1 && to >= from && to <= total);
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faRotateLeft}
      title={`Reprint ${run?.printedDay ?? ""} run`}
      subtitle={`${total} letters · ${run?.reference ?? ""}${run?.template ? ` · ${run.template}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={faEye}
            className="ml-auto"
            disabled={!valid}
            onClick={() => {
              onOpen(mode === "range" ? from : undefined, mode === "range" ? to : undefined);
              onClose();
            }}
          >
            Open print preview
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">What to reprint</legend>
        <Radio name="reprint" label={`Reprint all ${total} letters`} checked={mode === "all"} onChange={() => setMode("all")} />
        <Radio name="reprint" label="Reprint a range" description="Use this after a paper jam" checked={mode === "range"} onChange={() => setMode("range")} />
      </fieldset>
      {mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From letter" htmlFor="from-letter">
            <Input id="from-letter" type="number" min={1} max={total} value={from} onChange={(e) => setFrom(Number(e.target.value) || 1)} />
          </Field>
          <Field label="To letter" htmlFor="to-letter" error={valid ? null : `Between ${from} and ${total}.`}>
            <Input id="to-letter" type="number" min={1} max={total} value={to} onChange={(e) => setTo(Number(e.target.value) || 1)} />
          </Field>
        </div>
      ) : null}
      <Note tone="mint" icon={faCircleInfo}>
        Reprinting doesn’t change printed dates or send anyone a second letter — it’s for replacing pages that didn’t print properly.
      </Note>
    </Modal>
  );
}
