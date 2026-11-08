import type { Metadata } from "next";
import { getPreviewContext } from "@/lib/templates/preview";
import { loadTemplate } from "../data";
import { VersionList } from "./version-list";

export const metadata: Metadata = { title: "Version history" };

export default async function TemplateVersionsPage({ params }: PageProps<"/letter-templates/[id]/versions">) {
  const { id } = await params;
  const t = (await loadTemplate(id))!;
  const preview = await getPreviewContext(t.offer);
  return (
    <VersionList
      templateId={t.id}
      readOnly={t.status === "archived"}
      versions={t.versions}
      preview={preview}
      layout={{ greeting: t.greeting, signOff: t.signOff, signatory: t.signatory, offer: t.offer, cta: t.cta }}
    />
  );
}
