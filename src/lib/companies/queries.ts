import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityEvents, companies, exclusions, pulls, users } from "@/lib/db/schema";
import { addDays, dateInTz, UK_TZ } from "@/lib/pull/dates";
import { RULES } from "@/lib/pull/eligibility";
import { companyTypeLabel, formatAddress, formatCompanyName, formatDate, postingAddress, SIC_SECTIONS, sicLabel } from "./format";

/* ================================================================== */
/* Filters (all driven by the URL so views are linkable)               */
/* ================================================================== */

export const VIEWS = ["all", "not-reviewed", "in-run", "sent", "address-issue", "excluded", "skipped"] as const;
export type View = (typeof VIEWS)[number];

const VIEW_STATES: Record<Exclude<View, "all">, Array<typeof companies.$inferSelect.letterState>> = {
  "not-reviewed": ["not_reviewed"],
  "in-run": ["added"],
  sent: ["printed", "posted"],
  "address-issue": ["address_issue"],
  excluded: ["excluded"],
  skipped: ["skipped"],
};

export const INCORPORATED = ["since-last", "7d", "30d", "all"] as const;
export const TYPES = ["all", "ltd", "llp", "other"] as const;
export const LOCATIONS = ["all", "england", "wales", "scotland", "northern-ireland"] as const;
export const PER_PAGE = [25, 50, 100] as const;

export type FeedFilters = {
  view: View;
  q: string;
  inc: (typeof INCORPORATED)[number];
  type: (typeof TYPES)[number];
  sic: string; // "all" or section letter A–U
  loc: (typeof LOCATIONS)[number];
  page: number;
  per: number;
};

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

export function parseFeedFilters(sp: Record<string, string | string[] | undefined>): FeedFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const sic = one("sic");
  const per = Number(one("per"));
  return {
    view: pick(VIEWS, one("view"), "all"),
    q: (one("q") ?? "").trim().slice(0, 100),
    inc: pick(INCORPORATED, one("inc"), "since-last"),
    type: pick(TYPES, one("type"), "all"),
    sic: sic && SIC_SECTIONS.some((s) => s.key === sic) ? sic : "all",
    loc: pick(LOCATIONS, one("loc"), "all"),
    page: Math.max(1, Math.min(10_000, Math.floor(Number(one("page")) || 1))),
    per: (PER_PAGE as readonly number[]).includes(per) ? per : 50,
  };
}

async function sinceLastPullDate(): Promise<string | null> {
  const [last] = await db
    .select({ fromDate: pulls.fromDate })
    .from(pulls)
    .where(eq(pulls.status, "succeeded"))
    .orderBy(desc(pulls.finishedAt))
    .limit(1);
  return last?.fromDate ?? null;
}

