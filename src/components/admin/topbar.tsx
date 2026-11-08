"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  faBan,
  faBell,
  faBuilding,
  faCircleCheck,
  faCircleQuestion,
  faGear,
  faLocationDot,
  faMagnifyingGlass,
  faPrint,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/button";
import { MenuItem, Popover } from "@/components/ui/popover";
import { signOutAction } from "@/lib/auth/actions";
import { notificationsList } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

export type TopbarUser = { name: string; email: string; initials: string };

export function Topbar({ user }: { user: TopbarUser }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection must run on the client
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between gap-6 border-b border-line bg-white px-9">
      <div className="relative w-full max-w-[600px]">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] border border-line bg-canvas px-3.5 text-left text-[13px] leading-[18px] text-muted transition-colors hover:border-n400"
        >
          <Icon icon={faMagnifyingGlass} size={13} />
          <span className="flex-1 truncate">Search companies or company numbers…</span>
          <kbd className="rounded-md border border-line bg-white px-2 py-1 font-sans text-[10px] font-medium leading-[14px] text-muted">
            {isMac ? "⌘ K" : "Ctrl K"}
          </kbd>
        </button>
        {searchOpen ? <SearchPanel onClose={() => setSearchOpen(false)} /> : null}
      </div>

      <div className="flex items-center gap-3">
        <NotificationsMenu />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Search (⌘K)                                                         */
/* ------------------------------------------------------------------ */

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  type Hit = { number: string; name: string; meta: string };
  const [results, setResults] = useState<{ companies: Hit[]; optOuts: Hit[] }>({ companies: [], optOuts: [] });
  const [loading, setLoading] = useState(true);

  // Debounced server search (name or company number).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal, cache: "no-store" });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted / offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, q ? 200 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const open = (number: string) => {
    onClose();
    router.push(`/new-companies/${number}`);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Search"
      className="absolute left-0 top-0 z-50 w-[560px] max-w-[calc(100vw-340px)] animate-pop-in rounded-[14px] border border-line bg-white p-2 shadow-[0_16px_40px_rgb(10_31_59/0.16)]"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-muted">
          <Icon icon={faMagnifyingGlass} size={14} />
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.companies.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && results.companies[index]) open(results.companies[index].number);
          }}
          placeholder="Search companies or company numbers…"
          aria-label="Search companies"
          className="flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
        <kbd className="font-sans text-[11px] text-muted">esc</kbd>
      </div>

      <div className="max-h-[420px] overflow-y-auto scroll-area">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Companies</p>
        {results.companies.length === 0 ? (
          <p className="px-3 py-3 text-[13px] text-muted">
            {loading ? "Searching…" : q ? `No companies match “${q}”.` : "No companies imported yet."}
          </p>
        ) : (
          results.companies.map((c, i) => (
            <button
              key={c.number}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => open(c.number)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left",
                i === index ? "bg-mint" : "hover:bg-canvas",
              )}
            >
              <span className="mt-0.5 text-muted">
                <Icon icon={faBuilding} size={12} />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium leading-[18px] text-ink">{c.name}</span>
                <span className="text-[11px] leading-[15px] text-muted">{c.meta}</span>
              </span>
              {i === index ? <span className="text-[11px] text-muted">↵</span> : null}
            </button>
          ))
        )}
        {results.optOuts.length > 0 ? (
          <>
            <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted">Opt-outs</p>
            {results.optOuts.map((c) => (
              <button
                key={`${c.number}-${c.meta}`}
                type="button"
                onClick={() => c.number && open(c.number)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-canvas"
              >
                <span className="mt-0.5 text-muted">
                  <Icon icon={faBan} size={12} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium leading-[18px] text-ink">{c.name}</span>
                  <span className="text-[11px] leading-[15px] text-muted">{c.meta}</span>
                </span>
              </button>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const NOTE_ICON = {
  success: { icon: faCircleCheck, cls: "text-brand" },
  address: { icon: faLocationDot, cls: "text-warning" },
  excluded: { icon: faBan, cls: "text-muted" },
  print: { icon: faPrint, cls: "text-muted" },
};

function NotificationsMenu() {
  const [unread, setUnread] = useState(true);
  return (
    <Popover
      panelClassName="w-[380px]"
      trigger={({ toggle, open }) => (
        <IconButton icon={faBell} label="Notifications" onClick={toggle} aria-expanded={open} badge={unread} />
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-[15px] font-bold leading-5 text-ink">Notifications</p>
          <button type="button" onClick={() => setUnread(false)} className="text-[12px] font-medium text-brand hover:underline">
            Mark all read
          </button>
        </div>
        {notificationsList.map((n) => {
          const meta = NOTE_ICON[n.kind];
          return (
            <div key={n.title} className={cn("flex gap-3 rounded-lg px-3 py-2.5", n.unread && unread && "bg-mint")}>
              <span className={cn("mt-[3px] flex w-3 justify-center", meta.cls)}>
                <Icon icon={meta.icon} size={12} />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-medium leading-[18px] text-ink">{n.title}</p>
                <p className="text-[11px] leading-[15px] text-muted">{n.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

function AccountMenu({ user }: { user: TopbarUser }) {
  return (
    <Popover
      panelClassName="w-[260px]"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Account menu"
          className="flex size-10 items-center justify-center rounded-full bg-mint text-[12px] font-bold leading-4 text-ink transition-shadow hover:ring-2 hover:ring-line"
        >
          {user.initials}
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="px-3 pb-2 pt-2">
            <p className="text-[14px] font-bold leading-5 text-ink">{user.name}</p>
            <p className="truncate text-[12px] leading-4 text-muted">{user.email}</p>
          </div>
          <Link
            href="/account"
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-ink hover:bg-mint"
          >
            <span className="flex w-4 justify-center text-muted">
              <Icon icon={faGear} size={13} />
            </span>
            My account
          </Link>
          <MenuItem icon={faCircleQuestion} onClick={close}>
            Help &amp; how it works
          </MenuItem>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-danger-subtle"
            >
              <span className="flex w-4 justify-center">
                <Icon icon={faRightFromBracket} size={13} />
              </span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
