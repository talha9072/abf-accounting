import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requireUser } from "@/lib/auth/dal";
import { getBusinessForm } from "@/lib/business/settings";
import { getCompaniesHouseKeyStatus } from "@/lib/companies-house/key";
import { BusinessForm } from "./business-form";
import { CompaniesHouseKey } from "./companies-house-key";

export const metadata: Metadata = { title: "Business settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [business, chKey] = await Promise.all([getBusinessForm(), getCompaniesHouseKeyStatus()]);
  return (
    <>
      <PageHeader
        title="Business settings"
        description="Your details on every letter (letterhead, footer and the ##BRAND_…# replace codes), the office the morning pull skips, and the Companies House key it uses."
      />
      <div className="flex flex-col gap-6">
        <BusinessForm {...business} canEdit={user.role === "admin"} />
        <CompaniesHouseKey status={chKey} canEdit={user.role === "admin"} />
      </div>
    </>
  );
}
