import type { Metadata } from "next";
import { faEye, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { templateVersions } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Version history" };

export default function TemplateVersionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-[18px] text-muted">
        Every save creates a version. Past print runs keep the version they were printed with.
      </p>
      <ol className="rounded-[14px] border border-line px-6 py-2">
        {templateVersions.map((v) => (
          <li key={v.version} className="flex flex-wrap items-center gap-4 border-b border-line py-3.5 last:border-b-0">
            <span className="w-10 text-[14px] font-bold leading-5 text-ink">{v.version}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-[18px] text-ink">{v.summary}</span>
              <span className="text-[11px] leading-[15px] text-muted">{v.meta}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" icon={faEye}>
                View
              </Button>
              {!v.current ? (
                <Button variant="secondary" icon={faRotateLeft}>
                  Restore
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
