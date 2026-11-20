import "server-only";
import { and, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityEvents, companies, notifications, printRuns } from "@/lib/db/schema";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";

/**
 * History is kept for 12 months (Figma "History": "Kept for 12 months"). Runs once a day after
 * the morning pull and deletes what is older:
 *  - print runs printed more than 12 months ago (their letters go with them);
 *  - companies incorporated more than 12 months ago, with their notes, activity and letters —
 *    except a company still waiting in the print queue;
 *  - activity events and notifications older than 12 months.
 * The Excluded list (do-not-contact) is never deleted, so nobody excluded is written to again.
 * HISTORY_RETENTION_MONTHS changes the period; 0 turns the clean-up off.
 */
export function retentionMonths() {
  const raw = process.env.HISTORY_RETENTION_MONTHS;
  if (raw === undefined || raw.trim() === "") return 12;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : 12;
}

export function retentionCutoff(months: number, now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

export async function purgeOldHistory(now = new Date()) {
  const months = retentionMonths();
  if (!months) return null;
  const cutoff = retentionCutoff(months, now);
  const cutoffDay = dateInTz(cutoff, UK_TZ);

  return db.transaction(async (tx) => {
    const runs = await tx
      .delete(printRuns)
      .where(sql`coalesce(${printRuns.printedAt}, ${printRuns.createdAt}) < ${cutoff}`)
      .returning({ id: printRuns.id });
    const old = await tx
      .delete(companies)
      .where(and(lt(companies.incorporatedOn, cutoffDay), notInArray(companies.letterState, ["added"])))
      .returning({ id: companies.id });
    const events = await tx.delete(activityEvents).where(lt(activityEvents.createdAt, cutoff)).returning({ id: activityEvents.id });
    const notes = await tx.delete(notifications).where(lt(notifications.createdAt, cutoff)).returning({ id: notifications.id });
    const result = { cutoffDay, printRuns: runs.length, companies: old.length, activity: events.length, notifications: notes.length };
    if (runs.length || old.length || events.length || notes.length) console.info("[history] retention clean-up", result);
    return result;
  });
}
