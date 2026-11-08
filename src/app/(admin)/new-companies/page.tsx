import type { Metadata } from "next";
import { listCompanies, parseFeedFilters } from "@/lib/companies/queries";
import { CompaniesFeed } from "./companies-feed";

export const metadata: Metadata = { title: "New Companies" };

export default async function NewCompaniesPage({ searchParams }: PageProps<"/new-companies">) {
  const sp = await searchParams;
  const filters = parseFeedFilters(sp);
  const data = await listCompanies(filters);
  // "pull" / "pull-failed" deep links are handled by <PullProvider> in the admin layout.
  return <CompaniesFeed data={data} filters={filters} initialModal={sp.modal === "export" ? "export" : null} />;
}
