import type { Metadata } from "next";
import { getCompanyActivity } from "@/lib/companies/queries";
import { requireCompany } from "../data";
import { ActivityTimeline } from "../parts";

export const metadata: Metadata = { title: "Activity" };

export default async function CompanyActivityPage({ params }: PageProps<"/new-companies/[number]/activity">) {
  const { number } = await params;
  const c = await requireCompany(number);
  const items = await getCompanyActivity(c);
  return (
    <div className="grid xl:grid-cols-[1028fr_532fr]">
      <ActivityTimeline items={items} className="min-h-[304px]" />
    </div>
  );
}
