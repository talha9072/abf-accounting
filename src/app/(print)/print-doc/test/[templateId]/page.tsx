import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { mergeCodes, mergeGreeting } from "@/lib/letters/merge";
import { getTemplateDetail } from "@/lib/templates/queries";
import { getPreviewContext } from "@/lib/templates/preview";
import { PrintToolbar } from "../../print-toolbar";

export const metadata: Metadata = { title: "Test letter" };

/** One sample letter for a template (any status) — for checking alignment on real paper. */
export default async function TestLetterDocument({ params, searchParams }: PageProps<"/print-doc/test/[templateId]">) {
  const { templateId } = await params;
  const sp = await searchParams;
  const t = await getTemplateDetail(templateId);
  if (!t) notFound();
  const p = await getPreviewContext(t.offer);
  const values = p.values;

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar
        title={`Test letter · ${t.name} ${t.version}`}
        detail={`Filled in with ${p.recipient.companyName} · nothing is recorded — use it to check the envelope window and printer margins`}
        auto={sp.auto === "1"}
      />
      <main className="flex justify-center py-8 print:block print:p-0">
        <div className="h-[297mm] w-[210mm] overflow-hidden bg-white shadow-[0_2px_10px_rgb(9_36_45/0.12)] print:shadow-none">
          <PrintedLetter
            width={793.7}
            flat
            showEnvelopeWindow={sp.guide === "1"}
            letter={{
              ...p.recipient,
              bodyHtml: mergeCodes(t.contentHtml, values),
              greeting: mergeGreeting(t.greeting, values),
              signOff: t.signOff,
              signatory: t.signatory || null,
              offer: t.offer || null,
              cta: t.cta || null,
              qrUrl: null,
              qrSvg: p.qrSvg,
              business: p.business,
            }}
          />
        </div>
      </main>
    </>
  );
}
