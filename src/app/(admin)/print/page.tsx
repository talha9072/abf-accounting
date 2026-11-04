import type { Metadata } from "next";
import { PrintLetters } from "./print-letters";

export const metadata: Metadata = { title: "Print Letters" };

export default async function PrintPage({ searchParams }: PageProps<"/print">) {
  const sp = await searchParams;
  return <PrintLetters initialModal={sp.labels === "1" ? "labels" : null} />;
}
