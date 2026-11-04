import type { Metadata } from "next";
import { PrintPreview } from "./print-preview";

export const metadata: Metadata = { title: "Preview letters" };

export default async function PrintPreviewPage({ searchParams }: PageProps<"/print/preview">) {
  const sp = await searchParams;
  return <PrintPreview initialConfirm={sp.confirm === "1"} />;
}
