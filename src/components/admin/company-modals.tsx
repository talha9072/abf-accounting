"use client";

import { faBan, faCheck, faDownload, faFileArrowDown, faLocationDot, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
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
