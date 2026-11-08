import { faQrcode } from "@fortawesome/free-solid-svg-icons";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import type { RenderedLetter } from "@/lib/letters/data";
import { formatLongDate } from "@/lib/companies/format";

const BASE_W = 560; // A4 drawn at 560 × 792 (2.667 px/mm), then scaled
const BASE_H = 792;

type View = {
  recipient: string;
  companyName: string;
  addressLines: string[];
  reference: string;
  letterDate: string;
  greeting: string;
  bodyHtml: string;
  offer: string | null;
  cta: string | null;
  qrSvg: string | null;
  signOff: string;
  signatory: string | null;
  business: { name: string; address: string; phone: string; email: string; web: string; registration: string };
};

function fromRendered(l: RenderedLetter): View {
  return {
    recipient: l.directorFullName ?? "The Director",
    companyName: l.companyName,
    addressLines: l.addressLines.length ? l.addressLines : ["Address missing"],
    reference: l.reference,
    letterDate: formatLongDate(l.letterDate),
    greeting: l.greeting,
    bodyHtml: l.bodyHtml,
    offer: l.offer,
    cta: l.cta,
    qrSvg: l.qrSvg,
    signOff: l.signOff,
    signatory: l.signatory,
    business: l.business,
  };
}

/**
 * The printed A4 letter (Figma "Guru Letters / Printed letter (A4) — customer branded").
 * Drawn at 560 × 792 and scaled with CSS so it stays identical at any preview size and on paper.
 * `bodyHtml` is sanitised + merged on the server before it gets here.
 */
export function PrintedLetter({
  letter,
  width = BASE_W,
  showEnvelopeWindow = false,
  className,
  flat = false,
}: {
  letter: RenderedLetter;
  width?: number;
  showEnvelopeWindow?: boolean;
  className?: string;
  /** No shadow (paper output). */
  flat?: boolean;
}) {
  const v = fromRendered(letter);
  const scale = width / BASE_W;
  return (
    <div className={className} style={{ width, height: BASE_H * scale }} aria-label={`Letter to ${v.companyName}`} role="img">
      <div
        className={
          flat
            ? "relative flex origin-top-left flex-col bg-white text-ink"
            : "relative flex origin-top-left flex-col bg-white text-ink shadow-[0_1px_3px_rgb(9_36_45/0.08),0_8px_24px_rgb(9_36_45/0.06)]"
        }
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          padding: "37.6px 53.6px 32px 58.4px",
        }}
      >
        {/* Letterhead */}
        <div className="flex items-start justify-between">
          <Logo width={141} />
          <div className="flex flex-col items-end gap-[1.9px] text-right text-[7.06px] leading-[1.35] text-muted">
            <span className="font-semibold text-ink">{v.business.name}</span>
            <span>{v.business.address}</span>
            {v.business.phone ? <span>{v.business.phone}</span> : null}
            {v.business.email ? <span>{v.business.email}</span> : null}
            {v.business.web ? <span>{v.business.web}</span> : null}
          </div>
        </div>

        {/* Address window block */}
        <div className="relative mt-[59px] w-[227px]">
          {showEnvelopeWindow ? (
            <>
              <span className="absolute -top-[19px] right-0 text-[8.5px] font-medium text-brand print:hidden">Envelope window</span>
              <span className="pointer-events-none absolute -inset-x-[4px] -inset-y-[8px] rounded-[2px] border-[1.5px] border-dashed border-brand print:hidden" />
            </>
          ) : null}
          <div className="flex flex-col gap-[0.94px] text-[9.41px] leading-[1.38]">
            <span className="font-semibold">{v.recipient}</span>
            <span>{v.companyName}</span>
            {v.addressLines.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>

        {/* Date & ref */}
        <div className="mt-[38px] flex justify-between text-[8.94px] leading-[1.35]">
          <span>{v.letterDate}</span>
          <span className="text-muted">Our ref: {v.reference}</span>
        </div>

        {/* Body */}
        <div className="mt-[21px] flex flex-col gap-[10.35px] text-[8.94px] leading-[1.5]">
          <p className="text-[9.41px] font-semibold">{v.greeting}</p>
          <div
            className="flex flex-col gap-[10.35px] [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_li]:ml-3 [&_ol]:list-decimal [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: v.bodyHtml }}
          />
        </div>

        {/* Offer card */}
        {v.offer || v.cta ? (
          <div className="mt-[17px] flex items-center gap-[13.2px] rounded-[7.5px] bg-canvas py-[11.3px] pl-[11.3px] pr-[13.2px] print:bg-[#f3fbf5]">
            <span className="flex size-[55px] shrink-0 items-center justify-center overflow-hidden rounded-[3.8px] bg-white p-[4px] text-navy">
              {v.qrSvg ? (
                <span className="block size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: v.qrSvg }} />
              ) : (
                <Icon icon={faQrcode} size={28} />
              )}
            </span>
            <div className="flex flex-col gap-[2.8px]">
              {v.offer ? <span className="text-[10.35px] font-bold leading-[1.35] text-navy">{v.offer}</span> : null}
              {v.cta ? <span className="text-[8px] leading-[1.35]">{v.cta}</span> : null}
              <span className="text-[8px] leading-[1.35] text-muted">Quote reference {v.reference} when you get in touch</span>
            </div>
          </div>
        ) : null}

        {/* Sign-off */}
        <div className="mt-[21px] flex flex-col gap-[1.9px] text-[8.94px] leading-[1.35]">
          <span>{v.signOff}</span>
          <span className="h-[17px]" />
          {v.signatory ? <span className="font-semibold">{v.signatory}</span> : null}
          <span className="text-[8.47px] text-muted">{v.business.name}</span>
        </div>

        {/* Footer (always printed) */}
        <div className="mt-auto flex flex-col gap-[3.8px] border-t-[0.94px] border-navy/12 pt-[9.4px] text-[6.59px] leading-[1.4] text-muted">
          <p>
            Don’t want letters from us? Email {v.business.email} or call {v.business.phone}, quote {v.reference} and we’ll stop. We
            found your company on the public Companies House register — see {v.business.web}/privacy for how we use this
            information.
          </p>
          <p>{v.business.registration}</p>
        </div>
      </div>
    </div>
  );
}
