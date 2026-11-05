import "server-only";
import { and, between, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { businessSettings, companies, exclusions, notifications, pulls, users } from "@/lib/db/schema";
import { getOfficers, searchIncorporations, type ChSearchCompany } from "@/lib/companies-house/client";
import { sendMail } from "@/lib/mail";
import { addDays, dateInTz, daysBetween, formatSaTime, todaysScheduleStart, UK_TZ } from "./dates";
import { evaluate, normLine, pickDirector, SHARED_ADDRESS_THRESHOLD, toAddress, type RuleContext } from "./eligibility";

/** Postgres advisory-lock id — only one pull may run at a time, across all processes. */
const LOCK_ID = 4_310_001;
/** Never look back further than this many days in one catch-up. */
const MAX_CATCHUP_DAYS = 14;
/** Look-back window used to spot formation agents / virtual offices. */
const SHARED_LOOKBACK_DAYS = 14;
/** After a failure, wait this long before the scheduler tries again. */
export const RETRY_AFTER_MS = 30 * 60 * 1000;
/** Email the team once this many attempts have failed on one day. */
const EMAIL_AFTER_ATTEMPTS = 3;
/** Give up for the day after this many attempts (≈ 6 hours of retries). */
const MAX_ATTEMPTS_PER_DAY = 12;
const OFFICER_WORKERS = 3;
/**
 * Testing only: cap how many companies one pull brings in (e.g. PULL_LIMIT=15),
 * so a test run uses ~20 API requests instead of ~3,000. Leave unset in production.
 */
const PULL_LIMIT = Number(process.env.PULL_LIMIT) > 0 ? Math.floor(Number(process.env.PULL_LIMIT)) : null;

export type PullTrigger = "schedule" | "retry" | "manual";

/* ================================================================== */
/* Entry points                                                        */
/* ================================================================== */

/**
 * Called by the scheduler (in-process timer, `npm run pull`, or the cron route).
 * Decides whether a pull is due and runs it. Safe to call as often as you like.
 */
export async function runScheduledPull(now = new Date()) {
  const due = await isPullDue(now);
  if (!due.due) return { ran: false as const, reason: due.reason };
  const started = await startPull({ trigger: due.trigger, wait: true, now });
  return { ran: started.status === "started", reason: started.status, pullId: started.pullId };
}

/**
 * Start a pull now. With `wait: false` it returns as soon as the pull row
 * exists and keeps running in the background (for the "Run pull now" button).
 */
export async function startPull(opts: { trigger: PullTrigger; userId?: string; wait?: boolean; now?: Date }) {
  const client = await pool.connect();
  let locked = false;
  try {
    const res = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_ID]);
    locked = res.rows[0]?.ok === true;
    if (!locked) {
      client.release();
      return { status: "busy" as const };
    }

    // We hold the lock, so any pull still marked "running" was interrupted (crash / restart).
    await db
      .update(pulls)
      .set({ status: "failed", error: "Interrupted — the server stopped while the pull was running.", finishedAt: new Date() })
      .where(eq(pulls.status, "running"));

    const now = opts.now ?? new Date();
    const window = await pullWindow(opts.trigger, now);
    const attempt = (await failedAttemptsToday(now)) + 1;

    const [row] = await db
      .insert(pulls)
      .values({
        status: "running",
        trigger: opts.trigger,
        stage: "fetch",
        fromDate: window.from,
        toDate: window.to,
        pagesTotal: daysBetween(window.from, window.to).length,
        attempt,
        retries: attempt - 1,
        startedBy: opts.userId ?? null,
      })
      .returning({ id: pulls.id });

    const job = executePull(row.id, window, attempt)
      .catch((e) => console.error("[pull] crashed", e))
      .finally(async () => {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
        client.release();
      });

    if (opts.wait) await job;
    return { status: "started" as const, pullId: row.id };
  } catch (e) {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
    throw e;
  }
}

/* ================================================================== */
/* Scheduling decisions                                                */
/* ================================================================== */

