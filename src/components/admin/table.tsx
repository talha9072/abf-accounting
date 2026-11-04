import type { ReactNode } from "react";
import { faChevronDown, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Compact data table shell (Figma "Companies Table (compact)"):
 * 34px grey header, 32px rows, zebra canvas rows, n200 separators,
 * body scrolls inside the card, 44px footer.
 */
export function DataTable({
  columns,
  header,
  children,
  footer,
  bodyClassName,
  className,
}: {
  /** CSS grid-template-columns shared by header and rows. */
  columns: string;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-line bg-white", className)} style={{ ["--cols" as string]: columns }}>
      <div className="overflow-x-auto scroll-area">
        <div className="min-w-[1100px]">
          <div role="row" className="grid h-[34px] items-center gap-3 border-b border-n200 bg-n100 px-3 text-[11px] font-medium leading-[15px] text-muted [grid-template-columns:var(--cols)]">
            {header}
          </div>
          <div className={cn("overflow-y-auto scroll-area", bodyClassName)}>{children}</div>
        </div>
      </div>
      {footer ? <div className="flex min-h-11 flex-wrap items-center gap-3 border-t border-n200 px-3 py-2">{footer}</div> : null}
    </div>
  );
}

export function DataRow({
  children,
  index,
  highlight,
  className,
}: {
  children: ReactNode;
  index: number;
  highlight?: "warning" | "selected";
  className?: string;
}) {
  return (
    <div
      role="row"
      className={cn(
        "grid min-h-8 items-center gap-3 border-b border-n200 px-3 text-[12px] leading-4 transition-colors last:border-b-0 [grid-template-columns:var(--cols)] hover:bg-mint/70",
        highlight === "warning" ? "bg-warning-subtle/70 hover:bg-warning-subtle" : index % 2 === 1 ? "bg-canvas" : "bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** "1 2 3 … 47" pager + "50 per page" chip. */
export function Pager({ pages = 47, current = 1, perPage = true }: { pages?: number; current?: number; perPage?: boolean }) {
  const shown = [1, 2, 3];
  return (
    <div className="ml-auto flex items-center gap-3">
      {perPage ? (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-canvas"
        >
          50 per page
          <span className="text-muted">
            <Icon icon={faChevronDown} size={8} />
          </span>
        </button>
      ) : null}
      <nav aria-label="Pagination" className="flex items-center gap-0.5 text-[12px] font-medium text-ink">
        <PagerButton label="Previous page" disabled={current === 1}>
          <Icon icon={faChevronLeft} size={9} />
        </PagerButton>
        {shown.map((p) => (
          <PagerButton key={p} active={p === current} label={`Page ${p}`}>
            {p}
          </PagerButton>
        ))}
        <span className="px-1 text-muted">…</span>
        <PagerButton label={`Page ${pages}`}>{pages}</PagerButton>
        <PagerButton label="Next page">
          <Icon icon={faChevronRight} size={9} />
        </PagerButton>
      </nav>
    </div>
  );
}

function PagerButton({ children, active, disabled, label }: { children: ReactNode; active?: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 transition-colors disabled:opacity-40",
        active ? "bg-mint font-bold text-ink" : "hover:bg-canvas",
      )}
    >
      {children}
    </button>
  );
}
