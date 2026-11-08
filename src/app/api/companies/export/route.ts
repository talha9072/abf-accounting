import { inArray } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { formatAddress, formatCompanyName, postingAddress, sicDescription } from "@/lib/companies/format";
import { matchingCompanyNumbers, parseFeedFilters } from "@/lib/companies/queries";

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
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return new Response("Forbidden", { status: 403 });

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
      ...(withStatus ? [STATE_LABEL[r.letterState] ?? r.letterState, r.skipReason ?? "", ""] : []),
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
