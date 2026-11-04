import type { Metadata } from "next";
import { templates } from "@/lib/mock-data";
import { ContentEditor } from "./content-editor";

export const metadata: Metadata = { title: "Letter Templates" };

export default async function TemplateContentPage({ params }: PageProps<"/letter-templates/[id]">) {
  const { id } = await params;
  const t = templates.find((x) => x.id === id)!;
  return <ContentEditor name={t.name} />;
}
