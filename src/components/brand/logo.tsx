import { cn } from "@/lib/cn";

type LogoProps = {
  variant?: "primary" | "white";
  /** Rendered width in px. The artwork is 177 × 52. */
  width?: number;
  className?: string;
};

export function Logo({ variant = "primary", width = 177, className }: LogoProps) {
  const src = variant === "white" ? "/brand/abf-logo-white.svg" : "/brand/abf-logo.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static vector logo, no optimisation needed
    <img
      src={src}
      alt="ABF Accounting Services Limited"
      width={width}
      height={Math.round((width * 52) / 177)}
      className={cn("block select-none", className)}
      draggable={false}
    />
  );
}
