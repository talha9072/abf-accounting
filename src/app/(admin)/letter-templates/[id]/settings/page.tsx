import type { Metadata } from "next";
import { getBusiness } from "@/lib/letters/data";
import { letterFooterLines } from "@/lib/letters/footer";
import { loadTemplate } from "../data";
import { TemplateSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Template settings" };

export default async function TemplateSettingsPage({ params }: PageProps<"/letter-templates/[id]/settings">) {
  const { id } = await params;
  const [tpl, business] = await Promise.all([loadTemplate(id), getBusiness()]);
  const t = tpl!;
  return (
    <TemplateSettingsForm
      key={`${t.id}-${t.status}-${t.isDefault}`}
      // Same text the printed letter uses; the reference differs per company.
      footer={letterFooterLines(business, "##REFERENCE#")}
      referenceExample={`${business.prefix}12345678`}
      template={{
        id: t.id,
        name: t.name,
        status: t.status,
        isDefault: t.isDefault,
        greeting: t.greeting,
        signOff: t.signOff,
        signatory: t.signatory,
        offer: t.offer,
        cta: t.cta,
      }}
    />
  );
}
