import "server-only";
import QRCode from "qrcode";
import { addressLines, formatAddress, formatCompanyName, formatLongDate } from "@/lib/companies/format";
import { getBusiness, type BusinessInfo } from "@/lib/letters/data";
import type { MergeValues } from "@/lib/letters/merge";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";
import { getPreviewCompany } from "./queries";

/** Everything the live preview needs to merge a template on the client. */
export type PreviewContext = {
  values: MergeValues;
  recipient: {
    companyName: string;
    companyNumber: string;
    directorFullName: string | null;
    directorFirstName: string | null;
    addressLines: string[];
    incorporatedOn: string;
    letterDate: string;
    reference: string;
  };
  business: BusinessInfo;
  qrSvg: string;
};

export async function getPreviewContext(offer: string): Promise<PreviewContext> {
  const [c, business] = await Promise.all([getPreviewCompany(), getBusiness()]);
  const reference = `${business.prefix}${c.companyNumber}`;
  const letterDate = dateInTz(new Date(), UK_TZ);
  const posting = c.postingAddress ?? c.registeredOffice;
  const qrSvg = await QRCode.toString(`${business.qrLink}?ref=${encodeURIComponent(reference)}`, {
    type: "svg",
    margin: 0,
    color: { dark: "#0d333f", light: "#ffffff" },
  });
  return {
    values: {
      COMPANY_NAME: formatCompanyName(c.name),
      DIRECTOR_FIRSTNAME: c.directorFirstName ?? "",
      DIRECTOR_FULLNAME: c.directorFullName ?? "",
      REGISTERED_ADDRESS: formatAddress(c.registeredOffice),
      COMPANY_NUMBER: c.companyNumber,
      INCORPORATION_DATE: formatLongDate(c.incorporatedOn),
      REFERENCE: reference,
      OFFER: offer,
      LETTER_DATE: formatLongDate(letterDate),
      BRAND_NAME: business.name,
      BRAND_SUPPORT_TELEPHONE: business.phone,
      BRAND_SUPPORT_EMAIL: business.email,
    },
    recipient: {
      companyName: formatCompanyName(c.name),
      companyNumber: c.companyNumber,
      directorFullName: c.directorFullName,
      directorFirstName: c.directorFirstName,
      addressLines: addressLines(posting),
      incorporatedOn: c.incorporatedOn,
      letterDate,
      reference,
    },
    business,
    qrSvg,
  };
}
