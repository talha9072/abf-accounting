"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

/**
 * Click-to-open popover with outside-click + Esc dismissal.
 * `trigger` receives the open state and toggle handler.
 */
export function Popover({
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setUncontrolled(v);
  };
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+8px)] z-40 animate-pop-in rounded-[14px] border border-line bg-white p-2 shadow-[0_16px_40px_rgb(10_31_59/0.16)]",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

/** Menu row used in account / row-action menus. */
export function MenuItem({
  icon,
  children,
  tone = "default",
  active,
  onClick,
  href,
}: {
  icon?: IconDefinition;
  children: ReactNode;
  tone?: "default" | "danger";
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium leading-[18px] transition-colors",
    tone === "danger" ? "text-danger hover:bg-danger-subtle" : "text-ink hover:bg-mint",
    active && "bg-mint",
  );
  const inner = (
    <>
      {icon ? (
        <span className={cn("flex w-4 justify-center", tone === "danger" ? "text-danger" : "text-muted")}>
          <Icon icon={icon} size={13} />
        </span>
      ) : null}
      <span>{children}</span>
    </>
  );
  if (href)
    return (
      <a
        href={href}
        className={cls}
        role="menuitem"
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls} role="menuitem">
      {inner}
    </button>
  );
}
