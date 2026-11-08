"use client";

import { useEffect } from "react";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";

/** Screen-only bar above a printable document; opens the print dialog automatically with ?auto=1. */
export function PrintToolbar({ title, detail, auto }: { title: string; detail: string; auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    // Wait for fonts + QR images so the first printout is complete.
    const go = () => setTimeout(() => window.print(), 300);
    if (document.fonts?.ready) document.fonts.ready.then(go);
    else go();
  }, [auto]);

  return (
    <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-white px-6 py-3 print:hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-bold text-ink">{title}</span>
        <span className="text-[12px] text-muted">{detail}</span>
      </div>
      <Button icon={faPrint} onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
