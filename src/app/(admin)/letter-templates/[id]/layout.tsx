import { notFound } from "next/navigation";
import { templates } from "@/lib/mock-data";
import { TemplateWorkspace } from "./template-workspace";

export default async function TemplateLayout({ children, params }: LayoutProps<"/letter-templates/[id]">) {
  const { id } = await params;
  const template = templates.find((t) => t.id === id);
  if (!template) notFound();
  return <TemplateWorkspace template={template}>{children}</TemplateWorkspace>;
}
