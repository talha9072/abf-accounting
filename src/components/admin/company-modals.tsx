"use client";

import { useState, useTransition, type FormEvent } from "react";
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
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal, Note } from "@/components/ui/modal";
import { fixPostingAddressAction, skipCompanyAction } from "@/lib/companies/actions";

type ModalBase = { open: boolean; onClose: () => void };

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
        <Field label="Format" htmlFor="export-format">
          <Select id="export-format" name="format" defaultValue="csv">
            <option value="csv">CSV (opens in Excel)</option>
          </Select>
        </Field>
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

export function FixAddressModal({
  open,
  onClose,
  target,
  onSaved,
}: ModalBase & { target?: FixAddressTarget | null; onSaved?: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);

  // Design-only fallback (Print page still uses sample data).
  const t: FixAddressTarget = target ?? {
    number: "17840516",
    name: "Cedar Lane Analytics Ltd",
    registeredText: "4 Rose St, Edinburgh — postcode missing",
    line1: "4 Rose Street",
    line2: "Flat 2/1",
    town: "Edinburgh",
    postcode: "",
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!target) return onClose();
    const fd = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const r = await fixPostingAddressAction({
        number: target.number,
        line1: String(fd.get("line1") ?? ""),
        line2: String(fd.get("line2") ?? ""),
        town: String(fd.get("town") ?? ""),
        postcode: String(fd.get("postcode") ?? ""),
      });
      if (r.ok) {
        setErrors({});
        onSaved?.(`Posting address saved for ${target.name}`);
        onClose();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message ?? null);
      }
    });
  };

  const skip = () => {
    if (!target) return onClose();
    startTransition(async () => {
      const r = await skipCompanyAction(target.number);
      if (r.ok) {
        onSaved?.(`${target.name} skipped — it won’t get a letter`);
        onClose();
      } else setMessage(r.message);
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
        <Checkbox label="Use this address for future letters to this company" defaultChecked labelClassName="font-medium" />
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
