"use client";

import { useState } from "react";
import { faCheck, faChevronDown, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export type FilterOption = string | { value: string; label: string };
const val = (o: FilterOption) => (typeof o === "string" ? o : o.value);
const lab = (o: FilterOption) => (typeof o === "string" ? o : o.label);

/**
 * Filter chip with a two-line label (Figma "Filter / …") and an options menu
 * (Figma "Dropdown / Incorporated"). Uncontrolled by default; pass `value` +
 * `onChange` to drive it from the URL.
 */
export function FilterDropdown({
  icon,
  label,
  options,
  defaultValue,
  value: controlled,
  onChange,
  footnote,
  variant = "stacked",
  className,
}: {
  icon: IconDefinition;
  label: string;
  options: FilterOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  footnote?: string;
  variant?: "stacked" | "inline";
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? val(options[0]));
  const value = controlled ?? internal;
  const current = options.find((o) => val(o) === value) ?? options[0];
  const shown = lab(current).replace(" (default)", "");

  return (
    <Popover
      align="start"
      className={className}
      panelClassName="w-[280px] max-h-[420px] overflow-y-auto scroll-area"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-[10px] border bg-white px-3 text-left transition-colors hover:border-n400",
            open ? "border-brand ring-[3px] ring-brand/15" : "border-line",
          )}
        >
          <span className="text-muted">
            <Icon icon={icon} size={11} />
          </span>
          {variant === "stacked" ? (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[9px] font-medium leading-3 text-muted">{label}</span>
              <span className="truncate text-[11px] font-medium leading-[14px] text-ink">{shown}</span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px] text-ink">{shown}</span>
          )}
          <span className="text-muted">
            <Icon icon={faChevronDown} size={8} />
          </span>
        </button>
      )}
    >
      {(close) => (
        <div role="listbox" aria-label={label} className="flex flex-col gap-0.5">
          {options.map((opt) => {
            const v = val(opt);
            const selected = v === value;
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  if (controlled === undefined) setInternal(v);
                  onChange?.(v);
                  close();
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] leading-[18px]",
                  selected ? "bg-mint font-medium text-brand" : "text-ink hover:bg-canvas",
                )}
              >
                {lab(opt)}
                {selected ? <Icon icon={faCheck} size={11} /> : null}
              </button>
            );
          })}
          {footnote ? <p className="px-3 pb-1 pt-2 text-[11px] leading-[15px] text-muted">{footnote}</p> : null}
        </div>
      )}
    </Popover>
  );
}
