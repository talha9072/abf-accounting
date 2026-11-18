import "server-only";
import { and, asc, count, desc, eq, exists, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, exclusions, printRunItems, printRuns, users, type LetterSnapshot } from "@/lib/db/schema";
import { cache } from "react";
import { formatAddress, formatCompanyName, formatDate, postingAddress } from "@/lib/companies/format";
import { buildLetterSnapshot, getBusiness, getPrintableTemplate, renderLetter } from "@/lib/letters/data";
import { dateInTz, formatSaTime, SCHEDULE_TZ, UK_TZ } from "@/lib/pull/dates";
import { MAX_RUN_LETTERS } from "./limits";

const who = (first: string | null, last: string | null) => (first ? `${first} ${last ?? ""}`.trim() : "—");

/** Calendar day in SA time (where the team works), e.g. "8 Nov 2026". */
const saDay = (d: Date) => formatDate(dateInTz(d, SCHEDULE_TZ));

function runWhen(d: Date | null) {
  if (!d) return "—";
  return `${saDay(d)} · ${formatSaTime(d)}`;
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
    .limit(MAX_RUN_LETTERS);

  const [[issues], [all]] = await Promise.all([
    db.select({ n: count() }).from(companies).where(eq(companies.letterState, "address_issue")),
    db.select({ n: count() }).from(companies).where(eq(companies.letterState, "added")),
  ]);
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
    /** Everyone in the print run; `rows` is the next batch (at most MAX_RUN_LETTERS). */
    total: all?.n ?? 0,
    incorporatedLabel:
      incorporated.length === 0
        ? "—"
        : incorporated.length === 1
          ? `incorporated ${formatDate(incorporated[0])}`
          : `incorporated ${formatDate(incorporated[0])} – ${formatDate(incorporated[incorporated.length - 1])}`,
  };
}

/**
 * The live print queue merged with a template and dated today — what
 * "Print N letters" would freeze, but nothing is recorded. Used by the
 * preview and by the non-committing "Download PDF" document.
 */
export async function getQueueLetters(templateId: string | null, limit = MAX_RUN_LETTERS) {
  const [template, business] = await Promise.all([getPrintableTemplate(templateId), getBusiness()]);
  const today = dateInTz(new Date(), UK_TZ);
  const rows = await db
    .select({
      name: companies.name,
      companyNumber: companies.companyNumber,
      directorFirstName: companies.directorFirstName,
      directorFullName: companies.directorFullName,
      incorporatedOn: companies.incorporatedOn,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
    })
    .from(companies)
    .where(eq(companies.letterState, "added"))
    .orderBy(asc(companies.incorporatedOn), asc(companies.companyNumber))
    .limit(MAX_RUN_LETTERS);
  const letters = await Promise.all(rows.slice(0, limit).map((c) => renderLetter(buildLetterSnapshot(c, template, business, today), business)));
  return { template, letters, total: rows.length };
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
    printedDay: r.printedAt ? saDay(r.printedAt) : "—",
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

/** `%term%` for ILIKE, with the user's own % _ \ escaped. */
const contains = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const numberPrefix = (q: string) => `${q.replace(/\s+/g, "").replace(/[%_\\]/g, (c) => `\\${c}`).toUpperCase()}%`;

/** Runs matching a reference (PR-0811-01), template name, or a company name / number inside the run. */
function runSearch(q: string) {
  if (!q) return undefined;
  const inRun = db
    .select({ one: sql`1` })
    .from(printRunItems)
    .innerJoin(companies, eq(printRunItems.companyId, companies.id))
    .where(and(eq(printRunItems.printRunId, printRuns.id), or(ilike(companies.name, contains(q)), ilike(companies.companyNumber, numberPrefix(q)))));
  return or(ilike(printRuns.reference, contains(q)), ilike(printRuns.templateName, contains(q)), exists(inRun));
}

export async function listRuns(limit = 50, offset = 0, q = "") {
  const rows = await db
    .select(runSelect)
    .from(printRuns)
    .leftJoin(users, eq(printRuns.printedBy, users.id))
    .where(and(sql`${printRuns.status} <> 'cancelled'`, runSearch(q)))
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

/** Tab counters — while searching they count only what matches, like the tables. */
export async function historyCounts(q = "") {
  const [states, [runs]] = await Promise.all([
    db
      .select({ s: companies.letterState, n: count() })
      .from(companies)
      .where(and(isNotNull(companies.eligibility), search(q)))
      .groupBy(companies.letterState),
    db
      .select({ n: count() })
      .from(printRuns)
      .where(and(sql`${printRuns.status} <> 'cancelled'`, runSearch(q))),
  ]);
  const get = (...s: string[]) => states.filter((x) => s.includes(x.s)).reduce((t, x) => t + x.n, 0);
  return {
    sent: get("posted", "printed"),
    excluded: get("excluded"),
    notSent: get("not_reviewed", "added", "address_issue", "skipped"),
    printRuns: runs?.n ?? 0,
  };
}

function search(q: string) {
  if (!q) return undefined;
  return or(ilike(companies.name, contains(q)), ilike(companies.companyNumber, numberPrefix(q)));
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
      position: printRunItems.position,
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
    sentOn: r.printedAt ? saDay(r.printedAt) : "—",
    runId: r.runId,
    position: r.position,
    printRun: r.reference,
    printedBy: who(r.first, r.last),
    confirmed: r.state === "posted",
  }));
}

