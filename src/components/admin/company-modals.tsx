"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  faBan,
  faCheck,
  faDownload,
  faFileArrowDown,
  faLocationDot,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Checkbox, Radio } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Modal, Note } from "@/components/ui/modal";
import { fixPostingAddressAction, skipCompanyAction, unskipCompanyAction } from "@/lib/companies/actions";

type ModalBase = { open: boolean; onClose: () => void };

/** What a modal hands back to its page to show as a toast (same shape as useToast). */
export type SavedToast = { message: string; actionLabel?: string; onAction?: () => void };

/* Export companies ---------------------------------------------------- */

/**
 * Posts to /api/companies/export, which streams a CSV of the current list
 * (same filters as the page) or of the selected rows.
 */
export function ExportModal({
  open,
  onClose,
  filtered,
  selected = [],
  query = "",
}: ModalBase & { filtered?: number; selected?: string[]; query?: string }) {
  const [scope, setScope] = useState<"filtered" | "selected">("filtered");
  const [withStatus, setWithStatus] = useState(true);
  const useSelected = scope === "selected" && selected.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      icon={faFileArrowDown}
      title="Export companies"
      subtitle="Download the current list as a spreadsheet"
    >
      <form method="post" action="/api/companies/export" onSubmit={() => setTimeout(onClose, 300)} className="flex flex-col gap-[18px]">
        <input type="hidden" name="query" value={query} />
        <input type="hidden" name="scope" value={useSelected ? "selected" : "filtered"} />
        <input type="hidden" name="numbers" value={useSelected ? selected.join(",") : ""} />
        <input type="hidden" name="status" value={withStatus ? "1" : "0"} />
        <div className="flex flex-col gap-3">
          <Checkbox
            label={`Current filters (${(filtered ?? 0).toLocaleString("en-GB")} companies)`}
            checked={!useSelected}
            onChange={() => setScope("filtered")}
            labelClassName="font-medium"
          />
          <Checkbox
            label={`Selected rows only (${selected.length})`}
            checked={useSelected}
            disabled={selected.length === 0}
            onChange={() => setScope(useSelected ? "filtered" : "selected")}
            labelClassName="font-medium"
          />
        </div>
        <p className="text-[12px] leading-4 text-muted">
          Format: <span className="font-medium text-ink">CSV</span> (opens in Excel)
        </p>
        <Checkbox
          label="Include letter status and printed date"
          checked={withStatus}
          onChange={(e) => setWithStatus(e.target.checked)}
          labelClassName="font-medium"
        />
        <div className="flex flex-wrap gap-3 pt-1.5">
          <Button variant="secondary" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button type="submit" icon={faDownload}>
            Download CSV
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* Exclude (with a reason) --------------------------------------------- */

export const EXCLUDE_REASONS = ["Asked not to be contacted", "Already a client", "Not a fit", "Other"] as const;

/**
 * Asks why before excluding — the reason is saved on the do-not-contact list
 * (History → Excluded, company Overview). One click + Enter is enough.
 */
export function ExcludeModal({
  open,
  onClose,
  what,
  onConfirm,
}: ModalBase & { /** "Acme Ltd" or "12 companies" */ what: string; onConfirm: (reason: string) => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      icon={faBan}
      iconTone="danger"
      title={`Exclude ${what}?`}
      subtitle="They won’t get a letter, now or in future pulls"
    >
      <ExcludeForm
        onCancel={onClose}
        onConfirm={(reason) => {
          onClose();
          onConfirm(reason);
        }}
      />
    </Modal>
  );
}

/** Rendered only while the modal is open, so every open starts fresh. */
function ExcludeForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [choice, setChoice] = useState<(typeof EXCLUDE_REASONS)[number]>(EXCLUDE_REASONS[0]);
  const [details, setDetails] = useState("");
  const detailsRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const extra = details.trim();
    onConfirm(choice === "Other" ? extra || "Other" : extra ? `${choice} — ${extra}` : choice);
  };

  return (
    <form className="flex flex-col gap-[18px]" onSubmit={submit}>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2.5 text-[12px] font-medium leading-4 text-ink">Reason</legend>
        {EXCLUDE_REASONS.map((r, i) => (
          <Radio
            key={r}
            name="exclude-reason"
            value={r}
            label={r}
            checked={choice === r}
            onChange={() => {
              setChoice(r);
              if (r === "Other") detailsRef.current?.focus();
            }}
            autoFocus={i === 0}
          />
        ))}
      </fieldset>
      <Field label={choice === "Other" ? "What happened? (optional)" : "Details (optional)"} htmlFor="exclude-details">
        <Input
          ref={detailsRef}
          id="exclude-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={200}
          placeholder={choice === "Other" ? "e.g. Company is dissolving" : "e.g. Phoned on 12 Nov"}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-3 pt-1.5">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" icon={faBan}>
          Exclude
        </Button>
      </div>
    </form>
  );
}

