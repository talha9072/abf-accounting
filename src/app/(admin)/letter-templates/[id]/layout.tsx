import { notFound } from "next/navigation";
import { listTemplates } from "@/lib/templates/queries";
import { loadTemplate } from "./data";
import { TemplateWorkspace } from "./template-workspace";

export default async function TemplateLayout({ children, params }: LayoutProps<"/letter-templates/[id]">) {
  const { id } = await params;
  const [list, t] = await Promise.all([listTemplates(), loadTemplate(id)]);
  if (!t) notFound();
  return (
    <TemplateWorkspace
      list={list}
      template={{ id: t.id, name: t.name, status: t.status, isDefault: t.isDefault, version: t.version }}
    >
      {children}
    </TemplateWorkspace>
  );
}
