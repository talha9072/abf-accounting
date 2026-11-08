import {
  faBan,
  faBuilding,
  faCheck,
  faLocationDot,
  faMinus,
  faPlus,
  faShieldHalved,
  faTriangleExclamation,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { ActivityItem } from "@/lib/companies/queries";
import { formatDate } from "@/lib/companies/format";
import { dateInTz, formatSaTime, SCHEDULE_TZ } from "@/lib/pull/dates";

const ICONS: Record<string, IconDefinition> = {
  imported: faBuilding,
  rules_passed: faCheck,
  rules_failed: faTriangleExclamation,
  excluded: faBan,
  exclude_undone: faShieldHalved,
  added_to_run: faPlus,
  removed_from_run: faMinus,
  address_fixed: faLocationDot,
  skipped: faBan,
};

function when(d: Date) {
  const today = dateInTz(new Date(), SCHEDULE_TZ);
  const day = dateInTz(d, SCHEDULE_TZ);
  return day === today ? formatSaTime(d) : `${formatDate(day)} ${formatSaTime(d)}`;
}

export function ActivityTimeline({ items, className, limit }: { items: ActivityItem[]; className?: string; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card className={className}>
      <CardHeader title="Activity timeline" aside={<span className="text-[11px] font-medium text-muted">{items.length} events</span>} />
      <ol className="mt-3.5 flex flex-col">
        {shown.map((e, i) => (
          <li key={i} className="flex min-h-[62px] items-center gap-3">
            <time className="w-[88px] shrink-0 text-[10px] font-medium leading-[14px] text-muted">{when(e.at)}</time>
            <span
              className={
                e.kind === "rules_failed" || e.kind === "excluded"
                  ? "flex size-[30px] shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger"
                  : "flex size-[30px] shrink-0 items-center justify-center rounded-full bg-mint text-ink"
              }
            >
              <Icon icon={ICONS[e.kind] ?? faCheck} size={10} />
            </span>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="text-[12px] font-medium leading-4 text-ink">{e.title}</span>
              {e.detail ? <span className="truncate text-[10px] leading-[14px] text-muted">{e.detail}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
