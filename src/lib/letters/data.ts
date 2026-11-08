import "server-only";
import { and, asc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { businessSettings, letterTemplates, templateVersions, type Address, type LetterSnapshot } from "@/lib/db/schema";
import { addressLines, formatAddress, formatCompanyName, formatLongDate } from "@/lib/companies/format";
import { sanitizeTemplateHtml } from "./html";
import { mergeCodes, mergeGreeting, type MergeValues } from "./merge";

/* ------------------------------------------------------------------ */
/* Business details (letterhead, footer, ##BRAND_*# codes)              */
/* ------------------------------------------------------------------ */

export type BusinessInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
  web: string;
  registration: string;
  prefix: string;
  qrLink: string;
};

const FALLBACK_BUSINESS: BusinessInfo = {
  name: "ABF Accounting Services Ltd",
  address: "18 Thricknells Close, Luton, LU3 3RP",
  phone: "+44 7405 141694",
  email: "support@abfaccounting.com",
  web: "abfaccounting.com",
  registration: "Registered in England and Wales No. 15299101",
  prefix: "ABF-",
  qrLink: "https://abfaccounting.com/business-starter",
};

export async function getBusiness(): Promise<BusinessInfo> {
  const [b] = await db.select().from(businessSettings).limit(1);
  if (!b) return FALLBACK_BUSINESS;
  return {
    name: b.brandName,
    address: b.addressLine,
    phone: b.supportTelephone ?? "",
    email: b.supportEmail ?? "",
    web: b.website ?? "",
    registration: `${b.brandName} · ${b.registrationLine ?? ""} · Registered office: ${b.addressLine}`.replace(" ·  ·", " ·"),
    prefix: b.referencePrefix,
    qrLink: b.qrLink || FALLBACK_BUSINESS.qrLink,
  };
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_BODY = `<p>Congratulations on incorporating ##COMPANY_NAME# on ##INCORPORATION_DATE#.</p>
<p>ABF Accounting helps new UK companies get their bookkeeping, accounts and filings right from day one, with a dedicated accountant and clear fixed prices.</p>
<p>Our Business Starter services start from £65, and our Full Compliance Pack covers your Confirmation Statement, annual accounts and Corporation Tax return for a fixed £300.</p>`;

export type TemplateForPrint = {
  id: string;
  name: string;
  versionId: string;
  version: string;
  greeting: string;
  signOff: string;
  signatory: string | null;
  offer: string | null;
  cta: string | null;
  bodyHtml: string;
};

/** Creates "Welcome Letter v3" the first time, so printing works on a fresh database. */
async function ensureDefaultTemplate() {
  const [any] = await db.select({ id: letterTemplates.id }).from(letterTemplates).limit(1);
  if (any) return;
  await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(letterTemplates)
      .values({
        name: "Welcome Letter v3",
        status: "active",
        isDefault: true,
        greeting: "Dear ##DIRECTOR_FIRSTNAME#,",
        signOff: "Kind regards,",
        defaultOffer: "Business Starter from £65",
        callToAction: "Scan the code or visit abfaccounting.com/business-starter",
        signatoryName: "Lekan",
      })
      .returning({ id: letterTemplates.id });
    const [v] = await tx
      .insert(templateVersions)
      .values({ templateId: t.id, version: "v3.4", summary: "Added exclude footer line", contentHtml: DEFAULT_BODY })
      .returning({ id: templateVersions.id });
    await tx.update(letterTemplates).set({ currentVersionId: v.id }).where(eq(letterTemplates.id, t.id));
  });
}

/** Active templates with their current version, default first. */
export async function listPrintableTemplates(): Promise<TemplateForPrint[]> {
  await ensureDefaultTemplate();
  const rows = await db
    .select({ t: letterTemplates, v: templateVersions })
    .from(letterTemplates)
    .innerJoin(templateVersions, eq(templateVersions.id, letterTemplates.currentVersionId))
    .where(eq(letterTemplates.status, "active"))
    .orderBy(asc(letterTemplates.isDefault), asc(letterTemplates.name));
  return rows
    .sort((a, b) => Number(b.t.isDefault) - Number(a.t.isDefault))
    .map(({ t, v }) => ({
      id: t.id,
      name: t.name,
      versionId: v.id,
      version: v.version,
      greeting: t.greeting,
      signOff: t.signOff,
      signatory: t.signatoryName,
      offer: t.defaultOffer,
      cta: t.callToAction,
      bodyHtml: sanitizeTemplateHtml(v.contentHtml),
    }));
}

export async function getPrintableTemplate(id?: string | null): Promise<TemplateForPrint> {
  const all = await listPrintableTemplates();
  return all.find((t) => t.id === id) ?? all[0];
}

export async function getTemplateById(id: string) {
  const [row] = await db
    .select({ t: letterTemplates })
    .from(letterTemplates)
    .where(and(eq(letterTemplates.id, id)))
    .limit(1);
  return row?.t ?? null;
}

/* ------------------------------------------------------------------ */
/* Letters                                                             */
/* ------------------------------------------------------------------ */

type CompanyForLetter = {
  name: string;
  companyNumber: string;
  directorFirstName: string | null;
  directorFullName: string | null;
  incorporatedOn: string;
  registeredOffice: Address;
  postingAddress: Address | null;
};

/** Merge one company into the template. The result is stored with the print run. */
export function buildLetterSnapshot(
  c: CompanyForLetter,
  tpl: TemplateForPrint,
  business: BusinessInfo,
  letterDate: string,
): LetterSnapshot {
  const posting = c.postingAddress ?? c.registeredOffice;
  const reference = `${business.prefix}${c.companyNumber}`;
  const companyName = formatCompanyName(c.name);
  const values: MergeValues = {
    COMPANY_NAME: companyName,
    DIRECTOR_FIRSTNAME: c.directorFirstName ?? "",
    DIRECTOR_FULLNAME: c.directorFullName ?? "",
    REGISTERED_ADDRESS: formatAddress(c.registeredOffice),
    COMPANY_NUMBER: c.companyNumber,
    INCORPORATION_DATE: formatLongDate(c.incorporatedOn),
    REFERENCE: reference,
    OFFER: tpl.offer ?? "",
    LETTER_DATE: formatLongDate(letterDate),
    BRAND_NAME: business.name,
    BRAND_SUPPORT_TELEPHONE: business.phone,
    BRAND_SUPPORT_EMAIL: business.email,
  };
  return {
    companyName,
    companyNumber: c.companyNumber,
    directorFullName: c.directorFullName,
    directorFirstName: c.directorFirstName,
    addressLines: addressLines(posting),
    incorporatedOn: c.incorporatedOn,
    letterDate,
    bodyHtml: mergeCodes(tpl.bodyHtml, values),
    greeting: mergeGreeting(tpl.greeting, values),
    signOff: tpl.signOff,
    signatory: tpl.signatory,
    offer: tpl.offer,
    cta: tpl.cta,
    qrUrl: `${business.qrLink}${business.qrLink.includes("?") ? "&" : "?"}ref=${encodeURIComponent(reference)}`,
  };
}

/** What the <PrintedLetter> component needs, including the QR code as SVG. */
export type RenderedLetter = LetterSnapshot & { reference: string; qrSvg: string | null; business: BusinessInfo };

export async function renderLetter(s: LetterSnapshot, business: BusinessInfo): Promise<RenderedLetter> {
  const qrSvg = s.qrUrl ? await QRCode.toString(s.qrUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0d333f", light: "#ffffff" } }) : null;
  return { ...s, reference: `${business.prefix}${s.companyNumber}`, qrSvg, business };
}
