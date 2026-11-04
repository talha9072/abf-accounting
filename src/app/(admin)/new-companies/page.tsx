import type { Metadata } from "next";
import { CompaniesFeed } from "./companies-feed";

export const metadata: Metadata = { title: "New Companies" };

const MODALS = ["export", "fix", "pull", "pull-failed"] as const;

export default async function NewCompaniesPage({ searchParams }: PageProps<"/new-companies">) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "all";
  const modal = MODALS.find((m) => m === sp.modal) ?? null;
  return <CompaniesFeed view={view} initialModal={modal} />;
}
