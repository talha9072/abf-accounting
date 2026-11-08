import type { Metadata } from "next";
import { historyCounts, historyExcluded, historyNotSent, historySent, listRuns } from "@/lib/print/queries";
import { HistoryView, type HistoryTab } from "./history-view";

export const metadata: Metadata = { title: "History" };

const TABS: HistoryTab[] = ["sent", "excluded", "not-sent", "print-runs"];
const PER = 50;

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "sent";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  const offset = (page - 1) * PER;

  const [counts, sent, excluded, notSent, runs] = await Promise.all([
    historyCounts(),
    tab === "sent" ? historySent(q, PER, offset) : [],
    tab === "excluded" ? historyExcluded(q, PER, offset) : [],
    tab === "not-sent" ? historyNotSent(q, PER, offset) : [],
    tab === "print-runs" ? listRuns(PER, offset) : [],
  ]);

  return <HistoryView tab={tab} q={q} page={page} per={PER} counts={counts} data={{ sent, excluded, notSent, runs }} />;
}
