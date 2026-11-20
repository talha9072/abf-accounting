import { getCurrentSession } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { parseHistoryFilter } from "@/lib/history/filter";
import { historyExcluded, historyNotSent, historyRuns, historySent } from "@/lib/print/queries";

/** Up to this many rows per export (a year of letters is ~10–20k). */
const MAX_ROWS = 50_000;

const STATE_LABEL: Record<string, string> = {
  not_reviewed: "Not reviewed",
  added: "In print run",
  address_issue: "Address issue",
  skipped: "Skipped",
};

/**
 * History → CSV (Figma "History" · Export CSV): the open tab with the same search, town and
 * date range as on screen. Read-only; signed-in staff only.
 */
export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return new Response("Unauthorised", { status: 401 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const filter = parseHistoryFilter(sp);
  const tab = ["sent", "excluded", "not-sent", "print-runs"].includes(sp.tab) ? sp.tab : "sent";

  let header: string[];
  let rows: unknown[][];
  if (tab === "excluded") {
    header = ["Company", "Company number", "Reason", "Excluded by", "Date"];
    rows = (await historyExcluded(filter, MAX_ROWS)).map((r) => [r.name, r.number, r.reason, r.by, r.date]);
  } else if (tab === "not-sent") {
    header = ["Company", "Company number", "Director", "Address", "Incorporated", "Status", "Reason skipped"];
    rows = (await historyNotSent(filter, MAX_ROWS)).map((r) => [r.name, r.number, r.director, r.address, r.incorporated, STATE_LABEL[r.state] ?? r.state, r.skipReason ?? ""]);
  } else if (tab === "print-runs") {
    header = ["Print run", "Printed", "Letters", "Template", "Printed by", "Status", "Labels"];
    rows = (await historyRuns(filter, MAX_ROWS)).map((r) => [
      r.reference,
      r.printedAt,
      r.letters,
      r.template,
      r.printedBy,
      r.status === "confirmed" ? "Sent" : "Not confirmed",
      r.labelsPrinted ? "Printed" : "Not printed",
    ]);
  } else {
    header = ["Company", "Company number", "Director", "Address", "Sent on", "Print run", "Printed by", "Confirmed sent"];
    rows = (await historySent(filter, MAX_ROWS)).map((r) => [r.name, r.number, r.director, r.address, r.sentOn, r.printRun, r.printedBy, r.confirmed ? "Yes" : "No"]);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abf-history-${tab}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
