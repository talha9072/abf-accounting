import "server-only";
import { db } from "@/lib/db";
import { businessSettings } from "@/lib/db/schema";

/** Raw editable business details (one row, id = 1). */
export type BusinessForm = {
  brandName: string;
  addressLine: string;
  supportTelephone: string;
  supportEmail: string;
  website: string;
  registrationLine: string;
  referencePrefix: string;
  qrLink: string;
};

/** What letters use until someone saves Business settings. */
export const DEFAULT_BUSINESS: BusinessForm = {
  brandName: "ABF Accounting Services Ltd",
  addressLine: "18 Thricknells Close, Luton, LU3 3RP",
  supportTelephone: "+44 20 3968 9444",
  supportEmail: "support@abfaccounting.com",
  website: "abfaccounting.com",
  registrationLine: "Registered in England and Wales No. 15299101",
  referencePrefix: "ABF-",
  qrLink: "https://abfaccounting.com/business-starter",
};

export async function getBusinessForm(): Promise<{ values: BusinessForm; saved: boolean; updatedAt: string | null }> {
  const [b] = await db.select().from(businessSettings).limit(1);
  if (!b) return { values: DEFAULT_BUSINESS, saved: false, updatedAt: null };
  return {
    saved: true,
    updatedAt: b.updatedAt.toISOString(),
    values: {
      brandName: b.brandName,
      addressLine: b.addressLine,
      supportTelephone: b.supportTelephone ?? "",
      supportEmail: b.supportEmail ?? "",
      website: b.website ?? "",
      registrationLine: b.registrationLine ?? "",
      referencePrefix: b.referencePrefix,
      qrLink: b.qrLink ?? "",
    },
  };
}
