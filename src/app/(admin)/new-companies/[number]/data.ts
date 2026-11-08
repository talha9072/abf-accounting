import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Tone } from "@/components/ui/badge";
import { getCompany, type CompanyDetail } from "@/lib/companies/queries";
import type { CompanyLetter } from "@/lib/print/queries";

/** One DB read per request, shared by the layout and the tab pages. */
export const loadCompany = cache(getCompany);

export const STATE_BADGE: Record<CompanyDetail["state"], { tone: Tone; label: string }> = {
  not_reviewed: { tone: "neutral", label: "Not reviewed" },
  added: { tone: "info", label: "Added" },
  printed: { tone: "success", label: "Printed" },
  posted: { tone: "success", label: "Sent" },
  excluded: { tone: "danger", label: "Excluded" },
  address_issue: { tone: "warning", label: "Address issue" },
  skipped: { tone: "neutral", label: "Skipped" },
};

/** Badge for one print run this company was in. */
export function runBadge(l: Pick<CompanyLetter, "status" | "confirmedDay" | "cancelledDay">): { tone: Tone; label: string } {
  if (l.status === "confirmed") return { tone: "success", label: `Posted ${l.confirmedDay ?? ""}`.trim() };
  if (l.status === "cancelled") return { tone: "neutral", label: `Cancelled ${l.cancelledDay ?? ""}`.trim() };
  return { tone: "warning", label: "Printed · not confirmed" };
}

/** Tab pages render in parallel with the layout, so each one must 404 on its own for an unknown number. */
export async function requireCompany(number: string) {
  const c = await loadCompany(number);
  if (!c) notFound();
  return c;
}
