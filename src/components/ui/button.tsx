import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "./icon";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "md" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-[9px] whitespace-nowrap rounded-[10px] font-medium leading-[18px] transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-55 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-[#027a35]",
  secondary:
    "border border-line bg-white text-ink hover:border-n400 hover:bg-canvas active:bg-n100",
  danger: "bg-danger text-white hover:bg-[#c21f1f]",
  ghost: "text-ink hover:bg-n100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[12px]",
  md: "h-11 px-4 text-[13px]",
  lg: "h-12 px-5 text-[14px]",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconDefinition;
  iconRight?: IconDefinition;
  block?: boolean;
  children?: ReactNode;
  className?: string;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className,
}: Pick<CommonProps, "variant" | "size" | "block" | "className">) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

function Inner({ icon, iconRight, children, size }: CommonProps) {
  const iconSize = size === "sm" ? 12 : 13;
  return (
    <>
      {icon ? <Icon icon={icon} size={iconSize} /> : null}
      {children}
      {iconRight ? <Icon icon={iconRight} size={iconSize - 2} /> : null}
    </>
  );
}

export function Button({
  variant,
  size,
  icon,
  iconRight,
  block,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  iconRight,
  block,
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<typeof Link>, "children" | "className">) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}

/** Square 40×40 icon button used in the top bar. */
export function IconButton({
  icon,
  label,
  className,
  badge,
  ...rest
}: { icon: IconDefinition; label: string; badge?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-[10px] border border-line bg-white text-ink transition-colors hover:bg-canvas",
        className,
      )}
      {...rest}
    >
      <Icon icon={icon} size={14} />
      {badge ? (
        <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-white" />
      ) : null}
    </button>
  );
}
