import type { Metadata } from "next";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { buildLetterSnapshot, getBusiness, getPrintableTemplate, renderLetter } from "@/lib/letters/data";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";
import { PrintPreview } from "./print-preview";

export const metadata: Metadata = { title: "Preview letters" };

const PREVIEW_MAX = 100;

export default async function PrintPreviewPage({ searchParams }: PageProps<"/print/preview">) {
  const sp = await searchParams;
  const tpl = await getPrintableTemplate(typeof sp.template === "string" ? sp.template : null);
  const business = await getBusiness();
  const today = dateInTz(new Date(), UK_TZ);

  const rows = await db
    .select({
      name: companies.name,
      companyNumber: companies.companyNumber,
      directorFirstName: companies.directorFirstName,
      directorFullName: companies.directorFullName,
      incorporatedOn: companies.incorporatedOn,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
    })
    .from(companies)
    .where(eq(companies.letterState, "added"))
    .orderBy(asc(companies.incorporatedOn), asc(companies.companyNumber));

  const letters = await Promise.all(rows.slice(0, PREVIEW_MAX).map((c) => renderLetter(buildLetterSnapshot(c, tpl, business, today), business)));

  return <PrintPreview letters={letters} total={rows.length} template={{ id: tpl.id, name: tpl.name, version: tpl.version }} />;
}
