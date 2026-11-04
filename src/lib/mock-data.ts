/**
 * Design-stage sample data, taken from the Figma screens.
 * Every screen reads from here for now; when functionality is built these
 * become database queries (see src/lib/db/schema.ts) with the same shapes.
 */

export type PrintRunState = "added" | "not_added" | "sent" | "address_issue" | "excluded";

export type CompanyRow = {
  number: string;
  name: string;
  director: string;
  directorFirstName: string;
  address: string;
  addressLines: [string, string, string]; // street, town, postcode
  incorporated: string;
  sic: string;
  state: PrintRunState;
};

const NAMES = [
  "Northfield Studio Labs Ltd", "Harbour & Pine Consulting Ltd", "Brightwell Systems Ltd", "Oakline Holdings Ltd",
  "Meridian Workshop Ltd", "Aster & Field Logistics Ltd", "Vela Analytics Ltd", "Cedar Lane Retail Ltd",
  "Kestrel Trading Ltd", "Juniper Row Advisory Ltd", "Lumen Digital Ltd", "Bramble Operations Ltd",
  "Copperleaf Studio Labs Ltd", "Silverbirch Consulting Ltd", "Foxglove Systems Ltd", "Riverstone Holdings Ltd",
  "Ashgrove Workshop Ltd", "Bluebell Logistics Ltd", "Thistle Analytics Ltd", "Willow Retail Ltd",
  "Highgate Trading Ltd", "Granite Advisory Ltd", "Orchard Digital Ltd", "Larkspur Operations Ltd",
  "Elmstead Studio Labs Ltd", "Hawthorn Consulting Ltd", "Marigold Systems Ltd", "Pinecrest Holdings Ltd",
  "Redwood Workshop Ltd", "Saffron Logistics Ltd", "Tamarind Analytics Ltd", "Umber Retail Ltd",
  "Violet Lane Trading Ltd", "Wrenfield Advisory Ltd", "Yarrow Digital Ltd", "Zephyr Operations Ltd",
  "Alder Studio Labs Ltd", "Beacon Consulting Ltd", "Clover Systems Ltd", "Driftwood Holdings Ltd",
  "Ember Workshop Ltd", "Fernhill Logistics Ltd", "Glenmore Analytics Ltd", "Heather Retail Ltd",
  "Ironbridge Trading Ltd", "Jasper Advisory Ltd", "Kingfisher Digital Ltd", "Linden Operations Ltd",
  "Moorland Studio Labs Ltd", "Nettlebed Consulting Ltd",
];
const FIRST = ["Sarah", "Daniel", "Hannah", "Ryan"];
const LAST = ["Ahmed", "Rossi", "Chen", "Taylor", "Khan", "Murphy", "Patel", "Bello", "Evans", "Reid", "Clarke", "Okafor", "Hussain", "Price", "Ali", "Walsh", "Green", "Hughes"];
export const ADDRESSES: Array<[string, string, string]> = [
  ["18 Loom Street", "Manchester", "M1 2AB"],
  ["9 Colmore Row", "Birmingham", "B1 1TB"],
  ["55 Silbury Blvd", "Milton Keynes", "MK9 2AH"],
  ["80 Marlowes", "Hemel Hempstead", "HP1 1LF"],
  ["22 Park Row", "Leeds", "LS1 5AA"],
  ["7 Market Square", "Bedford", "MK40 1SY"],
  ["3 Clarendon Rd", "Watford", "WD17 1HP"],
  ["4 Quay Road", "Bristol", "BS1 4DJ"],
  ["31 High Street", "Luton", "LU1 2EP"],
  ["12 Holywell Hill", "St Albans", "AL1 1BT"],
];
const SIC = [
  "62012 · IT consultancy", "43390 · Building completion", "82990 · Business support", "49410 · Road haulage",
  "70229 · Management consultancy", "74100 · Specialised design", "96020 · Hairdressing", "47910 · Internet retail",
  "56101 · Restaurants", "68209 · Letting property",
];

export const companies: CompanyRow[] = NAMES.map((name, i) => {
  const first = FIRST[i % 4];
  const last = LAST[i % LAST.length];
  const addr = ADDRESSES[i % 10];
  return {
    number: String(17840124 + i * 37),
    name,
    director: `${first} ${last}`,
    directorFirstName: first,
    address: addr.join(", "),
    addressLines: addr,
    incorporated: "22 Oct 2026",
    sic: SIC[i % 10],
    state: i < 10 ? "added" : "not_added",
  };
});

export function findCompany(number: string) {
  return companies.find((c) => c.number === number);
}

export const feedCounts = {
  all: "2,346",
  notReviewed: "2,284",
  addedToRun: "10",
  sent: "48",
  addressIssue: "4",
  excluded: "63",
};

/* ------------------------------------------------------------------ */
/* Print                                                               */
/* ------------------------------------------------------------------ */

