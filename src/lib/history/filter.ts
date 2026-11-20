/**
 * History filters (Figma "History / Desktop / Working v2": search, "All towns", "Last 30 days").
 * Shared by the page, the CSV export and the client view. History is kept for 12 months
 * (see src/lib/history/retention.ts), so no range goes further back.
 */

export type HistoryRange = "7d" | "30d" | "90d" | "12m";

export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "12m", label: "Last 12 months" },
];

export const DEFAULT_HISTORY_RANGE: HistoryRange = "30d";

export type HistoryFilter = { q: string; town: string; range: HistoryRange };

export function parseHistoryFilter(sp: Record<string, string | string[] | undefined>): HistoryFilter {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = HISTORY_RANGES.find((r) => r.value === one("range"))?.value ?? DEFAULT_HISTORY_RANGE;
  return { q: one("q").trim().slice(0, 100), town: one("town").trim().slice(0, 80), range };
}

/** Start of the range. */
export function historySince(range: HistoryRange, now = new Date()): Date {
  const d = new Date(now);
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "90d") d.setMonth(d.getMonth() - 3);
  else d.setMonth(d.getMonth() - 12);
  return d;
}