export async function historyExcluded(q: string, limit = 50, offset = 0) {
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
    .where(q ? or(ilike(exclusions.companyName, contains(q)), ilike(exclusions.companyNumber, numberPrefix(q))) : undefined)
    .orderBy(desc(exclusions.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    number: r.number ?? "",
    name: formatCompanyName(r.name ?? r.number ?? ""),
    reason: r.reason ?? "—",
    by: who(r.first, r.last),
    date: saDay(r.at),
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

/* ------------------------------------------------------------------ */
/* One company's letters                                               */
/* ------------------------------------------------------------------ */

export type CompanyLetter = {
  runId: string;
  runReference: string;
  /** printed · confirmed · cancelled */
  status: string;
  template: string;
  position: number;
  reference: string;
  printedBy: string;
  printedAt: string;
  printedDay: string;
  confirmedAt: string | null;
  confirmedDay: string | null;
  cancelledDay: string | null;
  letter: LetterSnapshot | null;
};

/** Every print run this company was in, newest first (shared by the layout and tabs per request). */
export const companyLetters = cache(async (companyId: string): Promise<CompanyLetter[]> => {
  const rows = await db
    .select({
      runId: printRuns.id,
      runReference: printRuns.reference,
      status: printRuns.status,
      template: printRuns.templateName,
      printedAt: printRuns.printedAt,
      confirmedAt: printRuns.confirmedAt,
      cancelledAt: printRuns.cancelledAt,
      createdAt: printRuns.createdAt,
      position: printRunItems.position,
      reference: printRunItems.reference,
      letter: printRunItems.letter,
      first: users.firstName,
      last: users.lastName,
    })
    .from(printRunItems)
    .innerJoin(printRuns, eq(printRunItems.printRunId, printRuns.id))
    .leftJoin(users, eq(printRuns.printedBy, users.id))
    .where(eq(printRunItems.companyId, companyId))
    .orderBy(desc(printRuns.createdAt))
    .limit(50);
  return rows.map((r) => ({
    runId: r.runId,
    runReference: r.runReference,
    status: r.status,
    template: r.template ?? "—",
    position: r.position,
    reference: r.reference,
    printedBy: who(r.first, r.last),
    printedAt: runWhen(r.printedAt ?? r.createdAt),
    printedDay: saDay(r.printedAt ?? r.createdAt),
    confirmedAt: r.confirmedAt ? runWhen(r.confirmedAt) : null,
    confirmedDay: r.confirmedAt ? saDay(r.confirmedAt) : null,
    cancelledDay: r.cancelledAt ? saDay(r.cancelledAt) : null,
    letter: r.letter,
  }));
});