async function failedAttemptsToday(now: Date) {
  const [r] = await db
    .select({ n: count() })
    .from(pulls)
    .where(and(eq(pulls.status, "failed"), gte(pulls.startedAt, todaysScheduleStart(now)), sql`${pulls.trigger} <> 'manual'`));
  return r?.n ?? 0;
}

export async function isPullDue(now: Date): Promise<{ due: true; trigger: PullTrigger } | { due: false; reason: string }> {
  const scheduleStart = todaysScheduleStart(now);
  if (now < scheduleStart) return { due: false, reason: "before 06:00 South Africa time" };

  const recent = await db
    .select({ status: pulls.status, trigger: pulls.trigger, finishedAt: pulls.finishedAt })
    .from(pulls)
    .where(gte(pulls.startedAt, scheduleStart))
    .orderBy(desc(pulls.startedAt));

  if (recent.some((p) => p.status === "succeeded")) return { due: false, reason: "already pulled today" };
  // A row marked "running" is not trusted here: startPull() takes the advisory lock, so a
  // live pull answers "busy", and a dead one (crash/restart) is marked failed and replaced.

  const failed = recent.filter((p) => p.status === "failed" && p.trigger !== "manual");
  if (failed.length >= MAX_ATTEMPTS_PER_DAY) return { due: false, reason: "too many failed attempts today" };
  const lastFail = failed[0]?.finishedAt;
  if (lastFail && now.getTime() - lastFail.getTime() < RETRY_AFTER_MS) return { due: false, reason: "waiting to retry" };

  return { due: true, trigger: failed.length ? "retry" : "schedule" };
}

/**
 * Which incorporation dates to fetch. Starts from the last successful pull's
 * end date (one day of overlap catches late-indexed companies) and goes up to
 * yesterday (UK) for scheduled pulls, or today for a manual "Run pull now".
 */
async function pullWindow(trigger: PullTrigger, now: Date) {
  const ukToday = dateInTz(now, UK_TZ);
  const to = trigger === "manual" ? ukToday : addDays(ukToday, -1);
  const [last] = await db
    .select({ toDate: pulls.toDate })
    .from(pulls)
    .where(eq(pulls.status, "succeeded"))
    .orderBy(desc(pulls.finishedAt))
    .limit(1);
  let from = last?.toDate ?? addDays(ukToday, -1);
  if (from > to) from = to;
  const earliest = addDays(to, -(MAX_CATCHUP_DAYS - 1));
  if (from < earliest) from = earliest;
  return { from, to };
}

/* ================================================================== */
/* The pull                                                            */
/* ================================================================== */

