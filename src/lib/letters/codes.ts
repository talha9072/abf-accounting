import type { MergeValues } from "./merge";

/** Every ##CODE# the letter system understands, with where its value comes from. */
export const REPLACE_CODES: Array<{ code: string; key?: keyof MergeValues; example?: string; source: string; missing: string; inBody: boolean }> = [
  { code: "##COMPANY_NAME#", key: "COMPANY_NAME", source: "Companies House · company name", missing: "Skip company", inBody: true },
  { code: "##DIRECTOR_FIRSTNAME#", key: "DIRECTOR_FIRSTNAME", source: "Companies House · first active director", missing: "“To whom it may concern”", inBody: true },
  { code: "##DIRECTOR_FULLNAME#", key: "DIRECTOR_FULLNAME", source: "Companies House · first active director", missing: "Leaves the line out", inBody: true },
  { code: "##REGISTERED_ADDRESS#", key: "REGISTERED_ADDRESS", source: "Registered office (or fixed posting address)", missing: "Address issue", inBody: true },
  { code: "##COMPANY_NUMBER#", key: "COMPANY_NUMBER", source: "Companies House · company number", missing: "—", inBody: true },
  { code: "##INCORPORATION_DATE#", key: "INCORPORATION_DATE", source: "Companies House · date of creation", missing: "Leave blank", inBody: true },
  { code: "##REFERENCE#", key: "REFERENCE", source: "Prefix in Your business + company number", missing: "—", inBody: true },
  { code: "##OFFER#", key: "OFFER", source: "Template settings", missing: "Leave blank", inBody: true },
  { code: "##QR_CODE#", example: "QR → booking page with reference", source: "Your business · QR link", missing: "Hide QR", inBody: false },
  { code: "##LETTER_DATE#", key: "LETTER_DATE", source: "The day the letter is printed", missing: "—", inBody: true },
  { code: "##BRAND_NAME#", key: "BRAND_NAME", source: "Your business details", missing: "—", inBody: true },
  { code: "##BRAND_SUPPORT_TELEPHONE#", key: "BRAND_SUPPORT_TELEPHONE", source: "Your business details", missing: "Line left out", inBody: true },
  { code: "##BRAND_SUPPORT_EMAIL#", key: "BRAND_SUPPORT_EMAIL", source: "Your business details", missing: "Line left out", inBody: true },
  { code: "##LETTER_HEAD#", example: "Your logo, address and contact details", source: "Your business details", missing: "—", inBody: false },
  { code: "##LETTER_FOOTER#", example: "Stop line, privacy line, company details", source: "Your business details (always printed)", missing: "—", inBody: false },
];

/** The value this code gets for the preview company, or what it means when it isn't plain text. */
export function codeExample(c: (typeof REPLACE_CODES)[number], values: MergeValues): string {
  if (!c.key) return c.example ?? "—";
  const v = values[c.key];
  if (v) return v;
  if (c.key === "DIRECTOR_FIRSTNAME" || c.key === "DIRECTOR_FULLNAME") return "No director — “To whom it may concern”";
  return "(empty for this company)";
}
