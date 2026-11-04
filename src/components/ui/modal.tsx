"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { faXmark, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconDefinition;
  iconTone?: "brand" | "danger";
  /** Width in px (Figma modal widths: 480 / 520 / 560 / 620 / 640). */
  width?: number;
  children?: ReactNode;
  footer?: ReactNode;
  /** Hide the × button (e.g. blocking confirmations). */
  hideClose?: boolean;
  className?: string;
};

/**
 * Accessible modal built on <dialog>: native focus trap, Esc to close,
 * backdrop click to close, scroll lock on the page behind.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconTone = "brand",
  width = 520,
  children,
  footer,
  hideClose,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        document.documentElement.style.overflow = "";
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      style={{ maxWidth: `min(${width}px, calc(100vw - 32px))` }}
      className={cn(
        "m-auto w-full rounded-[20px] bg-white p-0 text-ink shadow-[0_16px_40px_rgb(10_31_59/0.16)] backdrop:bg-ink/70 backdrop:backdrop-blur-[1px] open:animate-pop-in",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[calc(100vh-48px)] flex-col gap-[18px] overflow-y-auto p-7">
          <header className="flex items-start gap-3.5">
            {icon ? (
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
                  iconTone === "danger" ? "bg-danger-subtle text-danger" : "bg-mint text-brand",
                )}
              >
                <Icon icon={icon} size={15} />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="text-[18px] font-bold leading-[25px] text-ink">{title}</h2>
              {subtitle ? <p className="text-[13px] leading-[18px] text-muted">{subtitle}</p> : null}
            </div>
            {!hideClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-n100 hover:text-ink"
              >
                <Icon icon={faXmark} size={14} />
              </button>
            ) : null}
          </header>
          {children}
          {footer ? <footer className="flex flex-wrap items-center gap-3 pt-1.5">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Coloured information note used inside modals. */
export function Note({
  tone = "mint",
  icon,
  children,
  className,
}: {
  tone?: "mint" | "warning" | "danger" | "neutral";
  icon?: IconDefinition;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    mint: "bg-mint text-ink [&_.note-icon]:text-brand",
    // Figma used solid #c2410c / #dc2626 behind dark text (≈3:1 and ≈2:1 contrast).
    // Switched to the subtle status fills so the copy stays readable.
    warning: "bg-warning-subtle text-[#7c2d12] [&_.note-icon]:text-warning",
    danger: "bg-danger-subtle text-[#7f1d1d] [&_.note-icon]:text-danger",
    neutral: "bg-n100 text-ink [&_.note-icon]:text-muted",
  };
  return (
    <div className={cn("flex gap-2.5 rounded-[10px] px-3.5 py-3 text-[12px] leading-[18px]", tones[tone], className)}>
      {icon ? (
        <span className="note-icon mt-[3px]">
          <Icon icon={icon} size={12} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