export const recentRuns = [
  { date: "21 Sep 2026", letters: "10 letters", template: "Welcome Letter v3 · Reprint" },
  { date: "20 Sep 2026", letters: "9 letters", template: "Welcome Letter v3 · Reprint" },
  { date: "19 Sep 2026", letters: "10 letters", template: "Welcome Letter v3 · Reprint" },
];

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export type TemplateSummary = {
  id: string;
  name: string;
  status: "Active" | "Draft" | "Archived";
  usage: string;
  edited: string;
};

export const templates: TemplateSummary[] = [
  { id: "welcome-letter-v3", name: "Welcome Letter v3", status: "Active", usage: "Default · used for every print run", edited: "Edited today" },
  { id: "startup-intro-v2", name: "Startup Intro v2", status: "Active", usage: "Available", edited: "Edited 20 Sep" },
  { id: "advisory-letter-v4", name: "Advisory Letter v4", status: "Active", usage: "Available", edited: "Edited 18 Sep" },
  { id: "retail-welcome-v1", name: "Retail Welcome v1", status: "Active", usage: "Available", edited: "Edited 15 Sep" },
  { id: "general-introduction", name: "General Introduction", status: "Draft", usage: "Not used", edited: "Edited 12 Sep" },
  { id: "legacy-welcome-v2", name: "Legacy Welcome v2", status: "Archived", usage: "Read-only", edited: "Archived 01 Sep" },
];

export const replaceCodes = [
  { code: "##COMPANY_NAME#", example: "Northfield Studio Labs Ltd", source: "Companies House · company name", missing: "Skip company", menu: "Northfield Studio Labs Ltd" },
  { code: "##DIRECTOR_FIRSTNAME#", example: "Sarah", source: "Companies House · first active director", missing: "“To whom it may concern”", menu: "Sarah  (or “To whom it may concern”)" },
  { code: "##DIRECTOR_FULLNAME#", example: "Sarah Ahmed", source: "Companies House · first active director", missing: "Leaves the line out", menu: "Sarah Ahmed" },
  { code: "##REGISTERED_ADDRESS#", example: "18 Loom Street, Manchester, M1 2AB", source: "Registered office (or fixed posting address)", missing: "Address issue", menu: "18 Loom Street, Manchester…" },
  { code: "##COMPANY_NUMBER#", example: "17840124", source: "Companies House · company number", missing: "—", menu: "17840124" },
  { code: "##INCORPORATION_DATE#", example: "22 Sep 2026", source: "Companies House · date of creation", missing: "Leave blank", menu: "22 Sep 2026" },
  { code: "##REFERENCE#", example: "ABF-17840124", source: "Prefix in Your business + company number", missing: "—", menu: "ABF-17840124" },
  { code: "##OFFER#", example: "Business Starter from £65", source: "Template settings", missing: "Leave blank", menu: "Business Starter from £65" },
  { code: "##QR_CODE#", example: "QR → booking page with reference", source: "Your business · QR link", missing: "Hide QR", menu: "QR linking to the booking page" },
  { code: "##LETTER_DATE#", example: "23 September 2026", source: "The day the letter is printed", missing: "—", menu: "23 September 2026" },
  { code: "##BRAND_NAME#", example: "ABF Accounting Services Ltd", source: "Your business details", missing: "—", menu: "ABF Accounting Services Ltd" },
  { code: "##BRAND_SUPPORT_TELEPHONE#", example: "+44 7405 141694", source: "Your business details", missing: "Line left out", menu: "+44 7405 141694" },
  { code: "##BRAND_SUPPORT_EMAIL#", example: "support@abfaccounting.com", source: "Your business details", missing: "Line left out", menu: "support@abfaccounting.com" },
  { code: "##LETTER_HEAD#", example: "Your logo, address and contact details", source: "Your business details", missing: "—", menu: "Logo, address and contact details" },
  { code: "##LETTER_FOOTER#", example: "Stop line, privacy line, company details", source: "Your business details (always printed)", missing: "—", menu: "Exclude, privacy and company details" },
];

export const templateVersions = [
  { version: "v3.4", summary: "Added exclude footer line", meta: "Abi Brown · Today 09:12 · Current", current: true },
  { version: "v3.3", summary: "Changed offer to “Business Starter from £65”", meta: "Lekan · 20 Sep 2026", current: false },
  { version: "v3.2", summary: "Reworded opening paragraph", meta: "Abi Brown · 18 Sep 2026", current: false },
  { version: "v3.1", summary: "Created from Welcome Letter v2", meta: "Lekan · 15 Sep 2026", current: false },
];

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

