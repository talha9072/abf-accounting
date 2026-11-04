import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

type IconProps = {
  icon: IconDefinition;
  /** Pixel size of the glyph (matches the Figma font-size of the FA text layer). */
  size?: number;
  className?: string;
  title?: string;
  spin?: boolean;
};

/**
 * Renders a Font Awesome icon as inline SVG (no CSS or runtime needed).
 * The design uses "Font Awesome 6 Free Solid" glyphs throughout.
 */
export function Icon({ icon, size = 13, className, title, spin }: IconProps) {
  const [width, height, , , path] = icon.icon;
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={(size * width) / height}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      className={`inline-block shrink-0 fill-current ${spin ? "animate-spin" : ""} ${className ?? ""}`}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
