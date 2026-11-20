import type { Metadata } from "next";
import { parseHistoryFilter } from "@/lib/history/filter";
import { historyCounts, historyExcluded, historyNotSent, historyRuns, historySent, historyTowns } from "@/lib/print/queries";
import { HistoryView, type HistoryTab } from "./history-view";

export const metadata: Metadata = { title: "History" };

const TABS: HistoryTab[] = ["sent", "excluded", "not-sent", "print-runs"];
const PER = 50;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "sent";
  const filter = parseHistoryFilter(sp);
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const offset = (page - 1) * PER;

  const [counts, towns, sent, excluded, notSent, runs] = await Promise.all([
    historyCounts(filter),
    historyTowns(),
    tab === "sent" ? historySent(filter, PER, offset) : [],
    tab === "excluded" ? historyExcluded(filter, PER, offset) : [],
    tab === "not-sent" ? historyNotSent(filter, PER, offset) : [],
    tab === "print-runs" ? historyRuns(filter, PER, offset) : [],
  ]);

  return <HistoryView tab={tab} filter={filter} towns={towns} page={page} per={PER} counts={counts} data={{ sent, excluded, notSent, runs }} />;
}