async function executePull(pullId: string, window: { from: string; to: string }, attempt: number) {
  const progress = (set: Partial<typeof pulls.$inferInsert>) =>
    db.update(pulls).set({ ...set, heartbeatAt: new Date() }).where(eq(pulls.id, pullId));

  try {
    /* 1 · Fetch incorporations, day by day, page by page ------------ */
    const days = daysBetween(window.from, window.to);
    let pagesTotal = days.length;
    let pagesDone = 0;
    let found = 0;
    let added = 0;
    let remaining = PULL_LIMIT ?? Infinity;
    if (PULL_LIMIT) console.info(`[pull] test mode — PULL_LIMIT=${PULL_LIMIT}, only the first ${PULL_LIMIT} companies are imported`);
    for (const day of days) {
      if (remaining <= 0) break;
      let start = 0;
      for (;;) {
        const page = await searchIncorporations(day, day, start, Number.isFinite(remaining) ? remaining : undefined);
        const items = page.items.slice(0, Number.isFinite(remaining) ? remaining : undefined);
        found += items.length;
        added += await insertCompanies(items, pullId);
        remaining -= items.length;
        pagesDone++;
        start += page.items.length;
        const more = page.items.length > 0 && start < page.hits && remaining > 0;
        if (more) pagesTotal++;
        await progress({ pagesDone, pagesTotal, companiesFound: found, companiesNew: added });
        if (!more) break;
      }
    }

    /* 2 · Apply the selection rules ---------------------------------- */
    await progress({ stage: "rules" });
    await applyRules(window, pullId);

    /* 3 · Director names for companies that may get a letter --------- */
    const todo = await db
      .select({ id: companies.id, number: companies.companyNumber })
      .from(companies)
      .where(
        and(
          between(companies.incorporatedOn, window.from, window.to),
          inArray(companies.letterState, ["not_reviewed", "address_issue"]),
          eq(companies.officersFetched, false),
          PULL_LIMIT ? eq(companies.pullId, pullId) : undefined,
        ),
      );
    await progress({ stage: "officers", officersTotal: todo.length, officersDone: 0 });

    let done = 0;
    const queue = [...todo];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const director = pickDirector(await getOfficers(item.number));
        await db
          .update(companies)
          .set({
            directorFirstName: director?.firstName || null,
            directorFullName: director?.fullName || null,
            officersFetched: true,
          })
          .where(eq(companies.id, item.id));
        done++;
        if (done % 20 === 0) await progress({ officersDone: done });
      }
    };
    await Promise.all(Array.from({ length: OFFICER_WORKERS }, worker));

    /* 4 · Done -------------------------------------------------------- */
    const [ready] = await db
      .select({ n: count() })
      .from(companies)
      .where(and(between(companies.incorporatedOn, window.from, window.to), eq(companies.letterState, "not_reviewed")));
    const [issues] = await db
      .select({ n: count() })
      .from(companies)
      .where(and(between(companies.incorporatedOn, window.from, window.to), eq(companies.letterState, "address_issue")));

    const finishedAt = new Date();
    await progress({ stage: "done", status: "succeeded", officersDone: done, companiesEligible: ready?.n ?? 0, finishedAt, error: null });

    const at = formatSaTime(finishedAt);
    await db.insert(notifications).values([
      { kind: "pull_complete", title: "Morning pull complete", detail: `${(ready?.n ?? 0).toLocaleString("en-GB")} companies ready · ${at}` },
      ...((issues?.n ?? 0) > 0
        ? [{ kind: "address_issues", title: `${issues!.n} address issues`, detail: `Fix before printing today’s run · ${at}` }]
        : []),
    ]);
    console.info(`[pull] ${pullId} ok · ${window.from}→${window.to} · found ${found}, new ${added}, ready ${ready?.n ?? 0}`);
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(`[pull] ${pullId} failed (attempt ${attempt}):`, message);
    await progress({ status: "failed", error: message, finishedAt: new Date() });
    if (attempt >= EMAIL_AFTER_ATTEMPTS) await notifyFailure(pullId, attempt, message);
  }
}

/** Insert new companies; existing company numbers are left untouched. Returns how many were new. */
async function insertCompanies(items: ChSearchCompany[], pullId: string) {
  let added = 0;
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    const rows = await db
      .insert(companies)
      .values(
        chunk.map((c) => ({
          companyNumber: c.company_number,
          name: c.company_name,
          companyType: c.company_type,
          companyStatus: c.company_status,
          incorporatedOn: c.date_of_creation,
          sicCodes: c.sic_codes ?? [],
          registeredOffice: toAddress(c.registered_office_address),
          pullId,
          raw: c,
        })),
      )
      .onConflictDoNothing({ target: companies.companyNumber })
      .returning({ id: companies.id });
    added += rows.length;
  }
  return added;
}

