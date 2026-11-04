"use client";

import { faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";

/** Root error boundary — never shows stack traces or query details to users. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[24px] font-bold leading-8 text-ink">Something went wrong</h1>
      <p className="max-w-md text-[14px] leading-5 text-muted">
        We couldn’t finish that request. Try again — if it keeps happening, tell your admin
        {error.digest ? (
          <>
            {" "}
            and quote <span className="font-mono text-ink">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <Button icon={faRotateRight} onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
