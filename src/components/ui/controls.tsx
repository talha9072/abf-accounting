"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Checkbox — 20×20, r5. Checked/indeterminate = brand green.          */
/* ------------------------------------------------------------------ */

type CheckboxProps = Omit<ComponentProps<"input">, "type" | "size"> & {
  indeterminate?: boolean;
  label?: ReactNode;
  labelClassName?: string;
};

export function Checkbox({ indeterminate, label, labelClassName, className, id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const box = (
    <span className={cn("relative inline-flex size-5 shrink-0", className)}>
      <input
        id={inputId}
        type="checkbox"
        aria-checked={indeterminate ? "mixed" : undefined}
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate);
        }}
        className="peer size-5 cursor-pointer appearance-none rounded-[5px] border border-line bg-white transition-colors checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand hover:border-n400 checked:hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        {...rest}
      />
      {/* tick */}
      <svg
        aria-hidden
        viewBox="0 0 448 512"
        className="pointer-events-none absolute left-1/2 top-1/2 hidden h-2.5 -translate-x-1/2 -translate-y-1/2 fill-white peer-checked:block peer-indeterminate:hidden"
      >
        <path d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z" />
      </svg>
      {/* dash */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[2px] w-2 -translate-x-1/2 -translate-y-1/2 rounded bg-white peer-indeterminate:block" />
    </span>
  );
  if (!label) return box;
  return (
    <label htmlFor={inputId} className={cn("inline-flex cursor-pointer items-center gap-3 text-[13px] text-ink", labelClassName)}>
      {box}
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Radio — 20×20 circle, selected = green fill with white dot          */
/* ------------------------------------------------------------------ */

export function Radio({
  label,
  description,
  className,
  id,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <span className="relative mt-px inline-flex size-5 shrink-0">
        <input
          id={inputId}
          type="radio"
          className="peer size-5 cursor-pointer appearance-none rounded-full border border-line bg-white transition-colors checked:border-brand checked:bg-brand hover:border-n400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          {...rest}
        />
        <span className="pointer-events-none absolute left-1/2 top-1/2 hidden size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white peer-checked:block" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] leading-[18px] text-ink">{label}</span>
        {description ? <span className="text-[11px] leading-[15px] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle — 40×22 track, 16px knob                                     */
/* ------------------------------------------------------------------ */

export function Toggle({
  label,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label className={cn("relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer", className)}>
      <input type="checkbox" role="switch" aria-label={label} className="peer sr-only" {...rest} />
      <span className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy" />
      <span className="absolute left-[3px] top-[3px] size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(9_36_45/0.2)] transition-transform peer-checked:translate-x-[18px]" />
    </label>
  );
}
