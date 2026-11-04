import { faQrcode } from "@fortawesome/free-solid-svg-icons";
import { Logo } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import { business } from "@/lib/mock-data";

export type LetterData = {
  directorFullName: string;
  directorFirstName: string;
  companyName: string;
  addressLines: string[];
  reference: string;
  incorporatedLong: string;
  letterDate: string;
};

export const sampleLetter: LetterData = {
  directorFullName: "Sarah Ahmed",
  directorFirstName: "Sarah",
  companyName: "Northfield Studio Labs Ltd",
  addressLines: ["18 Loom Street", "Manchester", "M1 2AB"],
  reference: "ABF-17840124",
  incorporatedLong: "22 September 2026",
  letterDate: "23 September 2026",
};

const BASE_W = 560; // A4 at 2.667px/mm
const BASE_H = 792;

/**
 * The printed A4 letter (Figma "Guru Letters / Printed letter (A4) — customer branded").
 * Drawn at 560 × 792 and scaled with CSS so it stays pixel-identical at any preview size.
 */
export function PrintedLetter({
  data = sampleLetter,
  width = BASE_W,
  showEnvelopeWindow = false,
  className,
}: {
  data?: LetterData;
  width?: number;
  showEnvelopeWindow?: boolean;
  className?: string;
}) {
  const scale = width / BASE_W;
  return (
    <div
      className={className}
      style={{ width, height: BASE_H * scale }}
      aria-label={`Letter preview for ${data.companyName}`}
      role="img"
    >
      <div
        className="relative flex origin-top-left flex-col bg-white text-ink shadow-[0_1px_3px_rgb(9_36_45/0.08),0_8px_24px_rgb(9_36_45/0.06)]"
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
            <span className="font-semibold text-ink">{business.name}</span>
            <span>{business.address}</span>
            <span>{business.phone}</span>
            <span>{business.email}</span>
            <span>{business.web}</span>
          </div>
        </div>

        {/* Address window block */}
        <div className="relative mt-[59px] w-[227px]">
          {showEnvelopeWindow ? (
            <>
              <span className="absolute -top-[19px] right-0 text-[8.5px] font-medium text-brand">Envelope window</span>
              <span className="pointer-events-none absolute -inset-x-[4px] -inset-y-[8px] rounded-[2px] border-[1.5px] border-dashed border-brand" />
            </>
          ) : null}
          <div className="flex flex-col gap-[0.94px] text-[9.41px] leading-[1.38]">
            <span className="font-semibold">{data.directorFullName}</span>
            <span>{data.companyName}</span>
            {data.addressLines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        {/* Date & ref */}
        <div className="mt-[38px] flex justify-between text-[8.94px] leading-[1.35]">
          <span>{data.letterDate}</span>
          <span className="text-muted">Our ref: {data.reference}</span>
        </div>

        {/* Body */}
        <div className="mt-[21px] flex flex-col gap-[10.35px] text-[8.94px] leading-[1.5]">
          <p className="text-[9.41px] font-semibold">Dear {data.directorFirstName},</p>
          <p>
            Congratulations on incorporating {data.companyName} on {data.incorporatedLong}.
          </p>
          <p>
            ABF Accounting helps new UK companies get their bookkeeping, accounts and filings right from day one, with a dedicated
            accountant and clear fixed prices.
          </p>
          <p>
            Our Business Starter services start from £65, and our Full Compliance Pack covers your Confirmation Statement, annual
            accounts and Corporation Tax return for a fixed £300.
          </p>
        </div>

        {/* Offer card */}
        <div className="mt-[17px] flex items-center gap-[13.2px] rounded-[7.5px] bg-canvas py-[11.3px] pl-[11.3px] pr-[13.2px]">
          <span className="flex size-[55px] shrink-0 items-center justify-center rounded-[3.8px] bg-white text-navy">
            <Icon icon={faQrcode} size={28} />
          </span>
          <div className="flex flex-col gap-[2.8px]">
            <span className="text-[10.35px] font-bold leading-[1.35] text-navy">Business Starter from £65</span>
            <span className="text-[8px] leading-[1.35]">Scan the code or visit abfaccounting.com/business-starter</span>
            <span className="text-[8px] leading-[1.35] text-muted">
              Quote reference {data.reference} when you get in touch
            </span>
          </div>
        </div>

        {/* Sign-off */}
        <div className="mt-[21px] flex flex-col gap-[1.9px] text-[8.94px] leading-[1.35]">
          <span>Kind regards,</span>
          <span className="h-[17px]" />
          <span className="font-semibold">Lekan</span>
          <span className="text-[8.47px] text-muted">{business.name}</span>
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-[3.8px] border-t-[0.94px] border-navy/12 pt-[9.4px] text-[6.59px] leading-[1.4] text-muted">
          <p>
            Don’t want letters from us? Email {business.email} or call {business.phone}, quote {data.reference} and we’ll stop. We
            found your company on the public Companies House register — see abfaccounting.com/privacy for how we use this
            information.
          </p>
          <p>{business.registration}</p>
        </div>
      </div>
    </div>
  );
}
