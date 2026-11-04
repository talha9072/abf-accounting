import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** White card, 1px line border, r14, 20px padding (Figma cards on detail pages). */
export function Card({
  className,
  padding = "p-5",
  radius = "rounded-[14px]",
  ...rest
}: ComponentProps<"section"> & { padding?: string; radius?: string }) {
  return <section className={cn("border border-line bg-white", radius, padding, className)} {...rest} />;
}

export function CardHeader({
  title,
  aside,
  className,
  size = "md",
  as: Tag = "h2",
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  as?: "h2" | "h3";
}) {
  const sizes = {
    sm: "text-[14px] leading-5",
    md: "text-[17px] leading-[23px]",
    lg: "text-[18px] leading-[25px]",
  };
  return (
    <div className={cn("flex min-h-7 items-center justify-between gap-2.5", className)}>
      <Tag className={cn("font-bold text-ink", sizes[size])}>{title}</Tag>
      {aside}
    </div>
  );
}
