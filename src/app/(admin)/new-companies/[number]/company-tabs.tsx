"use client";

import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/ui/tabs";

export function CompanyTabs({ number }: { number: string }) {
  const pathname = usePathname();
  const base = `/new-companies/${number}`;
  const tabs = [
    { label: "Overview", href: base },
    { label: "Activity", href: `${base}/activity` },
    { label: "Letters", href: `${base}/letters` },
    { label: "Notes", href: `${base}/notes` },
  ];
  return <SegmentedTabs items={tabs.map((t) => ({ ...t, active: pathname === t.href }))} />;
}