const HISTORY_NAMES = [
  "Northfield Studio Labs Ltd", "Oakline Operations Ltd", "Vela Digital Ltd", "Juniper Row Advisory Ltd", "Copperleaf Trading Ltd",
  "Riverstone Retail Ltd", "Thistle Analytics Ltd", "Willow Logistics Ltd", "Highgate Workshop Ltd", "Brightwell Holdings Ltd",
  "Aster & Field Systems Ltd", "Kestrel Consulting Ltd", "Bramble Studio Labs Ltd", "Foxglove Operations Ltd", "Bluebell Digital Ltd",
  "Granite Advisory Ltd", "Orchard Trading Ltd", "Harbour & Pine Retail Ltd", "Meridian Analytics Ltd", "Cedar Lane Logistics Ltd",
  "Lumen Workshop Ltd", "Silverbirch Holdings Ltd", "Ashgrove Systems Ltd", "Larkspur Consulting Ltd", "Elmstead Studio Labs Ltd",
];
const HISTORY_DIRECTORS = [
  "Sarah Ahmed", "Tom Hughes", "Priya Ali", "Kwame Okafor", "Zara Evans", "Ryan Murphy", "Nina Chen", "James Mensah", "Aisha Green",
  "Oliver Price", "Hannah Clarke", "Ben Bello", "Chloe Khan", "Sam Rossi", "Mei Kowalski", "Daniel Walsh", "Grace Hussain", "Luca Reid",
  "Fatima Patel", "Ade Taylor",
];
const HISTORY_ADDR = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const PRINTERS = ["Abi Brown", "Lekan", "Priya Shah"];

export const sentHistory = Array.from({ length: 50 }, (_, i) => {
  const run = i < 10 ? { date: "23 Oct 2026", pr: "PR-2310" } : i < 21 ? { date: "22 Oct 2026", pr: "PR-2210" } : { date: "21 Oct 2026", pr: "PR-2110" };
  return {
    name: HISTORY_NAMES[i % HISTORY_NAMES.length],
    number: String(17830124 + i * 41),
    director: HISTORY_DIRECTORS[i % HISTORY_DIRECTORS.length],
    address: ADDRESSES[HISTORY_ADDR[i % 10]].join(", "),
    sentOn: run.date,
    printRun: run.pr,
    printedBy: PRINTERS[i % 3],
  };
});

export const historyCounts = { sent: "1,412", excluded: "63", notSent: "46,118", printRuns: "22" };

export const printRunsHistory = [
  { ref: "PR-2310", date: "23 Oct 2026 · 09:12", letters: 10, template: "Welcome Letter v3", by: "Abi Brown", labels: "Printed" },
  { ref: "PR-2210", date: "22 Oct 2026 · 09:04", letters: 11, template: "Welcome Letter v3", by: "Lekan", labels: "Printed" },
  { ref: "PR-2110", date: "21 Oct 2026 · 09:20", letters: 10, template: "Welcome Letter v3", by: "Priya Shah", labels: "Printed" },
  { ref: "PR-2010", date: "20 Oct 2026 · 09:08", letters: 9, template: "Welcome Letter v3", by: "Abi Brown", labels: "Printed" },
  { ref: "PR-1910", date: "19 Oct 2026 · 09:15", letters: 10, template: "Startup Intro v2", by: "Lekan", labels: "Not printed" },
];

export const excludedHistory = [
  { name: "North & Co Ltd", number: "17712004", reason: "Asked not to be contacted", by: "Abi Brown", date: "14 Sep 2026" },
  { name: "Helio & North Ltd", number: "17790311", reason: "Existing ABF client", by: "Abi Brown", date: "Yesterday" },
  { name: "Quayside Partners LLP", number: "OC451229", reason: "Agent address", by: "Lekan", date: "12 Sep 2026" },
  { name: "Brightwater Formations Ltd", number: "17698420", reason: "Formation agent", by: "Priya Shah", date: "10 Sep 2026" },
];

/* ------------------------------------------------------------------ */
/* Header widgets                                                      */
/* ------------------------------------------------------------------ */

export const notificationsList = [
  { kind: "success" as const, title: "Morning pull complete", detail: "1,248 companies ready · 06:04", unread: true },
  { kind: "address" as const, title: "5 address issues", detail: "Fix before printing today’s run · 06:04", unread: false },
  { kind: "excluded" as const, title: "Exclude added", detail: "Helio & North Ltd by A. Brown · Yesterday", unread: false },
  { kind: "print" as const, title: "Print run confirmed", detail: "10 letters marked printed · Yesterday", unread: false },
];

export const business = {
  name: "ABF Accounting Services Ltd",
  address: "18 Thricknells Close, Luton, LU3 3RP",
  phone: "+44 7405 141694",
  email: "support@abfaccounting.com",
  web: "abfaccounting.com",
  registration:
    "ABF Accounting Services Ltd · Registered in England and Wales No. 15299101 · Registered office: 18 Thricknells Close, Luton, LU3 3RP",
};
