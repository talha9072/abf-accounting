import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requireUser } from "@/lib/auth/dal";
import { getBusinessForm } from "@/lib/business/settings";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "Business settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const business = await getBusinessForm();
  return (
    <>
      <PageHeader
        title="Business settings"
        description="Your details on every letter (letterhead, footer and the ##BRAND_…# replace codes) and the office the morning pull skips."
      />
      <BusinessForm {...business} canEdit={user.role === "admin"} />
    </>
  );
}
