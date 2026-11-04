import type { Metadata } from "next";
import { ActivityTimeline } from "../parts";

export const metadata: Metadata = { title: "Activity" };

export default function CompanyActivityPage() {
  return (
    <div className="grid xl:grid-cols-[1028fr_532fr]">
      <ActivityTimeline className="min-h-[304px]" />
    </div>
  );
}
