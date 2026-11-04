import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { label: ReactNode; href: string; active: boolean; count?: ReactNode };

/**
 * Segmented tabs — active tab is a white chip with a line border (Figma "Record Tabs").
 */
export function SegmentedTabs({ items, className, size = "md" }: { items: TabItem[]; className?: string; size?: "sm" | "md" }) {
  return (
    <nav aria-label="Sections" className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center rounded-[9px] border transition-colors",
            size === "md" ? "h-9 px-3.5 text-[12px] leading-4" : "h-8 px-3 text-[11px] leading-[15px]",
            t.active
              ? "border-line bg-white font-bold text-ink"
              : "border-transparent font-medium text-muted hover:bg-white/70 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Saved-view chips — active chip is mint (Figma "Saved Views" on New Companies).
 */
export function ViewChips({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav aria-label="Views" className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[12px] leading-4 transition-colors",
            t.active ? "bg-mint font-bold text-ink" : "font-medium text-muted hover:bg-white hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Boxed tabs with counters — grey track, active tab white (Figma History tabs).
 */
export function BoxedTabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav aria-label="Sections" className={cn("inline-flex items-center gap-1 rounded-xl bg-n100 p-1", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[13px] leading-[18px] transition-colors",
            t.active ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgb(9_36_45/0.06)]" : "font-medium text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined ? (
            <span className="rounded-full bg-n200 px-1.5 py-px text-[10px] font-semibold text-ink">{t.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
