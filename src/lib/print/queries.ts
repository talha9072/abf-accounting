import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, exclusions, printRunItems, printRuns, users } from "@/lib/db/schema";
import { formatAddress, formatCompanyName, formatDate, postingAddress } from "@/lib/companies/format";
import { formatSaTime } from "@/lib/pull/dates";

const who = (first: string | null, last: string | null) => (first ? `${first} ${last ?? ""}`.trim() : "—");

function runWhen(d: Date | null) {
  if (!d) return "—";
  return `${formatDate(d.toISOString())} · ${formatSaTime(d)}`;
}

/* ------------------------------------------------------------------ */
/* Print queue                                                         */
/* ------------------------------------------------------------------ */

export type QueueRow = {
  number: string;
  name: string;
  director: string;
  address: string;
  incorporated: string;
  noDirector: boolean;
};

/** Companies "Added to print run" — the next batch of letters. */
export async function getPrintQueue() {
  const rows = await db
    .select({
      number: companies.companyNumber,
      name: companies.name,
      director: companies.directorFullName,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
      incorporatedOn: companies.incorporatedOn,
    })
    .from(companies)
    .where(eq(companies.letterState, "added"))
    .orderBy(asc(companies.incorporatedOn), asc(companies.companyNumber))
    .limit(1000);

  const [issues] = await db.select({ n: count() }).from(companies).where(eq(companies.letterState, "address_issue"));
  const incorporated = [...new Set(rows.map((r) => r.incorporatedOn))];

  return {
    rows: rows.map(
      (r): QueueRow => ({
        number: r.number,
        name: formatCompanyName(r.name),
        director: r.director ?? "No director — “To whom it may concern”",
        address: formatAddress(postingAddress(r)),
        incorporated: formatDate(r.incorporatedOn),
        noDirector: !r.director,
      }),
    ),
    addressIssues: issues?.n ?? 0,
    incorporatedLabel:
      incorporated.length === 0
        ? "—"
        : incorporated.length === 1
          ? `incorporated ${formatDate(incorporated[0])}`
          : `incorporated ${formatDate(incorporated[0])} – ${formatDate(incorporated[incorporated.length - 1])}`,
  };
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export type RunSummary = {
  id: string;
  reference: string;
  status: string;
  letters: number;
  template: string;
  printedBy: string;
  printedAt: string;
  printedDay: string;
  confirmedAt: string | null;
  labelsPrinted: boolean;
};

const runSelect = {
  id: printRuns.id,
  reference: printRuns.reference,
  status: printRuns.status,
  letters: printRuns.letterCount,
  template: printRuns.templateName,
  printedAt: printRuns.printedAt,
  confirmedAt: printRuns.confirmedAt,
  labelsPrintedAt: printRuns.labelsPrintedAt,
  first: users.firstName,
  last: users.lastName,
};

function toRunSummary(r: {
  id: string;
  reference: string;
  status: string;
  letters: number;
  template: string | null;
  printedAt: Date | null;
  confirmedAt: Date | null;
  labelsPrintedAt: Date | null;
  first: string | null;
  last: string | null;
}): RunSummary {
  return {
    id: r.id,
    reference: r.reference,
    status: r.status,
    letters: r.letters,
    template: r.template ?? "—",
    printedBy: who(r.first, r.last),
    printedAt: runWhen(r.printedAt),
    printedDay: r.printedAt ? formatDate(r.printedAt.toISOString()) : "—",
    confirmedAt: r.confirmedAt ? runWhen(r.confirmedAt) : null,
    labelsPrinted: Boolean(r.labelsPrintedAt),
  };
}

/** Printed but not confirmed yet — shown as a banner so they're never forgotten. */
export async function getOpenRuns() {
  const rows = await db
    .select(runSelect)
    .from(printRuns)
    .leftJoin(users, eq(printRuns.printedBy, users.id))
    .where(eq(printRuns.status, "printed"))
    .orderBy(desc(printRuns.printedAt));
  return rows.map(toRunSummary);
}

export async function listRuns(limit = 50, offset = 0) {
  const rows = await db
    .select(runSelect)
    .from(printRuns)
    .leftJoin(users, eq(printRuns.printedBy, users.id))
    .where(sql`${printRuns.status} <> 'cancelled'`)
    .orderBy(desc(printRuns.printedAt))
    .limit(limit)
    .offset(offset);
  return rows.map(toRunSummary);
}

export async function getRun(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [run] = await db.select(runSelect).from(printRuns).leftJoin(users, eq(printRuns.printedBy, users.id)).where(eq(printRuns.id, id)).limit(1);
  if (!run) return null;
  const items = await db
    .select({
      position: printRunItems.position,
      reference: printRunItems.reference,
      address: printRunItems.addressSnapshot,
      letter: printRunItems.letter,
      number: companies.companyNumber,
      state: companies.letterState,
    })
    .from(printRunItems)
    .innerJoin(companies, eq(printRunItems.companyId, companies.id))
    .where(eq(printRunItems.printRunId, id))
    .orderBy(asc(printRunItems.position));
  return { ...toRunSummary(run), items };
}

export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRun>>>;

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export async function historyCounts() {
  const states = await db.select({ s: companies.letterState, n: count() }).from(companies).where(isNotNull(companies.eligibility)).groupBy(companies.letterState);
  const get = (...s: string[]) => states.filter((x) => s.includes(x.s)).reduce((t, x) => t + x.n, 0);
  const [runs] = await db.select({ n: count() }).from(printRuns).where(sql`${printRuns.status} <> 'cancelled'`);
  return {
    sent: get("posted", "printed"),
    excluded: get("excluded"),
    notSent: get("not_reviewed", "added", "address_issue", "skipped"),
    printRuns: runs?.n ?? 0,
  };
}

function search(q: string) {
  if (!q) return undefined;
  const term = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  return or(ilike(companies.name, `%${term}%`), ilike(companies.companyNumber, `${q.replace(/\s+/g, "").toUpperCase()}%`));
}

export async function historySent(q: string, limit = 50, offset = 0) {
  const rows = await db
    .select({
      number: companies.companyNumber,
      name: companies.name,
      state: companies.letterState,
      director: companies.directorFullName,
      address: printRunItems.addressSnapshot,
      runId: printRuns.id,
      reference: printRuns.reference,
      printedAt: printRuns.printedAt,
      first: users.firstName,
      last: users.lastName,
    })
    .from(printRunItems)
    .innerJoin(printRuns, eq(printRunItems.printRunId, printRuns.id))
    .innerJoin(companies, eq(printRunItems.companyId, companies.id))
    .leftJoin(users, eq(printRuns.printedBy, users.id))
    .where(and(sql`${printRuns.status} <> 'cancelled'`, inArray(companies.letterState, ["printed", "posted"]), search(q)))
    .orderBy(desc(printRuns.printedAt), asc(printRunItems.position))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    number: r.number,
    name: formatCompanyName(r.name),
    director: r.director ?? "—",
    address: formatAddress(r.address),
    sentOn: r.printedAt ? formatDate(r.printedAt.toISOString()) : "—",
    runId: r.runId,
    printRun: r.reference,
    printedBy: who(r.first, r.last),
    confirmed: r.state === "posted",
  }));
}

