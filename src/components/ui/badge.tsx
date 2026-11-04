import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "info" | "success" | "neutral" | "warning" | "danger" | "mint";

const tones: Record<Tone, { pill: string; dot: string }> = {
  info: { pill: "bg-info-subtle text-info", dot: "bg-info" },
  success: { pill: "bg-mint text-brand", dot: "bg-brand" },
  mint: { pill: "bg-mint text-ink", dot: "bg-brand" },
  neutral: { pill: "bg-n100 text-muted", dot: "bg-n400" },
  warning: { pill: "bg-warning-subtle text-warning", dot: "bg-warning" },
  danger: { pill: "bg-danger-subtle text-danger", dot: "bg-danger" },
};

/** Rounded status badge with a 6px dot (Figma: "Guru Letters / Status badge"). */
export function StatusBadge({
  tone = "info",
  children,
  size = "md",
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        size === "md" ? "h-7 pl-2.5 pr-3 text-[12px]" : "h-[22px] px-2 text-[10px]",
        t.pill,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} /> : null}
      {children}
    </span>
  );
}

/** Inline state with a dot and no pill (table "Print run" column). */
export function DotState({ tone, children }: { tone: Tone; children: ReactNode }) {
  const text = tone === "neutral" ? "text-muted" : tone === "info" ? "text-info" : tones[tone].pill.split(" ")[1];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px]", text)}>
      <span className={cn("size-1.5 rounded-full", tones[tone].dot)} />
      {children}
    </span>
  );
}

/** Small count pill (e.g. "6 total", tab counters). */
export function CountPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border border-line bg-white px-2 text-[10px] font-medium text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
