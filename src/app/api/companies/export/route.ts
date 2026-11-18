import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { companies, printRunItems, printRuns } from "@/lib/db/schema";
import { formatAddress, formatCompanyName, postingAddress, sicDescription } from "@/lib/companies/format";
import { matchingCompanyNumbers, parseFeedFilters } from "@/lib/companies/queries";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";

const STATE_LABEL: Record<string, string> = {
  not_reviewed: "Not reviewed",
  added: "In print run",
  printed: "Printed",
  posted: "Sent",
  excluded: "Excluded",
  address_issue: "Address issue",
  skipped: "Skipped",
};

/** CSV cell: quoted, and neutralised against spreadsheet formula injection. */
function cell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export the New Companies list (current filters or selected rows) as CSV. */
export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return new Response("Unauthorised", { status: 401 });

  // Same-origin form posts only.
  // Compare with the Host the browser used (req.url is the internal address behind a proxy / in dev).
  const origin = req.headers.get("origin");
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {}
    if (!host || originHost !== host) return new Response("Forbidden", { status: 403 });
  }

  const form = await req.formData();
  const scope = form.get("scope") === "selected" ? "selected" : "filtered";
  const withStatus = form.get("status") !== "0";

  let numbers: string[];
  if (scope === "selected") {
    numbers = String(form.get("numbers") ?? "")
      .split(",")
      .map((n) => n.trim().toUpperCase())
      .filter((n) => /^[A-Z0-9]{6,10}$/.test(n))
      .slice(0, 5000);
  } else {
    const sp = Object.fromEntries(new URLSearchParams(String(form.get("query") ?? "").slice(0, 2000)));
    numbers = await matchingCompanyNumbers({ ...parseFeedFilters(sp), page: 1 }, 20_000);
  }

  const rows = numbers.length
    ? await db.select().from(companies).where(inArray(companies.companyNumber, numbers)).orderBy(companies.incorporatedOn)
    : [];

  // Printed date = the company's latest print run that wasn't cancelled (UK calendar day).
  const printed = new Map<string, string>();
  if (withStatus && rows.length) {
    const at = sql`coalesce(${printRuns.printedAt}, ${printRuns.createdAt})`;
    const runs = await db
      .selectDistinctOn([printRunItems.companyId], { companyId: printRunItems.companyId, at: at.mapWith(printRuns.createdAt) })
      .from(printRunItems)
      .innerJoin(printRuns, eq(printRuns.id, printRunItems.printRunId))
      .where(and(inArray(printRunItems.companyId, rows.map((r) => r.id)), ne(printRuns.status, "cancelled")))
      .orderBy(printRunItems.companyId, desc(at));
    for (const r of runs) printed.set(r.companyId, dateInTz(new Date(r.at), UK_TZ));
  }

  const header = [
    "Company name",
    "Company number",
    "Company type",
    "Incorporated",
    "Director",
    "Posting address",
    "Postcode",
    "SIC code",
    "Industry",
    ...(withStatus ? ["Letter status", "Reason skipped", "Printed date"] : []),
  ];
  const lines = rows.map((r) => {
    const addr = postingAddress(r);
    return [
      formatCompanyName(r.name),
      r.companyNumber,
      r.companyType,
      r.incorporatedOn,
      r.directorFullName ?? "",
      formatAddress({ ...addr, postcode: null }),
      addr.postcode ?? "",
      r.sicCodes[0] ?? "",
      r.sicCodes[0] ? sicDescription(r.sicCodes[0]) : "",
      ...(withStatus ? [STATE_LABEL[r.letterState] ?? r.letterState, r.skipReason ?? "", printed.get(r.id) ?? ""] : []),
    ]
      .map(cell)
      .join(",");
  });

  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abf-new-companies-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
