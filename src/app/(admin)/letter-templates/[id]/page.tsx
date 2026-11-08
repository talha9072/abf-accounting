import type { Metadata } from "next";
import { getPreviewContext } from "@/lib/templates/preview";
import { loadTemplate } from "./data";
import { ContentEditor } from "./content-editor";

export async function generateMetadata({ params }: PageProps<"/letter-templates/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await loadTemplate(id))?.name ?? "Letter Templates" };
}

export default async function TemplateContentPage({ params }: PageProps<"/letter-templates/[id]">) {
  const { id } = await params;
  const t = (await loadTemplate(id))!;
  const preview = await getPreviewContext(t.offer);
  return (
    <ContentEditor
      key={`${t.id}-${t.version}`}
      template={{
        id: t.id,
        name: t.name,
        contentHtml: t.contentHtml,
        offer: t.offer,
        cta: t.cta,
        greeting: t.greeting,
        signOff: t.signOff,
        signatory: t.signatory,
        readOnly: t.status === "archived",
      }}
      preview={preview}
    />
  );
}
