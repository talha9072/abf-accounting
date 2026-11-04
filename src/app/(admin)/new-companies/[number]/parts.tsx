import { faBuilding, faCheck, faShieldHalved, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

const EVENTS: Array<{ time: string; icon: IconDefinition; title: string; detail: string }> = [
  { time: "06:00", icon: faBuilding, title: "Company imported", detail: "Found in the 06:00 pull" },
  { time: "06:00", icon: faShieldHalved, title: "Exclude check passed", detail: "No existing do-not-contact match" },
  { time: "06:00", icon: faCheck, title: "Letter eligibility set", detail: "Valid registered office address detected" },
];

export function ActivityTimeline({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader
        title="Activity timeline"
        aside={
          <button type="button" className="text-[11px] font-medium text-muted hover:text-ink">
            All activity
          </button>
        }
      />
      <ol className="mt-3.5 flex flex-col">
        {EVENTS.map((e) => (
          <li key={e.title} className="flex min-h-[62px] items-center gap-3">
            <time className="w-11 shrink-0 text-[10px] font-medium leading-[14px] text-muted">{e.time}</time>
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-mint text-ink">
              <Icon icon={e.icon} size={10} />
            </span>
            <div className="flex flex-col gap-px">
              <span className="text-[12px] font-medium leading-4 text-ink">{e.title}</span>
              <span className="text-[10px] leading-[14px] text-muted">{e.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
