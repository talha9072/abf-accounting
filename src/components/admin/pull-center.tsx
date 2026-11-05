"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  faCircle,
  faCircleCheck,
  faCircleInfo,
  faRotate,
  faSpinner,
  faTriangleExclamation,
  faWindowRestore,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal, Note } from "@/components/ui/modal";
import { startPullNowAction } from "@/lib/pull/actions";
import type { PullSummary } from "@/lib/pull/status";
import { cn } from "@/lib/cn";

export type PullOverview = { latest: PullSummary | null; lastSuccess: PullSummary | null };
type ModalKey = "pull" | "pull-failed" | null;

type Ctx = {
  overview: PullOverview;
  running: boolean;
  open: (m: Exclude<ModalKey, null>) => void;
  runNow: () => void;
  starting: boolean;
  startError: string | null;
};

const PullContext = createContext<Ctx | null>(null);

export function usePull() {
  const ctx = useContext(PullContext);
  if (!ctx) throw new Error("usePull must be used inside <PullProvider>");
  return ctx;
}

/**
 * Holds the live Companies House pull status for the whole admin area.
 * Polls /api/pulls/latest every 3s while a pull runs (every 60s otherwise)
 * and renders the "Pulling new companies" / "Today's pull didn't finish" modals.
 */
export function PullProvider({ initial, children }: { initial: PullOverview; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState(initial);
  const [modal, setModal] = useState<ModalKey>(null);
  const [starting, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const running = overview.latest?.status === "running";
  const wasRunning = useRef(running);

  // ?modal=pull / ?modal=pull-failed deep links (sidebar card, failure email).
  const param = searchParams.get("modal");
  useEffect(() => {
    if (param === "pull" || param === "pull-failed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- open the modal the link points at
      setModal(param);
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("modal");
      router.replace(sp.size ? `${pathname}?${sp}` : pathname, { scroll: false });
    }
  }, [param, pathname, router, searchParams]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pulls/latest", { cache: "no-store" });
      if (res.ok) setOverview(await res.json());
    } catch {
      /* offline — try again next tick */
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, running ? 3000 : 60_000);
    return () => clearInterval(timer);
  }, [running, refresh]);

  // Fresh numbers whenever a pull modal opens or the tab comes back into view.
  const open = useCallback(
    (m: Exclude<ModalKey, null>) => {
      setModal(m);
      void refresh();
    },
    [refresh],
  );
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // When a pull finishes, refresh server-rendered data (counts, lists).
  useEffect(() => {
    if (wasRunning.current && !running) router.refresh();
    wasRunning.current = running;
  }, [running, router]);

  const runNow = useCallback(() => {
    setStartError(null);
    startTransition(async () => {
      const r = await startPullNowAction();
      if (!r.ok) setStartError(r.message);
      await refresh();
      setModal("pull");
    });
  }, [refresh]);

  // A failure view is pointless once a new pull is running — show its progress instead.
  const shown: ModalKey = modal === "pull-failed" && running ? "pull" : modal;

  return (
    <PullContext value={{ overview, running, open, runNow, starting, startError }}>
      {children}
      <PullProgressModal open={shown === "pull"} onClose={() => setModal(null)} />
      <PullFailedModal open={shown === "pull-failed"} onClose={() => setModal(null)} />
    </PullContext>
  );
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
  { key: "fetch", label: "Fetch incorporations from Companies House" },
  { key: "rules", label: "Apply selection rules (company type, shared addresses)" },
  { key: "officers", label: "Find each director’s name for the letter" },
  { key: "done", label: "Ready to print" },
] as const;

function stepState(stepKey: string, p: PullSummary | null): "done" | "active" | "todo" | "failed" {
  if (!p) return "todo";
  const order = STEPS.map((s) => s.key) as string[];
  const cur = order.indexOf(p.status === "succeeded" ? "done" : p.stage);
  const idx = order.indexOf(stepKey);
  if (p.status === "succeeded") return "done";
  if (idx < cur) return "done";
  if (idx === cur) return p.status === "failed" ? "failed" : "active";
  return "todo";
}

function PullProgressModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { overview, running, runNow, starting, startError, open: openModal } = usePull();
  const p = overview.latest;
  const last = overview.lastSuccess;

  const subtitle = running
    ? `Everything incorporated since the last successful pull (${p?.fromLabel})`
    : last
      ? `Last successful pull at ${last.timeLabel} (South Africa time) · covered ${last.fromLabel} – ${last.toLabel}`
      : "No pull has run yet";

  let detail = "";
  if (p && running) {
    detail =
      p.stage === "fetch"
        ? `Page ${Math.min(p.pagesDone + 1, Math.max(p.pagesTotal, 1))} of ${Math.max(p.pagesTotal, 1)} · ${p.companiesFound.toLocaleString("en-GB")} companies fetched`
        : p.stage === "officers"
          ? `Director names · ${p.officersDone.toLocaleString("en-GB")} of ${p.officersTotal.toLocaleString("en-GB")} companies`
          : `Checking ${p.companiesNew.toLocaleString("en-GB")} new companies…`;
  } else if (p?.status === "succeeded") {
    detail = `${p.companiesFound.toLocaleString("en-GB")} found · ${p.companiesNew.toLocaleString("en-GB")} new · ${p.companiesEligible.toLocaleString("en-GB")} ready for a letter`;
  } else if (p?.status === "failed") {
    detail = `Last attempt failed at ${p.timeLabel}`;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon={faRotate}
      title={running ? "Pulling new companies" : "Companies House pull"}
      subtitle={subtitle}
      footer={
        <div className="ml-auto flex gap-3">
          {!running ? (
            <Button variant="secondary" icon={starting ? faSpinner : faRotate} onClick={runNow} disabled={starting}>
              {starting ? "Starting…" : "Run pull now"}
            </Button>
          ) : null}
          {p?.status === "failed" && !running ? (
            <Button variant="secondary" icon={faTriangleExclamation} onClick={() => openModal("pull-failed")}>
              Details
            </Button>
          ) : null}
          <Button variant={running ? "secondary" : "primary"} icon={faWindowRestore} onClick={onClose}>
            Keep working
          </Button>
        </div>
      }
    >
      {startError ? <Note tone="warning" icon={faTriangleExclamation}>{startError}</Note> : null}
      <div className="flex flex-col gap-2">
        <div
          className="h-2 overflow-hidden rounded-full bg-mint"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={p?.percent ?? 0}
          aria-label="Pull progress"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", p?.status === "failed" ? "bg-danger" : "bg-brand")}
            style={{ width: `${p ? Math.max(p.percent, running ? 3 : 0) : 0}%` }}
          />
        </div>
        {detail ? <p className="text-[12px] leading-4 text-muted">{detail}</p> : null}
      </div>
      <ol className="flex flex-col gap-4">
        {STEPS.map((s) => {
          const st = stepState(s.key, p);
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span className={st === "failed" ? "text-danger" : st === "todo" ? "text-muted/60" : "text-brand"}>
                <Icon
                  icon={st === "done" ? faCircleCheck : st === "active" ? faSpinner : st === "failed" ? faTriangleExclamation : faCircle}
                  size={13}
                  spin={st === "active"}
                />
              </span>
              <span className={st === "todo" ? "text-[13px] text-muted" : "text-[13px] text-ink"}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <Note tone="mint" icon={faCircleInfo}>
        This also runs automatically every morning at 06:00 (South Africa time). Companies House allows 600 requests per 5 minutes,
        so large days are fetched in pages.
      </Note>
    </Modal>
  );
}

function PullFailedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { overview, runNow, starting, startError } = usePull();
  const p = overview.latest;
  const failed = p?.status === "failed";
  const manual = p?.trigger === "manual";
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faTriangleExclamation}
      iconTone="danger"
      title={failed ? (manual ? "“Run pull now” didn’t finish" : "Today’s pull didn’t finish") : "No failed pull"}
      subtitle={
        failed
          ? `Stopped at ${p!.timeLabel} (South Africa time) · attempt ${p!.attempt}`
          : "The latest pull finished normally."
      }
      footer={
        <Button icon={starting ? faSpinner : faRotate} onClick={runNow} disabled={starting} className="ml-auto">
          {starting ? "Starting…" : "Retry now"}
        </Button>
      }
    >
      {startError ? <Note tone="warning" icon={faTriangleExclamation}>{startError}</Note> : null}
      {failed ? (
        <>
          <Note tone="danger">
            {manual
              ? "No letters are affected and nothing was changed. The daily 06:00 pull carries on as normal — try again now if you need the latest companies."
              : "No letters are affected. Missed days are caught up automatically on the next pull — try again now or it will retry every 30 minutes."}
          </Note>
          {p?.error ? <p className="rounded-[10px] bg-n100 px-3.5 py-3 font-mono text-[11px] leading-4 text-muted">{p.error}</p> : null}
        </>
      ) : null}
    </Modal>
  );
}

/** Small helper for components that only need to know the headline numbers. */
export function usePullHeadline() {
  const { overview, running } = usePull();
  const s = overview.lastSuccess;
  return {
    running,
    failed: overview.latest?.status === "failed",
    /** Manual pulls are not retried automatically; scheduled ones retry every 30 minutes. */
    failedManual: overview.latest?.status === "failed" && overview.latest.trigger === "manual",
    found: s?.companiesFound ?? 0,
    ready: s?.companiesEligible ?? 0,
    time: s?.timeLabel ?? null,
    lastCheck: overview.latest?.timeLabel ?? null,
  };
}
