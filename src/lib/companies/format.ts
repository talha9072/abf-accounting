import type { Address } from "@/lib/db/schema";
import sicCodes from "@/data/sic-codes.json";

/** Words kept upper-case when tidying Companies House names. */
const KEEP_UPPER = new Set([
  "UK", "GB", "LLP", "PLC", "CIC", "LP", "IT", "HR", "PR", "AI", "TV", "UAE", "USA", "EU", "NHS", "CEO", "BBQ", "SEO", "UX", "UI",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XL", "XXL", "DIY", "MOT", "PT", "HMO", "SPV", "MCR", "EV", "B2B", "B2C", "3D",
]);
const KEEP_LOWER = new Set(["and", "of", "the", "for", "in", "on", "at", "to", "by", "de", "la", "le", "du", "da", "van", "von"]);

/**
 * "FIFTEEN ELEVEN HOLDINGS LIMITED" → "Fifteen Eleven Holdings Limited",
 * "SF FUELS LTD" → "SF Fuels Ltd", "F & B CATERING LTD" → "F & B Catering Ltd".
 */
export function formatCompanyName(raw: string): string {
  if (!raw) return raw;
  // Leave names that already use mixed case alone.
  if (raw !== raw.toUpperCase()) return raw;
  const words = raw.split(/(\s+)/);
  let wordIndex = 0;
  return words
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const i = wordIndex++;
      const bare = w.replace(/[^A-Z0-9&]/gi, "");
      if (KEEP_UPPER.has(bare)) return w;
      if (bare === "LTD") return w.replace("LTD", "Ltd");
      if (bare === "CO") return w.replace("CO", "Co");
      if (/^[A-Z]{1,2}$/.test(bare) && !/^(A|I|IS|IN|ON|OF|TO|AT|BY|MY|WE|GO|DO|NO|SO|UP|AN|AS|BE|OR|IT)$/.test(bare)) return w; // initials: "SF", "J"
      if (/\d/.test(bare) && /[A-Z]/.test(bare) && bare.length <= 4) return w; // "B2B", "4X4"
      if (/^[B-DF-HJ-NP-TV-XZ]{2,5}$/.test(bare)) return w; // no vowels → an acronym: "GSD", "PJM", "BTC"
      const lower = w.toLowerCase();
      if (i > 0 && KEEP_LOWER.has(lower)) return lower;
      return lower.replace(/(^|['(/.-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join("")
    .replace(/\bMc(\p{L})/gu, (_, ch: string) => `Mc${ch.toUpperCase()}`)
    .replace(/'S\b/g, "'s");
}

/** Title-case a town ("NEWCASTLE UPON TYNE" → "Newcastle Upon Tyne"). */
function tidy(s?: string | null) {
  if (!s) return "";
  if (s !== s.toUpperCase()) return s.trim();
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()).trim();
}

/** The address a letter goes to: the fixed posting address if one was saved, else the registered office. */
export function postingAddress(c: { registeredOffice: Address; postingAddress: Address | null }): Address {
  return c.postingAddress ?? c.registeredOffice;
}

export function addressLines(a: Address): string[] {
  return [tidy(a.line1), tidy(a.line2), tidy(a.town), (a.postcode ?? "").toUpperCase()].filter(Boolean);
}

export function formatAddress(a: Address): string {
  return addressLines(a).join(", ");
}

/** "2026-11-04" → "4 Nov 2026" */
export function formatDate(day: string | null | undefined): string {
  if (!day) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day.slice(0, 10)}T12:00:00Z`),
  );
}

/** "2026-11-04" → "4 November 2026" (used in letters) */
export function formatLongDate(day: string | Date): string {
  const d = typeof day === "string" ? new Date(`${day.slice(0, 10)}T12:00:00Z`) : day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

const TYPE_LABELS: Record<string, string> = {
  ltd: "Private limited company",
  llp: "Limited liability partnership",
  plc: "Public limited company",
  "private-limited-guarant-nsc": "Private limited by guarantee",
  "private-limited-guarant-nsc-limited-exemption": "Private limited by guarantee (exempt)",
  "private-unlimited": "Private unlimited company",
  "limited-partnership": "Limited partnership",
  "registered-overseas-entity": "Registered overseas entity",
  "community-interest-company": "Community interest company",
};

export function companyTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* SIC codes                                                           */
/* ------------------------------------------------------------------ */

const SIC = sicCodes as Record<string, string>;

export function sicDescription(code: string): string {
  return SIC[code] ?? "";
}

/** "62012 · Business and domestic software development" */
export function sicLabel(code: string | undefined): string {
  if (!code) return "—";
  const d = sicDescription(code);
  return d ? `${code} · ${d}` : code;
}

/** UK SIC 2007 sections, by the first two digits of the code. */
export const SIC_SECTIONS: Array<{ key: string; label: string; from: number; to: number }> = [
  { key: "A", label: "Agriculture, forestry & fishing", from: 1, to: 3 },
  { key: "B", label: "Mining & quarrying", from: 5, to: 9 },
  { key: "C", label: "Manufacturing", from: 10, to: 33 },
  { key: "D", label: "Energy supply", from: 35, to: 35 },
  { key: "E", label: "Water & waste", from: 36, to: 39 },
  { key: "F", label: "Construction", from: 41, to: 43 },
  { key: "G", label: "Wholesale & retail", from: 45, to: 47 },
  { key: "H", label: "Transport & storage", from: 49, to: 53 },
  { key: "I", label: "Hotels, food & drink", from: 55, to: 56 },
  { key: "J", label: "Information & communication", from: 58, to: 63 },
  { key: "K", label: "Finance & insurance", from: 64, to: 66 },
  { key: "L", label: "Real estate", from: 68, to: 68 },
  { key: "M", label: "Professional & technical", from: 69, to: 75 },
  { key: "N", label: "Admin & support services", from: 77, to: 82 },
  { key: "O", label: "Public administration", from: 84, to: 84 },
  { key: "P", label: "Education", from: 85, to: 85 },
  { key: "Q", label: "Health & social work", from: 86, to: 88 },
  { key: "R", label: "Arts & recreation", from: 90, to: 93 },
  { key: "S", label: "Other services", from: 94, to: 96 },
  { key: "T", label: "Households as employers", from: 97, to: 98 },
  { key: "U", label: "Extraterritorial bodies", from: 99, to: 99 },
];
