import { desc, ilike, or } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { companies, exclusions } from "@/lib/db/schema";
import { formatCompanyName, formatDate } from "@/lib/companies/format";

const STATE_LABEL: Record<string, string> = {
  not_reviewed: "Ready",
  added: "In today’s run",
  printed: "Printed",
  posted: "Sent",
  excluded: "Excluded",
  address_issue: "Address issue",
  skipped: "Skipped",
};

/** Top-bar search (⌘K / Ctrl K): companies by name or number, plus opt-outs. */
export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const term = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const number = q.replace(/\s+/g, "").toUpperCase();

  const found = await db
    .select({ number: companies.companyNumber, name: companies.name, state: companies.letterState, inc: companies.incorporatedOn })
    .from(companies)
    .where(q ? or(ilike(companies.name, `%${term}%`), ilike(companies.companyNumber, `${number}%`)) : undefined)
    .orderBy(desc(companies.incorporatedOn), desc(companies.companyNumber))
    .limit(6);

  const optOuts = q
    ? await db
        .select({ number: exclusions.companyNumber, name: exclusions.companyName, at: exclusions.createdAt })
        .from(exclusions)
        .where(or(ilike(exclusions.companyName, `%${term}%`), ilike(exclusions.companyNumber, `${number}%`)))
        .orderBy(desc(exclusions.createdAt))
        .limit(3)
    : [];

  return Response.json(
    {
      companies: found.map((c) => ({
        number: c.number,
        name: formatCompanyName(c.name),
        meta: `${c.number} · ${STATE_LABEL[c.state] ?? c.state} · ${formatDate(c.inc)}`,
      })),
      optOuts: optOuts.map((o) => ({
        number: o.number ?? "",
        name: formatCompanyName(o.name ?? o.number ?? ""),
        meta: `Excluded ${formatDate(o.at.toISOString())}`,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