/* Fix posting address ------------------------------------------------- */

export type FixAddressTarget = {
  number: string;
  name: string;
  /** What Companies House has, shown in the warning. */
  registeredText: string;
  /** Pre-filled values (registered office, or a previously fixed address). */
  line1: string;
  line2: string;
  town: string;
  postcode: string;
};

/**
 * The fixed address is stored on the company (`posting_address`) and used for its letter and
 * address label. Each company only ever gets one letter, so there's no "just this once" option.
 */
export function FixAddressModal({
  open,
  onClose,
  target,
  onSaved,
}: ModalBase & { target: FixAddressTarget | null; onSaved?: (toast: SavedToast) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);

  if (!target) return null;
  const t = target;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const r = await fixPostingAddressAction({
        number: t.number,
        line1: String(fd.get("line1") ?? ""),
        line2: String(fd.get("line2") ?? ""),
        town: String(fd.get("town") ?? ""),
        postcode: String(fd.get("postcode") ?? ""),
      });
      if (r.ok) {
        setErrors({});
        onSaved?.({ message: `Posting address saved for ${t.name}` });
        onClose();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message ?? null);
      }
    });
  };

  const skip = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await skipCompanyAction(t.number);
      if (!r.ok) return setMessage(r.message);
      if (!r.count) return setMessage("This company can’t be skipped — it’s already printed, excluded or skipped.");
      onSaved?.({
        message: `${t.name} skipped — it won’t get a letter`,
        actionLabel: "Undo",
        onAction: () => void unskipCompanyAction(t.number, r.wasInRun).then(() => router.refresh()),
      });
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} width={560} icon={faLocationDot} title="Fix posting address" subtitle={`${t.name} · ${t.number}`}>
      <Note tone="warning" icon={faTriangleExclamation}>
        Companies House shows: {t.registeredText}. Changing this only affects where ABF posts the letter; the registered office on
        Companies House is not changed.
      </Note>
      {message ? <Note tone="danger">{message}</Note> : null}
      <form key={t.number} className="flex flex-col gap-[18px]" onSubmit={submit} noValidate>
        <Field label="Address line 1" htmlFor="addr1" error={errors.line1}>
          <Input id="addr1" name="line1" defaultValue={t.line1} autoComplete="address-line1" maxLength={120} required />
        </Field>
        <Field label="Address line 2 (optional)" htmlFor="addr2" error={errors.line2}>
          <Input id="addr2" name="line2" defaultValue={t.line2} autoComplete="address-line2" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Town / city" htmlFor="town" error={errors.town}>
            <Input id="town" name="town" defaultValue={t.town} autoComplete="address-level2" maxLength={80} required />
          </Field>
          <Field label="Postcode" htmlFor="postcode" error={errors.postcode}>
            <Input id="postcode" name="postcode" defaultValue={t.postcode} autoComplete="postal-code" className="uppercase" maxLength={10} required />
          </Field>
        </div>
        <p className="text-[11px] leading-[15px] text-muted">Saved on this company and used for its letter and address label.</p>
        <div className="flex flex-wrap justify-end gap-3 pt-1.5">
          <Button variant="secondary" icon={faBan} onClick={skip} disabled={pending}>
            Skip this company
          </Button>
          <Button type="submit" icon={pending ? faSpinner : faCheck} disabled={pending}>
            {pending ? "Saving…" : "Save & mark ready"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
