"use client";

import {
  faBan,
  faCheck,
  faCircle,
  faCircleCheck,
  faCircleInfo,
  faDownload,
  faFileArrowDown,
  faLocationDot,
  faRotate,
  faSpinner,
  faTriangleExclamation,
  faWindowRestore,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal, Note } from "@/components/ui/modal";

type ModalBase = { open: boolean; onClose: () => void };

/* Export companies ---------------------------------------------------- */

export function ExportModal({ open, onClose, filtered = "1,248", selected = 0 }: ModalBase & { filtered?: string; selected?: number }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      icon={faFileArrowDown}
      title="Export companies"
      subtitle="Download the current list as a spreadsheet"
      footer={
        <div className="ml-auto flex gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={faDownload} onClick={onClose}>
            Download CSV
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Checkbox label={`Current filters (${filtered} companies)`} defaultChecked labelClassName="font-medium" />
        <Checkbox label={`Selected rows only (${selected})`} disabled={selected === 0} labelClassName="font-medium" />
      </div>
      <Field label="Format" htmlFor="export-format">
        <Select id="export-format" defaultValue="csv">
          <option value="csv">CSV (opens in Excel)</option>
          <option value="xlsx">Excel workbook (.xlsx)</option>
        </Select>
      </Field>
      <Checkbox label="Include letter status and printed date" defaultChecked labelClassName="font-medium" />
    </Modal>
  );
}

/* Fix posting address ------------------------------------------------- */

export function FixAddressModal({
  open,
  onClose,
  company = "Cedar Lane Analytics Ltd",
  number = "17840516",
}: ModalBase & { company?: string; number?: string }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon={faLocationDot}
      title="Fix posting address"
      subtitle={`${company} · ${number}`}
      footer={
        <div className="ml-auto flex gap-3">
          <Button variant="secondary" icon={faBan} onClick={onClose}>
            Skip this company
          </Button>
          <Button icon={faCheck} onClick={onClose}>
            Save &amp; mark ready
          </Button>
        </div>
      }
    >
      <Note tone="warning" icon={faTriangleExclamation}>
        Companies House shows: 4 Rose St, Edinburgh — postcode missing. Changing this only affects where ABF posts the letter; the
        registered office on Companies House is not changed.
      </Note>
      <form className="flex flex-col gap-[18px]" onSubmit={(e) => e.preventDefault()}>
        <Field label="Address line 1" htmlFor="addr1">
          <Input id="addr1" defaultValue="4 Rose Street" autoComplete="address-line1" />
        </Field>
        <Field label="Address line 2 (optional)" htmlFor="addr2">
          <Input id="addr2" defaultValue="Flat 2/1" autoComplete="address-line2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Town / city" htmlFor="town">
            <Input id="town" defaultValue="Edinburgh" autoComplete="address-level2" />
          </Field>
          <Field label="Postcode" htmlFor="postcode">
            <Input id="postcode" defaultValue="EH2 2QA" autoComplete="postal-code" className="uppercase" />
          </Field>
        </div>
        <Checkbox label="Use this address for future letters to this company" defaultChecked labelClassName="font-medium" />
      </form>
    </Modal>
  );
}

/* Pulling new companies ------------------------------------------------ */

const PULL_STEPS = [
  { label: "Fetch incorporations from Companies House", state: "done" },
  { label: "Apply selection rules (company type, shared addresses)", state: "active" },
  { label: "Remove excluded companies and already-printed companies", state: "todo" },
  { label: "Ready to print", state: "todo" },
] as const;

export function PullModal({ open, onClose }: ModalBase) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      icon={faRotate}
      title="Pulling new companies"
      subtitle="Everything incorporated since the last successful pull (21 Sep 2026)"
      footer={
        <Button variant="secondary" icon={faWindowRestore} onClick={onClose} className="ml-auto">
          Keep working
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <div
          className="h-2 overflow-hidden rounded-full bg-mint"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={60}
          aria-label="Pull progress"
        >
          <div className="h-full w-[60%] rounded-full bg-brand" />
        </div>
        <p className="text-[12px] leading-4 text-muted">Page 3 of 5 · 1,412 of ~2,350 companies fetched</p>
      </div>
      <ol className="flex flex-col gap-4">
        {PULL_STEPS.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <span className={s.state === "todo" ? "text-muted/70" : "text-brand"}>
              <Icon
                icon={s.state === "done" ? faCircleCheck : s.state === "active" ? faSpinner : faCircle}
                size={13}
                spin={s.state === "active"}
              />
            </span>
            <span className={s.state === "todo" ? "text-[13px] text-muted" : "text-[13px] text-ink"}>{s.label}</span>
          </li>
        ))}
      </ol>
      <Note tone="mint" icon={faCircleInfo}>
        This also runs automatically every morning at 06:00. Companies House allows 600 requests per 5 minutes, so large days are
        fetched in pages.
      </Note>
    </Modal>
  );
}

/* Today's pull didn't finish ------------------------------------------ */

export function PullFailedModal({ open, onClose }: ModalBase) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faTriangleExclamation}
      iconTone="danger"
      title="Today’s pull didn’t finish"
      subtitle="Companies House didn’t respond at 06:00 · 3 retries failed"
      footer={
        <Button icon={faRotate} onClick={onClose} className="ml-auto">
          Retry now
        </Button>
      }
    >
      <Note tone="danger">
        No letters are affected. Missed days are caught up automatically on the next pull — try again now or it will retry every 30
        minutes.
      </Note>
    </Modal>
  );
}
