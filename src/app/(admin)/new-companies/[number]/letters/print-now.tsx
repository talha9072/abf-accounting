"use client";

import { faPrint, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { usePrintFlow } from "@/components/admin/print-parts";
import { Button } from "@/components/ui/button";

/**
 * "Print letter now" (Figma "Company Detail / Letters"): prints just this company's letter as
 * its own print run, then asks "Did it print?" like the main Print flow.
 */
export function PrintLetterNow({ companyNumber, canPrint }: { companyNumber: string; canPrint: boolean }) {
  const flow = usePrintFlow();
  return (
    <>
      {canPrint ? (
        <Button icon={flow.pending ? faSpinner : faPrint} disabled={flow.pending} onClick={() => flow.printOne(companyNumber)}>
          Print letter now
        </Button>
      ) : null}
      {flow.modals}
    </>
  );
}
