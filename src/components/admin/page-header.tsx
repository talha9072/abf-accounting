import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page title (Bold 30/38) + description (14/20) + right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[72px] flex-wrap items-center justify-between gap-x-5 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.01em] text-ink">{title}</h1>
          {badge}
        </div>
        {description ? <p className="text-[14px] leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