/** Evaluate the 7 rules for every company in the window that hasn't been checked yet. */
async function applyRules(window: { from: string; to: string }, pullId: string) {
  const pending = await db
    .select({
      id: companies.id,
      number: companies.companyNumber,
      name: companies.name,
      type: companies.companyType,
      address: companies.registeredOffice,
    })
    .from(companies)
    .where(and(between(companies.incorporatedOn, window.from, window.to), isNull(companies.eligibility)));
  if (pending.length === 0) return;

  const ctx = await buildRuleContext(window, pending.map((p) => p.number));

  for (let i = 0; i < pending.length; i += 500) {
    const chunk = pending.slice(i, i + 500).map((p) => {
      const r = evaluate({ companyNumber: p.number, name: p.name, companyType: p.type, address: p.address }, ctx);
      return { id: p.id, ...r };
    });
    const values = sql.join(
      chunk.map((r) => sql`(${r.id}::uuid, ${r.state}::letter_state, ${JSON.stringify(r.eligibility)}::jsonb, ${r.skipReason})`),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE companies AS c
      SET letter_state = v.state, eligibility = v.elig, skip_reason = v.reason, pull_id = ${pullId}::uuid, updated_at = now()
      FROM (VALUES ${values}) AS v(id, state, elig, reason)
      WHERE c.id = v.id`);
  }
}

async function buildRuleContext(window: { from: string; to: string }, numbers: string[]): Promise<RuleContext> {
  // Own office — parsed from "18 Thricknells Close, Luton, LU3 3RP".
  const [biz] = await db.select({ address: businessSettings.addressLine }).from(businessSettings).limit(1);
  let ownOffice: RuleContext["ownOffice"] = null;
  if (biz?.address) {
    const parts = biz.address.split(",").map((s) => s.trim());
    const postcode = parts.find((p) => /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(p));
    if (parts[0] && postcode) ownOffice = { line1: parts[0], postcode };
  }

  // Addresses shared by many companies recently ⇒ agents / virtual offices.
  const shared = await db.execute<{ k: string; n: number }>(sql`
    SELECT upper(trim(regexp_replace(regexp_replace(coalesce(registered_office->>'line1',''), '[.,]', ' ', 'g'), '[[:space:]]+', ' ', 'g')))
           || '|' || upper(regexp_replace(coalesce(registered_office->>'postcode',''), '[[:space:]]+', '', 'g')) AS k,
           count(*)::int AS n
    FROM companies
    WHERE incorporated_on >= ${addDays(window.to, -SHARED_LOOKBACK_DAYS)}::date
    GROUP BY 1
    HAVING count(*) >= ${SHARED_ADDRESS_THRESHOLD}`);
  const sharedCounts = new Map(shared.rows.map((r) => [r.k, Number(r.n)]));

  const ex = await db.select({ number: exclusions.companyNumber, name: exclusions.companyName }).from(exclusions);
  const printed = numbers.length
    ? await db
        .select({ number: companies.companyNumber })
        .from(companies)
        .where(and(inArray(companies.letterState, ["printed", "posted"]), inArray(companies.companyNumber, numbers)))
    : [];

  return {
    ownOffice,
    sharedCounts,
    excludedNumbers: new Set(ex.map((e) => e.number).filter((n): n is string => Boolean(n))),
    excludedNames: new Set(ex.map((e) => (e.name ? normLine(e.name) : "")).filter(Boolean)),
    printedNumbers: new Set(printed.map((p) => p.number)),
  };
}

/** Email everyone who asked for it, once per day, and add an in-app notification. */
async function notifyFailure(pullId: string, attempt: number, message: string) {
  const [already] = await db
    .select({ n: count() })
    .from(pulls)
    .where(and(gte(pulls.startedAt, todaysScheduleStart(new Date())), sql`${pulls.failureEmailedAt} IS NOT NULL`));
  if ((already?.n ?? 0) > 0) return;

  const recipients = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(and(eq(users.status, "active"), eq(users.emailOnPullFailure, true)));

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  for (const r of recipients) {
    await sendMail({
      to: r.email,
      subject: "Today’s Companies House pull didn’t finish",
      text: `Hi ${r.firstName},\n\nThe 06:00 pull from Companies House has failed ${attempt} times today.\nNo letters are affected — missed days are caught up automatically, and it keeps retrying every 30 minutes.\n\nLast error: ${message}\n\nOpen New Companies to retry now: ${base}/new-companies?modal=pull-failed`,
    });
  }
  await db.update(pulls).set({ failureEmailedAt: new Date() }).where(eq(pulls.id, pullId));
  await db.insert(notifications).values({
    kind: "pull_failed",
    title: "Today’s pull didn’t finish",
    detail: `${attempt} attempts failed · retrying every 30 minutes`,
  });
}
