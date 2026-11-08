"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { PrintedLetter } from "./printed-letter";

/**
 * A letter preview that shrinks to fit narrow screens: drawn at `max` px wide when there's room,
 * otherwise at the width of its container (the letter scales, nothing overflows).
 */
export function FitLetter({ max = 560, ...props }: Omit<ComponentProps<typeof PrintedLetter>, "width"> & { max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.min(max, Math.floor(entry.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);

  return (
    <div ref={ref} className="flex w-full justify-center overflow-hidden" style={{ maxWidth: max }}>
      <PrintedLetter {...props} width={width} />
    </div>
  );
}
