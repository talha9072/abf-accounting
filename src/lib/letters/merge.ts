import { escapeHtml } from "./html";

/** Values available to ##CODE# placeholders. */
export type MergeValues = {
  COMPANY_NAME: string;
  DIRECTOR_FIRSTNAME: string;
  DIRECTOR_FULLNAME: string;
  REGISTERED_ADDRESS: string;
  COMPANY_NUMBER: string;
  INCORPORATION_DATE: string;
  REFERENCE: string;
  OFFER: string;
  LETTER_DATE: string;
  BRAND_NAME: string;
  BRAND_SUPPORT_TELEPHONE: string;
  BRAND_SUPPORT_EMAIL: string;
};

/** Codes the letter layout draws itself; they are removed from the body text. */
const LAYOUT_CODES = new Set(["LETTER_HEAD", "LETTER_FOOTER", "QR_CODE"]);

/**
 * Replace ##CODE# placeholders. `html` must already be sanitised; values are escaped here.
 * Unknown codes are left visible so a typo shows up in the preview instead of vanishing.
 */
export function mergeCodes(html: string, values: MergeValues, { escape = true } = {}): string {
  return html.replace(/##([A-Z_]+)#/g, (whole, code: string) => {
    if (LAYOUT_CODES.has(code)) return "";
    const v = (values as Record<string, string | undefined>)[code];
    if (v === undefined) return whole;
    return escape ? escapeHtml(v) : v;
  });
}

/** Greeting with the "To whom it may concern," fallback when there's no director name. */
export function mergeGreeting(greeting: string, values: MergeValues): string {
  if (/##DIRECTOR_FIRSTNAME#/.test(greeting) && !values.DIRECTOR_FIRSTNAME) return "To whom it may concern,";
  if (/##DIRECTOR_FULLNAME#/.test(greeting) && !values.DIRECTOR_FULLNAME) return "To whom it may concern,";
  return mergeCodes(greeting, values, { escape: false });
}
