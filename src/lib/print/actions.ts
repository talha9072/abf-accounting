"use server";

import { and, count, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activityEvents, companies, printRunItems, printRuns } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";
import { buildLetterSnapshot, getBusiness, getPrintableTemplate } from "@/lib/letters/data";
import { dateInTz, UK_TZ } from "@/lib/pull/dates";

export type RunResult = { ok: true; runId: string; reference: string; letters: number } | { ok: false; message: string };
export type SimpleResult = { ok: true; count: number } | { ok: false; message: string };

const uuid = z.string().uuid();
const MAX_LETTERS = 500;

async function auth() {
  return (await getCurrentSession())?.user ?? null;
}

/** "PR-0811-01": day + month + run number that day. */
async function nextReference(now: Date) {
  const day = dateInTz(now, UK_TZ); // YYYY-MM-DD
  const base = `PR-${day.slice(8, 10)}${day.slice(5, 7)}`;
  const [r] = await db.select({ n: count() }).from(printRuns).where(gte(printRuns.createdAt, new Date(`${day}T00:00:00Z`)));
  return { base, seq: (r?.n ?? 0) + 1 };
}

/**
 * Create a print run from every company currently "Added to print run":
 * freezes each merged letter, marks the companies "Printed" (so they can't
 * be printed twice) and returns the run to open the print document.
 */
export async function createRunAction(input: { templateId?: string | null }): Promise<RunResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };

  const queue = await db
    .select({
      id: companies.id,
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
    .orderBy(companies.incorporatedOn, companies.companyNumber)
    .limit(MAX_LETTERS);
  if (queue.length === 0) return { ok: false, message: "No companies in the print run. Add some on New Companies first." };

  const tpl = await getPrintableTemplate(input.templateId && uuid.safeParse(input.templateId).success ? input.templateId : null);
  const business = await getBusiness();
  const now = new Date();
  const letterDate = dateInTz(now, UK_TZ);
  const { base, seq } = await nextReference(now);

  try {
    const result = await db.transaction(async (tx) => {
      let reference = `${base}-${String(seq).padStart(2, "0")}`;
      for (let i = 1; ; i++) {
        const [clash] = await tx.select({ id: printRuns.id }).from(printRuns).where(eq(printRuns.reference, reference)).limit(1);
        if (!clash) break;
        reference = `${base}-${String(seq + i).padStart(2, "0")}`;
      }

      // Lock the rows and re-check they are still "added" (two people printing at once).
      const ids = queue.map((q) => q.id);
      const locked = await tx
        .update(companies)
        .set({ letterState: "printed", updatedAt: now })
        .where(and(inArray(companies.id, ids), eq(companies.letterState, "added")))
        .returning({ id: companies.id });
      const lockedIds = new Set(locked.map((l) => l.id));
      const batch = queue.filter((q) => lockedIds.has(q.id));
      if (batch.length === 0) throw new Error("Those companies were just printed by someone else.");

      const [run] = await tx
        .insert(printRuns)
        .values({
          reference,
          templateVersionId: tpl.versionId,
          templateName: `${tpl.name}`,
          status: "printed",
          letterCount: batch.length,
          printedBy: user.id,
          printedAt: now,
        })
        .returning({ id: printRuns.id });

      await tx.insert(printRunItems).values(
        batch.map((c, i) => {
          const letter = buildLetterSnapshot(c, tpl, business, letterDate);
          return {
            printRunId: run.id,
            companyId: c.id,
            position: i + 1,
            reference: `${business.prefix}${c.companyNumber}`,
            addressSnapshot: c.postingAddress ?? c.registeredOffice,
            letter,
          };
        }),
      );
      await tx.insert(activityEvents).values(
        batch.map((c, i) => ({
          companyId: c.id,
          actorId: user.id,
          kind: "printed",
          title: "Letter printed",
          detail: `${reference} · letter ${i + 1} of ${batch.length} · ${tpl.name}`,
        })),
      );
      return { runId: run.id, reference, letters: batch.length };
    });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t create the print run." };
  }
}

/** "Yes — mark sent": letters are in the post. Companies become "Sent". */
export async function confirmRunAction(runId: string): Promise<SimpleResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(runId).success) return { ok: false, message: "Unknown print run." };

  const rows = await db.transaction(async (tx) => {
    const [run] = await tx
      .update(printRuns)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(and(eq(printRuns.id, runId), eq(printRuns.status, "printed")))
      .returning({ reference: printRuns.reference });
    if (!run) return [];
    const ids = tx.select({ id: printRunItems.companyId }).from(printRunItems).where(eq(printRunItems.printRunId, runId));
    const updated = await tx
      .update(companies)
      .set({ letterState: "posted", updatedAt: new Date() })
      .where(and(inArray(companies.id, ids), eq(companies.letterState, "printed")))
      .returning({ id: companies.id });
    if (updated.length)
      await tx
        .insert(activityEvents)
        .values(updated.map((u) => ({ companyId: u.id, actorId: user.id, kind: "sent", title: "Letter sent", detail: `${run.reference} confirmed by ${user.firstName} ${user.lastName}` })));
    return updated;
  });
  if (!rows.length) return { ok: false, message: "This print run was already confirmed or cancelled." };
  return { ok: true, count: rows.length };
}

