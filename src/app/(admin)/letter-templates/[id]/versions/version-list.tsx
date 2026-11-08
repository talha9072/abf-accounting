"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { faEye, faRotateLeft, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FitLetter } from "@/components/admin/fit-letter";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { mergeCodes, mergeGreeting } from "@/lib/letters/merge";
import type { RenderedLetter } from "@/lib/letters/data";
import { restoreVersionAction } from "@/lib/templates/actions";
import type { TemplateVersionItem } from "@/lib/templates/queries";
import type { PreviewContext } from "@/lib/templates/preview";

type Layout = { greeting: string; signOff: string; signatory: string; offer: string; cta: string };

export function VersionList({
  templateId,
  readOnly,
  versions,
  preview,
  layout,
}: {
  templateId: string;
  readOnly: boolean;
  versions: TemplateVersionItem[];
  preview: PreviewContext;
  layout: Layout;
}) {
  const router = useRouter();
  const toast = useToast();
  const [viewing, setViewing] = useState<TemplateVersionItem | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [, start] = useTransition();

  const restore = (v: TemplateVersionItem) => {
    setRestoring(v.id);
    start(async () => {
      const r = await restoreVersionAction(templateId, v.id);
      setRestoring(null);
      toast({ message: r.message });
      if (r.ok) router.refresh();
    });
  };

  const letterFor = (v: TemplateVersionItem): RenderedLetter => ({
    ...preview.recipient,
    bodyHtml: mergeCodes(v.contentHtml, preview.values),
    greeting: mergeGreeting(layout.greeting, preview.values),
    signOff: layout.signOff,
    signatory: layout.signatory || null,
    offer: layout.offer || null,
    cta: layout.cta || null,
    qrUrl: null,
    qrSvg: preview.qrSvg,
    business: preview.business,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-[18px] text-muted">
        Every save of the letter text creates a version. Past print runs keep the exact letters they were printed with.
      </p>
      <ol className="rounded-[14px] border border-line px-6 py-2">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-4 border-b border-line py-3.5 last:border-b-0">
            <span className="w-12 text-[14px] font-bold leading-5 text-ink">{v.version}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-[18px] text-ink">{v.summary}</span>
              <span className="text-[11px] leading-[15px] text-muted">{v.meta}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" icon={faEye} onClick={() => setViewing(v)}>
                View
              </Button>
              {!v.current && !readOnly ? (
                <Button variant="secondary" icon={restoring === v.id ? faSpinner : faRotateLeft} onClick={() => restore(v)} disabled={restoring !== null}>
                  Restore
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        width={560}
        title={viewing ? `${viewing.version} · ${viewing.summary}` : "Version"}
        subtitle={viewing ? `${viewing.meta} · preview with ${preview.recipient.companyName}` : undefined}
        footer={
          viewing && !viewing.current && !readOnly ? (
            <Button icon={faRotateLeft} className="ml-auto" onClick={() => (restore(viewing), setViewing(null))}>
              Restore this version
            </Button>
          ) : null
        }
      >
        {viewing ? (
          <div className="flex justify-center rounded-lg bg-canvas py-3">
            <FitLetter letter={letterFor(viewing)} max={440} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
