import type { Metadata } from "next";
import { loadTemplate } from "../data";
import { TemplateSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Template settings" };

export default async function TemplateSettingsPage({ params }: PageProps<"/letter-templates/[id]/settings">) {
  const { id } = await params;
  const t = (await loadTemplate(id))!;
  return (
    <TemplateSettingsForm
      key={`${t.id}-${t.status}-${t.isDefault}`}
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