/** Undo a confirmation (toast "Undo"). */
export async function undoConfirmAction(runId: string): Promise<SimpleResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(runId).success) return { ok: false, message: "Unknown print run." };
  const rows = await db.transaction(async (tx) => {
    const [run] = await tx
      .update(printRuns)
      .set({ status: "printed", confirmedAt: null })
      .where(and(eq(printRuns.id, runId), eq(printRuns.status, "confirmed")))
      .returning({ id: printRuns.id });
    if (!run) return [];
    const ids = tx.select({ id: printRunItems.companyId }).from(printRunItems).where(eq(printRunItems.printRunId, runId));
    return tx
      .update(companies)
      .set({ letterState: "printed", updatedAt: new Date() })
      .where(and(inArray(companies.id, ids), eq(companies.letterState, "posted")))
      .returning({ id: companies.id });
  });
  return { ok: true, count: rows.length };
}

/** Cancel a run that was never confirmed — its companies go back into the print run. */
export async function cancelRunAction(runId: string): Promise<SimpleResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(runId).success) return { ok: false, message: "Unknown print run." };
  const rows = await db.transaction(async (tx) => {
    const [run] = await tx
      .update(printRuns)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(and(eq(printRuns.id, runId), eq(printRuns.status, "printed")))
      .returning({ reference: printRuns.reference });
    if (!run) return [];
    const ids = tx.select({ id: printRunItems.companyId }).from(printRunItems).where(eq(printRunItems.printRunId, runId));
    const back = await tx
      .update(companies)
      .set({ letterState: "added", updatedAt: new Date() })
      .where(and(inArray(companies.id, ids), eq(companies.letterState, "printed")))
      .returning({ id: companies.id });
    if (back.length)
      await tx
        .insert(activityEvents)
        .values(back.map((b) => ({ companyId: b.id, actorId: user.id, kind: "run_cancelled", title: "Print run cancelled", detail: `${run.reference} — back in the print run` })));
    return back;
  });
  if (!rows.length) return { ok: false, message: "Only runs that haven’t been confirmed can be cancelled." };
  return { ok: true, count: rows.length };
}

/** Print run details for the History modal. */
export async function getRunDetailAction(runId: string) {
  const user = await auth();
  if (!user || !uuid.safeParse(runId).success) return null;
  const { getRun } = await import("./queries");
  const run = await getRun(runId);
  if (!run) return null;
  return {
    id: run.id,
    reference: run.reference,
    status: run.status,
    letters: run.letters,
    template: run.template,
    printedBy: run.printedBy,
    printedAt: run.printedAt,
    printedDay: run.printedDay,
    labelsPrinted: run.labelsPrinted,
    items: run.items.map((i) => ({
      number: i.number,
      name: i.letter?.companyName ?? i.number,
      director: i.letter?.directorFullName ?? "—",
      town: i.letter?.addressLines?.[i.letter.addressLines.length - 2] ?? "",
      state: i.state,
    })),
  };
}

/** Label lines (name, company, address) for a run, in letter order. */
export async function getRunLabelsAction(runId: string): Promise<string[][]> {
  const user = await auth();
  if (!user || !uuid.safeParse(runId).success) return [];
  const items = await db
    .select({ letter: printRunItems.letter })
    .from(printRunItems)
    .where(eq(printRunItems.printRunId, runId))
    .orderBy(printRunItems.position);
  return items.map((i) => [i.letter?.directorFullName ?? "The Director", i.letter?.companyName ?? "", ...(i.letter?.addressLines ?? [])]);
}

export async function markLabelsPrintedAction(runId: string): Promise<SimpleResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(runId).success) return { ok: false, message: "Unknown print run." };
  const r = await db.update(printRuns).set({ labelsPrintedAt: new Date() }).where(eq(printRuns.id, runId)).returning({ id: printRuns.id });
  return { ok: true, count: r.length };
}