/** Conditions shared by the list and the per-view counts (everything except the view). */
async function baseConditions(f: Omit<FeedFilters, "view" | "page" | "per">): Promise<SQL[]> {
  // Only companies the rules have already checked.
  const where: SQL[] = [isNotNull(companies.eligibility)];

  if (f.q) {
    const term = f.q.replace(/[%_\\]/g, (c) => `\\${c}`);
    const digits = f.q.replace(/\s+/g, "").toUpperCase();
    where.push(or(ilike(companies.name, `%${term}%`), ilike(companies.companyNumber, `${digits}%`))!);
  }

  const ukToday = dateInTz(new Date(), UK_TZ);
  if (f.inc === "since-last") {
    const from = await sinceLastPullDate();
    if (from) where.push(gte(companies.incorporatedOn, from));
  } else if (f.inc === "7d") where.push(gte(companies.incorporatedOn, addDays(ukToday, -7)));
  else if (f.inc === "30d") where.push(gte(companies.incorporatedOn, addDays(ukToday, -30)));

  if (f.type === "ltd" || f.type === "llp") where.push(eq(companies.companyType, f.type));
  else if (f.type === "other") where.push(sql`${companies.companyType} NOT IN ('ltd','llp')`);

  const section = SIC_SECTIONS.find((s) => s.key === f.sic);
  if (section) {
    where.push(sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(${companies.sicCodes}) AS s(code)
      WHERE s.code ~ '^[0-9]{5}$' AND substr(s.code, 1, 2)::int BETWEEN ${section.from} AND ${section.to})`);
  }

  if (f.loc !== "all") {
    const word = f.loc === "northern-ireland" ? "northern ireland" : f.loc;
    where.push(sql`(${companies.registeredOffice}->>'country') ILIKE ${`%${word}%`}`);
  }
  return where;
}

/* ================================================================== */
/* List                                                                */
/* ================================================================== */

export type FeedRow = {
  number: string;
  name: string;
  director: string;
  address: string;
  incorporated: string;
  sic: string;
  state: typeof companies.$inferSelect.letterState;
  skipReason: string | null;
  postingFixed: boolean;
  /** For the "Fix posting address" form. */
  fix: { registeredText: string; line1: string; line2: string; town: string; postcode: string };
};

export type FeedCounts = Record<View, number>;

export async function listCompanies(f: FeedFilters) {
  const base = await baseConditions(f);
  const viewWhere = f.view === "all" ? undefined : inArray(companies.letterState, VIEW_STATES[f.view]);

  const grouped = await db
    .select({ state: companies.letterState, n: count() })
    .from(companies)
    .where(and(...base))
    .groupBy(companies.letterState);

  const byState = new Map(grouped.map((g) => [g.state, g.n]));
  const sum = (states: string[]) => states.reduce((t, s) => t + (byState.get(s as never) ?? 0), 0);
  const counts = {
    all: grouped.reduce((t, g) => t + g.n, 0),
    ...Object.fromEntries(Object.entries(VIEW_STATES).map(([k, states]) => [k, sum(states)])),
  } as FeedCounts;

  const total = counts[f.view];
  const pages = Math.max(1, Math.ceil(total / f.per));
  const page = Math.min(f.page, pages);

  const rows = await db
    .select({
      number: companies.companyNumber,
      name: companies.name,
      director: companies.directorFullName,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
      incorporatedOn: companies.incorporatedOn,
      sicCodes: companies.sicCodes,
      state: companies.letterState,
      skipReason: companies.skipReason,
      officersFetched: companies.officersFetched,
    })
    .from(companies)
    .where(and(...base, viewWhere))
    .orderBy(desc(companies.incorporatedOn), desc(companies.companyNumber))
    .limit(f.per)
    .offset((page - 1) * f.per);

  return {
    counts,
    total,
    page,
    pages,
    rows: rows.map((r): FeedRow => {
      const post = postingAddress(r);
      const ro = r.registeredOffice;
      return {
        number: r.number,
        name: formatCompanyName(r.name),
        director: r.director ?? (r.officersFetched ? "No director listed" : "—"),
        address: formatAddress(post),
        incorporated: formatDate(r.incorporatedOn),
        sic: sicLabel(r.sicCodes[0]),
        state: r.state,
        skipReason: r.skipReason,
        postingFixed: r.postingAddress != null,
        fix: {
          registeredText: `${formatAddress(ro) || "no address"}${ro.postcode ? "" : " — postcode missing"}`,
          line1: post.line1 ?? "",
          line2: post.line2 ?? "",
          town: post.town ?? "",
          postcode: post.postcode ?? "",
        },
      };
    }),
  };
}

/** Numbers of every company matching the filters (for "Select all"), capped for safety. */
export async function matchingCompanyNumbers(f: FeedFilters, cap = 5000) {
  const base = await baseConditions(f);
  const viewWhere = f.view === "all" ? undefined : inArray(companies.letterState, VIEW_STATES[f.view]);
  const rows = await db
    .select({ n: companies.companyNumber })
    .from(companies)
    .where(and(...base, viewWhere))
    .limit(cap);
  return rows.map((r) => r.n);
}

/** Counts for the sidebar badges. */
export async function sidebarCounts() {
  const rows = await db
    .select({ state: companies.letterState, n: count() })
    .from(companies)
    .where(and(isNotNull(companies.eligibility), inArray(companies.letterState, ["not_reviewed", "added"])))
    .groupBy(companies.letterState);
  const get = (s: string) => rows.find((r) => r.state === s)?.n ?? 0;
  return { toReview: get("not_reviewed"), inRun: get("added") };
}

/* ================================================================== */
/* One company                                                         */
/* ================================================================== */

export async function getCompany(number: string) {
  if (!/^[A-Z0-9]{6,10}$/i.test(number)) return null;
  const [c] = await db.select().from(companies).where(eq(companies.companyNumber, number.toUpperCase())).limit(1);
  if (!c) return null;

  const [exclusion] = await db
    .select({ reason: exclusions.reason, createdAt: exclusions.createdAt })
    .from(exclusions)
    .where(eq(exclusions.companyNumber, c.companyNumber))
    .orderBy(desc(exclusions.createdAt))
    .limit(1);

  const posting = postingAddress(c);
  // Rule results are saved at pull time; reflect later changes made by the team.
  const live: Partial<Record<(typeof RULES)[number]["key"], boolean>> = {
    not_excluded: c.letterState !== "excluded",
    not_printed_before: c.letterState !== "printed" && c.letterState !== "posted",
    ...(c.postingAddress ? { address_complete: true } : {}),
  };
  const checks = RULES.map((r) => ({ key: r.key, label: r.label, passed: live[r.key] ?? c.eligibility?.[r.key] ?? false }));

  return {
    id: c.id,
    number: c.companyNumber,
    name: formatCompanyName(c.name),
    rawName: c.name,
    status: c.companyStatus,
    type: c.companyType,
    typeLabel: companyTypeLabel(c.companyType),
    incorporatedOn: c.incorporatedOn,
    incorporated: formatDate(c.incorporatedOn),
    sicCodes: c.sicCodes,
    registeredOffice: c.registeredOffice,
    registeredAddress: formatAddress(c.registeredOffice),
    postingAddress: c.postingAddress,
    posting,
    directorFirstName: c.directorFirstName,
    directorFullName: c.directorFullName,
    officersFetched: c.officersFetched,
    state: c.letterState,
    skipReason: c.skipReason,
    checks,
    passedCount: checks.filter((x) => x.passed).length,
    importedAt: c.importedAt,
    exclusion: exclusion ?? null,
  };
}

export type CompanyDetail = NonNullable<Awaited<ReturnType<typeof getCompany>>>;

/** Timeline for one company: import + rule check (from the record) and every logged action. */
export async function getCompanyActivity(c: CompanyDetail) {
  const logged = await db
    .select({
      kind: activityEvents.kind,
      title: activityEvents.title,
      detail: activityEvents.detail,
      at: activityEvents.createdAt,
      first: users.firstName,
      last: users.lastName,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorId, users.id))
    .where(eq(activityEvents.companyId, c.id))
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);

  const failed = c.checks.find((x) => !x.passed);
  const base = [
    { kind: "imported", title: "Company imported", detail: `Found in the Companies House pull`, at: c.importedAt },
    {
      kind: failed ? "rules_failed" : "rules_passed",
      title: failed ? "Letter check failed" : "Letter eligibility set",
      detail: failed ? `${failed.label} — no` : `Passed all ${c.checks.length} checks`,
      at: c.importedAt,
    },
  ];
  return [
    ...logged.map((e) => ({ kind: e.kind, title: e.title, detail: e.detail ?? (e.first ? `By ${e.first} ${e.last}` : null), at: e.at })),
    ...base,
  ];
}

export type ActivityItem = Awaited<ReturnType<typeof getCompanyActivity>>[number];
