"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { faBan, faLocationDot, faMinus, faPlus, faRotateLeft, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { ExcludeModal, FixAddressModal, type FixAddressTarget } from "@/components/admin/company-modals";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  addToRunAction,
  excludeCompaniesAction,
  removeFromRunAction,
  undoExcludeAction,
  unskipCompanyAction,
  type ActionResult,
} from "@/lib/companies/actions";
import type { CompanyDetail } from "@/lib/companies/queries";

type Props = {
  number: string;
  name: string;
  state: CompanyDetail["state"];
  skipReason?: CompanyDetail["skipReason"];
  fix?: FixAddressTarget;
};

function useCompanyAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok: string, undo?: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast({ message: r.message });
      router.refresh();
      toast({
        message: r.count ? ok : "Nothing changed",
        ...(undo && r.count
          ? { actionLabel: "Undo", onAction: () => start(async () => (await undo(), router.refresh())) }
          : {}),
      });
    });
  return { pending, run, router, toast };
}

/** Primary header action for a company, based on where its letter is. */
export function CompanyActions({ number, name, state, skipReason, fix }: Props) {
  const { pending, run, router, toast } = useCompanyAction();
  const [fixOpen, setFixOpen] = useState(false);
  const n = [number];

  if (state === "not_reviewed")
    return (
      <Button icon={pending ? faSpinner : faPlus} disabled={pending} onClick={() => run(() => addToRunAction({ numbers: n }), `${name} added to today’s print run`, () => removeFromRunAction(n))}>
        Add to print run
      </Button>
    );
  if (state === "added")
    return (
      <Button variant="secondary" icon={pending ? faSpinner : faMinus} disabled={pending} onClick={() => run(() => removeFromRunAction(n), `${name} removed from the print run`)}>
        Remove from print run
      </Button>
    );
  if (state === "excluded")
    return (
      <Button variant="secondary" icon={pending ? faSpinner : faBan} disabled={pending} onClick={() => run(() => undoExcludeAction(n), `${name} is no longer excluded`)}>
        Remove exclusion
      </Button>
    );
  // Only skips made by your team can be undone; rule-skipped companies stay skipped.
  if (state === "skipped" && skipReason === "manual")
    return (
      <Button variant="secondary" icon={pending ? faSpinner : faRotateLeft} disabled={pending} onClick={() => run(() => unskipCompanyAction(number), `${name} is no longer skipped`)}>
        Move back to Not reviewed
      </Button>
    );
  if (state === "address_issue" && fix)
    return (
      <>
        <Button icon={faLocationDot} onClick={() => setFixOpen(true)}>
          Fix posting address
        </Button>
        <FixAddressModal
          open={fixOpen}
          onClose={() => setFixOpen(false)}
          target={fix}
          onSaved={(t) => (router.refresh(), toast(t))}
        />
      </>
    );
  return null;
}

/** "Exclude" card on the Overview tab. */
export function ExcludeCard({ number, name, state }: Props) {
  const { pending, run } = useCompanyAction();
  const [asking, setAsking] = useState(false);
  const n = [number];
  if (state === "printed" || state === "posted") return null;
  return state === "excluded" ? (
    <Button variant="secondary" icon={pending ? faSpinner : faBan} className="mt-3" disabled={pending} onClick={() => run(() => undoExcludeAction(n), `${name} is no longer excluded`)}>
      Remove exclusion
    </Button>
  ) : (
    <>
      <Button variant="secondary" icon={pending ? faSpinner : faBan} className="mt-3" disabled={pending} onClick={() => setAsking(true)}>
        Exclude
      </Button>
      <ExcludeModal
        open={asking}
        onClose={() => setAsking(false)}
        what={name}
        onConfirm={(reason) => run(() => excludeCompaniesAction({ numbers: n }, reason), `${name} excluded — it won’t get a letter`, () => undoExcludeAction(n))}
      />
    </>
  );
}
