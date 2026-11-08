import "server-only";
import { cache } from "react";
import type { Tone } from "@/components/ui/badge";
import { getCompany, type CompanyDetail } from "@/lib/companies/queries";

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
