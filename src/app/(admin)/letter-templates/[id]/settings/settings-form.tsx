"use client";

import { faBoxArchive, faCheck, faLock } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useMarkDirty } from "../template-workspace";

export function TemplateSettingsForm({ name, status }: { name: string; status: string }) {
  const toast = useToast();
  const markDirty = useMarkDirty();

  return (
    <form
      onChange={() => markDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        markDirty(false);
        toast({ message: "Template settings saved" });
      }}
      className="flex flex-col gap-[18px] rounded-[14px] border border-line p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Template name" htmlFor="ts-name">
          <Input id="ts-name" defaultValue={name} maxLength={120} required />
        </Field>
        <Field label="Status" htmlFor="ts-status">
          <Select id="ts-status" defaultValue={status.toLowerCase()}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium leading-[18px] text-ink">Default for print runs</span>
          <span className="text-[11px] leading-[15px] text-muted">New print runs use this template unless another is picked</span>
        </div>
        <Toggle label="Default for print runs" defaultChecked />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Greeting"
          htmlFor="ts-greeting"
          hint="If Companies House has no director name: “To whom it may concern,”"
        >
          <Input id="ts-greeting" defaultValue="Dear ##DIRECTOR_FIRSTNAME#," maxLength={200} />
        </Field>
        <Field label="Sign-off" htmlFor="ts-signoff">
          <Input id="ts-signoff" defaultValue="Kind regards," maxLength={200} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Default offer" htmlFor="ts-offer">
          <Input id="ts-offer" defaultValue="Business Starter from £65" maxLength={200} />
        </Field>
        <Field label="Call to action" htmlFor="ts-cta">
          <Input id="ts-cta" defaultValue="See Business Starter →" maxLength={200} />
        </Field>
      </div>

      <Field label="Exclude footer" htmlFor="ts-footer" hint="Set up for you by the developer. Always printed.">
        <div className="relative">
          <Input
            id="ts-footer"
            readOnly
            className="pr-10"
            defaultValue="Don’t want letters from us? Email ##BRAND_SUPPORT_EMAIL# or call ##BRAND_SUPPORT_TELEPHONE#, quote your reference and we’ll stop."
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted">
            <Icon icon={faLock} size={11} />
          </span>
        </div>
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button variant="secondary" icon={faBoxArchive} onClick={() => toast({ message: "Template archived", actionLabel: "Undo" })}>
          Archive template
        </Button>
        <Button type="submit" icon={faCheck}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
