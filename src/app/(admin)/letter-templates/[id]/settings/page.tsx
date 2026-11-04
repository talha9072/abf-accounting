import type { Metadata } from "next";
import { templates } from "@/lib/mock-data";
import { TemplateSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Template settings" };

export default async function TemplateSettingsPage({ params }: PageProps<"/letter-templates/[id]/settings">) {
  const { id } = await params;
  const t = templates.find((x) => x.id === id)!;
  return <TemplateSettingsForm name={t.name} status={t.status} />;
}
