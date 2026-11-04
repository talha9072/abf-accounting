import type { Metadata } from "next";
import { HistoryView, type HistoryTab } from "./history-view";

export const metadata: Metadata = { title: "History" };

const TABS: HistoryTab[] = ["sent", "excluded", "not-sent", "print-runs"];

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "sent";
  return <HistoryView tab={tab} />;
}
