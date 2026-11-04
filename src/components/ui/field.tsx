import type { ComponentProps, ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

type InputSize = "md" | "lg";

const inputSizes: Record<InputSize, string> = {
  // Admin forms: 44px, r10, 13px text, 14px side padding
  md: "h-11 rounded-[10px] px-3.5 text-[13px]",
  // Auth forms: 52px, r12, 14px text, 16px side padding
  lg: "h-[52px] rounded-xl px-4 text-[14px]",
};

export const inputBase =
  "w-full border border-line bg-white text-ink placeholder:text-muted outline-none transition-[border-color,box-shadow] hover:border-n400 focus:border-brand focus:ring-[3px] focus:ring-brand/15 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15 disabled:bg-canvas disabled:text-muted read-only:bg-canvas read-only:text-muted";

export function Input({
  inputSize = "md",
  className,
  ...rest
}: { inputSize?: InputSize } & ComponentProps<"input">) {
  return <input className={cn(inputBase, inputSizes[inputSize], className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputBase, "min-h-[88px] resize-y rounded-[10px] px-3.5 py-3 text-[13px] leading-5", className)}
      {...rest}
    />
  );
}

/** Input with a leading icon (search fields). */
export function SearchInput({
  icon,
  className,
  inputClassName,
  ...rest
}: { icon: IconDefinition; inputClassName?: string } & ComponentProps<"input">) {
  return (
    <label
      className={cn(
        "flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3 text-muted transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15",
        className,
      )}
    >
      <Icon icon={icon} size={12} />
      <input
        className={cn("h-full min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-muted", inputClassName)}
        {...rest}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Field wrapper (label + control + hint/error)                        */
/* ------------------------------------------------------------------ */

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | string[] | null;
  size?: "md" | "lg";
  className?: string;
  labelExtra?: ReactNode;
  children: ReactNode;
};

export function Field({ label, htmlFor, hint, error, size = "md", className, labelExtra, children }: FieldProps) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-2" : "gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={htmlFor}
          className={cn("font-medium text-ink", size === "lg" ? "text-[13px] leading-[18px]" : "text-[12px] leading-4")}
        >
          {label}
        </label>
        {labelExtra}
      </div>
      {children}
      {errors.length > 0 ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12px] leading-4 text-danger">
          {errors.join(" ")}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[11px] leading-[15px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Select (native, styled)                                             */
/* ------------------------------------------------------------------ */

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(inputBase, inputSizes.md, "appearance-none pr-10", className)}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 512 512"
        className="pointer-events-none absolute right-4 top-1/2 size-2.5 -translate-y-1/2 fill-muted"
      >
        <path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z" />
      </svg>
    </div>
  );
}
