"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { faCheck, faCircleInfo, faLock, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { saveBusinessSettingsAction } from "@/lib/business/actions";
import type { BusinessForm as Values } from "@/lib/business/settings";

type FieldDef = { name: keyof Values; label: string; hint: string; type?: string; placeholder?: string; maxLength: number; wide?: boolean };

const SECTIONS: { title: string; sub: string; fields: FieldDef[] }[] = [
  {
    title: "Business",
    sub: "Shown in the letterhead and footer.",
    fields: [
      { name: "brandName", label: "Business name", hint: "##BRAND_NAME#", maxLength: 200 },
      { name: "registrationLine", label: "Registration line", hint: "Footer, e.g. Registered in England and Wales No. 15299101", maxLength: 400 },
      {
        name: "addressLine",
        label: "Office address",
        hint: "Letterhead · end with the postcode. New companies registered at this address are skipped by the pull (“Not your own office”).",
        placeholder: "18 Thricknells Close, Luton, LU3 3RP",
        maxLength: 300,
        wide: true,
      },
    ],
  },
  {
    title: "Contact details",
    sub: "How people reach you from the letter.",
    fields: [
      { name: "supportTelephone", label: "Phone", hint: "##BRAND_SUPPORT_TELEPHONE#", type: "tel", maxLength: 40 },
      { name: "supportEmail", label: "Email", hint: "##BRAND_SUPPORT_EMAIL#", type: "email", maxLength: 254 },
      { name: "website", label: "Website", hint: "Letterhead", placeholder: "abfaccounting.com", maxLength: 200 },
      { name: "qrLink", label: "QR code link", hint: "Where the QR code on the letter goes. Must start with https://", type: "url", maxLength: 300 },
    ],
  },
  {
    title: "Letter reference",
    sub: "Printed on every letter so replies can be matched to a company.",
    fields: [{ name: "referencePrefix", label: "Reference prefix", hint: "##REFERENCE# = prefix + company number, e.g. ABF-16234871", maxLength: 16 }],
  },
];

export function BusinessForm({ values, saved, updatedAt, canEdit }: { values: Values; saved: boolean; updatedAt: string | null; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
        start(async () => {
          const r = await saveBusinessSettingsAction(data);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          toast({ message: r.message });
          if (r.ok) router.refresh();
        });
      }}
      className="flex max-w-[1032px] flex-col gap-6"
    >
      {!saved ? (
        <p className="flex items-start gap-2.5 rounded-[10px] bg-warning-subtle px-3.5 py-3 text-[13px] leading-[18px] text-ink">
          <Icon icon={faCircleInfo} size={13} className="mt-0.5 text-warning" />
          Not saved yet — letters use these default details. Check them and press Save.
        </p>
      ) : null}
      {!canEdit ? (
        <p className="flex items-start gap-2.5 rounded-[10px] bg-n100 px-3.5 py-3 text-[13px] leading-[18px] text-muted">
          <Icon icon={faLock} size={12} className="mt-0.5" />
          Only admins can change these details.
        </p>
      ) : null}

      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-bold leading-[25px] text-ink">{section.title}</h2>
            <p className="text-[13px] leading-[18px] text-muted">{section.sub}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={`biz-${f.name}`} hint={f.hint} error={errors[f.name]} className={f.wide ? "md:col-span-2" : undefined}>
                <Input
                  id={`biz-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={values[f.name]}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  readOnly={!canEdit}
                  aria-invalid={!!errors[f.name]}
                />
              </Field>
            ))}
          </div>
        </section>
      ))}

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-end gap-4">
          {updatedAt ? <span className="text-[12px] text-muted">Last saved {new Date(updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span> : null}
          <Button type="submit" icon={pending ? faSpinner : faCheck} disabled={pending}>
            {pending ? "Saving…" : "Save business settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
