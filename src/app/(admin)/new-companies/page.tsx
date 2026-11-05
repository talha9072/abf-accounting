import type { Metadata } from "next";
import { CompaniesFeed } from "./companies-feed";

export const metadata: Metadata = { title: "New Companies" };

// "pull" / "pull-failed" deep links are handled by <PullProvider> in the admin layout.
const MODALS = ["export", "fix"] as const;

export default async function NewCompaniesPage({ searchParams }: PageProps<"/new-companies">) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "all";
  const modal = MODALS.find((m) => m === sp.modal) ?? null;
  return <CompaniesFeed view={view} initialModal={modal} />;
}
