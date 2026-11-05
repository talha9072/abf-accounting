/**
 * "Why it gets a letter" — the 7 selection rules from the design.
 * Pure functions, so they can be unit-tested and re-run safely.
 */
import type { Address } from "@/lib/db/schema";
import type { ChAddress, ChOfficer } from "@/lib/companies-house/client";

export const RULES = [
  { key: "company_type", label: "Company type is Ltd or LLP" },
  { key: "address_complete", label: "Address is complete" },
  { key: "not_own_office", label: "Not at your own office address" },
  { key: "not_shared_address", label: "Not a shared or agent address" },
  { key: "not_ch_default", label: "Not a Companies House default address" },
  { key: "not_excluded", label: "Not excluded" },
  { key: "not_printed_before", label: "Not printed before" },
] as const;

export type RuleKey = (typeof RULES)[number]["key"];
export type Eligibility = Record<RuleKey, boolean>;
export type LetterState = "not_reviewed" | "address_issue" | "excluded" | "skipped";

/** More companies than this at one address in the look-back window ⇒ formation agent / virtual office. */
export const SHARED_ADDRESS_THRESHOLD = Number(process.env.SHARED_ADDRESS_THRESHOLD ?? 5);

const ALLOWED_TYPES = (process.env.ALLOWED_COMPANY_TYPES ?? "ltd,llp")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean);

const UK_POSTCODE = /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i;

/** Companies House default registered office address (used when an address is removed). */
const CH_DEFAULT_POSTCODE = "CF148LH";

/* ------------------------------------------------------------------ */
/* Address helpers                                                     */
/* ------------------------------------------------------------------ */

export function normPostcode(pc?: string | null) {
  return (pc ?? "").replace(/\s+/g, "").toUpperCase();
}

/** "Flat 2, 18 Loom St." → "FLAT 2 18 LOOM ST" — for comparing addresses. */
export function normLine(line?: string | null) {
  return (line ?? "")
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function addressKey(a: Pick<Address, "line1" | "postcode">) {
  return `${normLine(a.line1)}|${normPostcode(a.postcode)}`;
}

/** Map a Companies House address into our posting format. */
export function toAddress(ch: ChAddress | undefined): Address {
  const premises = ch?.premises?.trim();
  const line1Raw = ch?.address_line_1?.trim() ?? "";
  const line1 = premises && !line1Raw.toLowerCase().startsWith(premises.toLowerCase()) ? `${premises} ${line1Raw}`.trim() : line1Raw;
  return {
    line1: ch?.po_box ? `PO Box ${ch.po_box}${line1 ? `, ${line1}` : ""}` : line1,
    line2: ch?.address_line_2?.trim() || null,
    town: ch?.locality?.trim() || ch?.region?.trim() || "",
    postcode: ch?.postal_code?.trim().toUpperCase() || null,
    country: ch?.country?.trim() || null,
  };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export type RuleContext = {
  ownOffice: { line1: string; postcode: string } | null;
  /** addressKey → number of companies at that address in the look-back window */
  sharedCounts: Map<string, number>;
  excludedNumbers: Set<string>;
  excludedNames: Set<string>;
  printedNumbers: Set<string>;
};

export function evaluate(
  c: { companyNumber: string; name: string; companyType: string; address: Address },
  ctx: RuleContext,
): { eligibility: Eligibility; state: LetterState; skipReason: RuleKey | null } {
  const pc = normPostcode(c.address.postcode);
  const e: Eligibility = {
    company_type: ALLOWED_TYPES.includes(c.companyType.toLowerCase()),
    address_complete: Boolean(c.address.line1 && c.address.town && UK_POSTCODE.test(c.address.postcode ?? "")),
    not_own_office: !(
      ctx.ownOffice &&
      pc === normPostcode(ctx.ownOffice.postcode) &&
      normLine(c.address.line1).includes(normLine(ctx.ownOffice.line1))
    ),
    not_shared_address: (ctx.sharedCounts.get(addressKey(c.address)) ?? 0) < SHARED_ADDRESS_THRESHOLD,
    not_ch_default: pc !== CH_DEFAULT_POSTCODE,
    not_excluded: !ctx.excludedNumbers.has(c.companyNumber) && !ctx.excludedNames.has(normLine(c.name)),
    not_printed_before: !ctx.printedNumbers.has(c.companyNumber),
  };

  // Order matters: the first failing rule decides the state shown in the app.
  if (!e.not_excluded) return { eligibility: e, state: "excluded", skipReason: "not_excluded" };
  for (const key of ["company_type", "not_ch_default", "not_own_office", "not_shared_address", "not_printed_before"] as const) {
    if (!e[key]) return { eligibility: e, state: "skipped", skipReason: key };
  }
  if (!e.address_complete) return { eligibility: e, state: "address_issue", skipReason: "address_complete" };
  return { eligibility: e, state: "not_reviewed", skipReason: null };
}

/* ------------------------------------------------------------------ */
/* Director                                                            */
/* ------------------------------------------------------------------ */

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, ch: string) => `Mc${ch.toUpperCase()}`);
}

/**
 * First active (not resigned) natural-person director, earliest appointed.
 * Companies House names look like "GRIFFITHS, Danielle Christina".
 */
export function pickDirector(officers: ChOfficer[]): { firstName: string; fullName: string } | null {
  const active = officers
    .filter((o) => o.officer_role === "director" && !o.resigned_on && o.name)
    .sort((a, b) => (a.appointed_on ?? "").localeCompare(b.appointed_on ?? ""));
  const o = active[0];
  if (!o) return null;
  const [surnameRaw, givenRaw = ""] = o.name.split(",").map((s) => s.trim());
  const given = givenRaw.replace(/^(Mr|Mrs|Ms|Miss|Dr|Sir|Dame|Lord|Lady)\.?\s+/i, "");
  const first = given.split(/\s+/)[0] ?? "";
  if (!first) return { firstName: "", fullName: titleCase(surnameRaw) };
  return { firstName: titleCase(first), fullName: `${titleCase(first)} ${titleCase(surnameRaw)}` };
}
