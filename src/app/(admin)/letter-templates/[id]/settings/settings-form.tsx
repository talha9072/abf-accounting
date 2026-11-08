"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { faBoxArchive, faCheck, faLock, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { archiveTemplateAction, saveSettingsAction } from "@/lib/templates/actions";
import type { TemplateStatus } from "@/lib/templates/queries";
import { useTemplateEditor } from "../template-workspace";

type Values = {
  id: string;
  name: string;
  status: TemplateStatus;
  isDefault: boolean;
  greeting: string;
  signOff: string;
  signatory: string;
  offer: string;
  cta: string;
};

export function TemplateSettingsForm({ template }: { template: Values }) {
  const router = useRouter();
  const toast = useToast();
  const { markDirty, registerSave, saving } = useTemplateEditor();
  const [v, setV] = useState(template);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [archiving, start] = useTransition();

  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    markDirty(true);
  };

  const latest = useRef(v);
  useEffect(() => {
    latest.current = v;
  }, [v]);

  useEffect(() => {
    registerSave(async () => {
      const r = await saveSettingsAction(latest.current);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast({ message: r.message });
        return false;
      }
      setErrors({});
      toast({ message: r.message });
      router.refresh();
      return true;
    });
    return () => registerSave(null);
  }, [registerSave, router, toast]);

  const archive = () =>
    start(async () => {
      const r = await archiveTemplateAction(template.id);
      toast({ message: r.message });
      if (r.ok) {
        markDirty(false);
        router.refresh();
      }
    });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        // Re-use the same save the header button calls.
        const r = await saveSettingsAction(latest.current);
        toast({ message: r.message });
        if (r.ok) {
          setErrors({});
          markDirty(false);
          router.refresh();
        } else setErrors(r.fieldErrors ?? {});
      }}
      className="flex flex-col gap-[18px] rounded-[14px] border border-line p-6"
      noValidate
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Template name" htmlFor="ts-name" error={errors.name}>
          <Input id="ts-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
        </Field>
        <Field label="Status" htmlFor="ts-status" error={errors.status} hint="Only Active templates can be picked for a print run.">
          <Select id="ts-status" value={v.status} onChange={(e) => set("status", e.target.value as TemplateStatus)}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium leading-[18px] text-ink">Default for print runs</span>
          <span className="text-[11px] leading-[15px] text-muted">
            {template.isDefault
              ? "This is the default. To change it, open another template and make that one the default."
              : "New print runs use this template unless another is picked"}
          </span>
        </div>
        <Toggle
          label="Default for print runs"
          checked={v.isDefault}
          disabled={template.isDefault}
          onChange={(e) => {
            set("isDefault", e.target.checked);
            if (e.target.checked && v.status !== "active") set("status", "active");
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Greeting" htmlFor="ts-greeting" error={errors.greeting} hint="If Companies House has no director name: “To whom it may concern,”">
          <Input id="ts-greeting" value={v.greeting} onChange={(e) => set("greeting", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Sign-off" htmlFor="ts-signoff" error={errors.signOff}>
          <Input id="ts-signoff" value={v.signOff} onChange={(e) => set("signOff", e.target.value)} maxLength={200} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Signed by" htmlFor="ts-signatory" error={errors.signatory} hint="Printed under the sign-off, e.g. Lekan">
          <Input id="ts-signatory" value={v.signatory} onChange={(e) => set("signatory", e.target.value)} maxLength={120} />
        </Field>
        <Field label="Default offer" htmlFor="ts-offer" error={errors.offer}>
          <Input id="ts-offer" value={v.offer} onChange={(e) => set("offer", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Call to action" htmlFor="ts-cta" error={errors.cta}>
          <Input id="ts-cta" value={v.cta} onChange={(e) => set("cta", e.target.value)} maxLength={200} />
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
        <Button
          variant="secondary"
          icon={archiving ? faSpinner : faBoxArchive}
          onClick={archive}
          disabled={archiving || template.status === "archived" || template.isDefault}
          title={template.isDefault ? "Make another template the default first" : undefined}
        >
          Archive template
        </Button>
        <Button type="submit" icon={saving ? faSpinner : faCheck} disabled={saving}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