export async function historyExcluded(q: string, limit = 50, offset = 0) {
  const term = q ? q.replace(/[%_\\]/g, (c) => `\\${c}`) : "";
  const rows = await db
    .select({
      number: exclusions.companyNumber,
      name: exclusions.companyName,
      reason: exclusions.reason,
      at: exclusions.createdAt,
      first: users.firstName,
      last: users.lastName,
    })
    .from(exclusions)
    .leftJoin(users, eq(exclusions.createdBy, users.id))
    .where(q ? or(ilike(exclusions.companyName, `%${term}%`), ilike(exclusions.companyNumber, `${q.toUpperCase()}%`)) : undefined)
    .orderBy(desc(exclusions.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    number: r.number ?? "",
    name: formatCompanyName(r.name ?? r.number ?? ""),
    reason: r.reason ?? "—",
    by: who(r.first, r.last),
    date: formatDate(r.at.toISOString()),
  }));
}

export async function historyNotSent(q: string, limit = 50, offset = 0) {
  const rows = await db
    .select({
      number: companies.companyNumber,
      name: companies.name,
      director: companies.directorFullName,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
      incorporatedOn: companies.incorporatedOn,
      state: companies.letterState,
      skipReason: companies.skipReason,
    })
    .from(companies)
    .where(and(isNotNull(companies.eligibility), inArray(companies.letterState, ["not_reviewed", "added", "address_issue", "skipped"]), search(q)))
    .orderBy(desc(companies.incorporatedOn), desc(companies.companyNumber))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    number: r.number,
    name: formatCompanyName(r.name),
    director: r.director ?? "—",
    address: formatAddress(postingAddress(r)),
    incorporated: formatDate(r.incorporatedOn),
    state: r.state,
    skipReason: r.skipReason,
  }));
}
