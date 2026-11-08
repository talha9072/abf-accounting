"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  faBuilding,
  faClockRotateLeft,
  faEnvelopeOpenText,
  faPrint,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { Logo } from "@/components/brand/logo";
import { usePull } from "@/components/admin/pull-center";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: IconDefinition; count?: string; title?: string };

export type SidebarCounts = { toReview: number; inRun: number };

export function Sidebar({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname();
  const fmt = (n: number) => n.toLocaleString("en-GB");
  const NAV: NavItem[] = [
    { href: "/new-companies", label: "New Companies", icon: faBuilding, count: counts.toReview ? fmt(counts.toReview) : undefined, title: "Ready, not reviewed yet" },
    { href: "/print", label: "Print", icon: faPrint, count: counts.inRun ? fmt(counts.inRun) : undefined, title: "In today’s print run" },
    { href: "/letter-templates", label: "Letter Templates", icon: faEnvelopeOpenText },
    { href: "/history", label: "History", icon: faClockRotateLeft },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-[272px] shrink-0 flex-col gap-[18px] bg-[linear-gradient(180deg,#0d333f_0%,#09242d_60%,#09242d_100%)] px-6 pb-6 pt-[26px] text-white">
      <Link href="/new-companies" aria-label="ABF New Companies home" className="self-start rounded-md">
        <Logo variant="white" width={176} />
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-[42px] items-center gap-3 rounded-[10px] px-3 text-[13px] font-medium leading-[18px] transition-colors",
                active
                  ? "bg-brand text-white shadow-nav"
                  : "text-white/78 hover:bg-white/[0.07] hover:text-white",
              )}
            >
              <span className="flex w-3.5 justify-center">
                <Icon icon={item.icon} size={14} className={active ? "" : "opacity-90"} />
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.count ? (
                <span
                  title={item.title}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold leading-[15px]",
                    active ? "bg-white/70 text-ink" : "bg-white/12 text-white/90",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <PullStatusCard />
    </aside>
  );
}

function PullStatusCard() {
  const { overview, running, open } = usePull();
  const latest = overview.latest;
  const failed = latest?.status === "failed";
  const line = running
    ? `Pulling new companies · ${latest?.percent ?? 0}%`
    : failed
      ? `Last pull failed · ${latest?.timeLabel}`
      : latest
        ? `Connected · checked at ${latest.timeLabel}`
        : "Not pulled yet · runs at 06:00";

  return (
    <button
      type="button"
      onClick={() => open(failed && !running ? "pull-failed" : "pull")}
      title="Companies House pull — open details"
      className="mt-auto flex flex-col gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.1]"
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            failed && !running ? "bg-danger shadow-[0_0_6px_1px_rgb(220_38_38/0.55)]" : "bg-brand shadow-[0_0_6px_1px_rgb(38_199_122/0.55)]",
            running && "animate-pulse",
          )}
        />
        <span className="text-[12px] font-medium leading-4">Companies House</span>
      </span>
      <span className="text-[11px] leading-[15px] text-white/62">{line}</span>
    </button>
  );
}
