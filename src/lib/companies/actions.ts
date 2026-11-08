"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activityEvents, companies, exclusions } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";
import { matchingCompanyNumbers, parseFeedFilters } from "./queries";

export type ActionResult = { ok: true; count: number; numbers: string[] } | { ok: false; message: string };

const numberSchema = z.string().regex(/^[A-Z0-9]{6,10}$/i);
/** Either explicit company numbers, or the current list filters ("Select all"). */
const targetSchema = z.union([
  z.object({ numbers: z.array(numberSchema).min(1).max(5000) }),
  z.object({ query: z.string().max(2000) }),
]);
export type Target = z.infer<typeof targetSchema>;

async function auth() {
  const s = await getCurrentSession();
  return s?.user ?? null;
}

async function resolveNumbers(target: unknown): Promise<string[] | null> {
  const parsed = targetSchema.safeParse(target);
  if (!parsed.success) return null;
  if ("numbers" in parsed.data) return [...new Set(parsed.data.numbers.map((n) => n.toUpperCase()))];
  const sp = Object.fromEntries(new URLSearchParams(parsed.data.query));
  return matchingCompanyNumbers(parseFeedFilters(sp));
}

async function logActivity(rows: Array<{ id: string }>, actorId: string, kind: string, title: string, detail?: string) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(activityEvents).values(rows.slice(i, i + 1000).map((r) => ({ companyId: r.id, actorId, kind, title, detail })));
  }
}

/* ------------------------------------------------------------------ */
/* Exclude / undo                                                      */
/* ------------------------------------------------------------------ */

export async function excludeCompaniesAction(target: Target, reason?: string): Promise<ActionResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const numbers = await resolveNumbers(target);
  if (!numbers?.length) return { ok: false, message: "Nothing selected." };
  const why = (reason ?? "Excluded from New Companies").slice(0, 300);

  const rows = await db
    .update(companies)
    .set({ letterState: "excluded", updatedAt: new Date() })
    .where(and(inArray(companies.companyNumber, numbers), sql`${companies.letterState} NOT IN ('printed','posted','excluded')`))
    .returning({ id: companies.id, number: companies.companyNumber, name: companies.name });

  if (rows.length) {
    for (let i = 0; i < rows.length; i += 1000) {
      await db.insert(exclusions).values(
        rows.slice(i, i + 1000).map((r) => ({ companyNumber: r.number, companyName: r.name, reason: why, createdBy: user.id })),
      );
    }
    await logActivity(rows, user.id, "excluded", "Excluded", `By ${user.firstName} ${user.lastName}`);
  }
  return { ok: true, count: rows.length, numbers: rows.map((r) => r.number) };
}

/** Undo an exclusion: back to whatever the selection rules decided. */
export async function undoExcludeAction(numbers: string[]): Promise<ActionResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const list = await resolveNumbers({ numbers });
  if (!list?.length) return { ok: false, message: "Nothing to undo." };

  await db.delete(exclusions).where(inArray(exclusions.companyNumber, list));
  const rows = await db
    .update(companies)
    .set({
      letterState: sql`CASE
        WHEN ${companies.skipReason} IS NOT NULL AND ${companies.skipReason} NOT IN ('not_excluded','address_complete') THEN 'skipped'
        WHEN ${companies.postingAddress} IS NULL AND (${companies.eligibility}->>'address_complete') = 'false' THEN 'address_issue'
        ELSE 'not_reviewed' END::letter_state`,
      updatedAt: new Date(),
    })
    .where(and(inArray(companies.companyNumber, list), eq(companies.letterState, "excluded")))
    .returning({ id: companies.id, number: companies.companyNumber });
  await logActivity(rows, user.id, "exclude_undone", "Exclusion removed");
  return { ok: true, count: rows.length, numbers: rows.map((r) => r.number) };
}

/* ------------------------------------------------------------------ */
/* Print run                                                           */
/* ------------------------------------------------------------------ */

export async function addToRunAction(target: Target): Promise<ActionResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const numbers = await resolveNumbers(target);
  if (!numbers?.length) return { ok: false, message: "Nothing selected." };

  // Only companies that passed every check (or had their address fixed) can go in a run.
  const rows = await db
    .update(companies)
    .set({ letterState: "added", updatedAt: new Date() })
    .where(and(inArray(companies.companyNumber, numbers), eq(companies.letterState, "not_reviewed")))
    .returning({ id: companies.id, number: companies.companyNumber });
  await logActivity(rows, user.id, "added_to_run", "Added to the print run", `By ${user.firstName} ${user.lastName}`);
  return { ok: true, count: rows.length, numbers: rows.map((r) => r.number) };
}

export async function removeFromRunAction(numbers: string[]): Promise<ActionResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const list = await resolveNumbers({ numbers });
  if (!list?.length) return { ok: false, message: "Nothing selected." };
  const rows = await db
    .update(companies)
    .set({ letterState: "not_reviewed", updatedAt: new Date() })
    .where(and(inArray(companies.companyNumber, list), eq(companies.letterState, "added")))
    .returning({ id: companies.id, number: companies.companyNumber });
  await logActivity(rows, user.id, "removed_from_run", "Removed from the print run");
  return { ok: true, count: rows.length, numbers: rows.map((r) => r.number) };
}

/* ------------------------------------------------------------------ */
/* Posting address                                                     */
/* ------------------------------------------------------------------ */

const addressSchema = z.object({
  number: numberSchema,
  line1: z.string().trim().min(1, "Enter the first line of the address.").max(120),
  line2: z.string().trim().max(120).optional().default(""),
  town: z.string().trim().min(1, "Enter the town or city.").max(80),
  postcode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/, "Enter a full UK postcode, like EH2 2QA."),
});

export type AddressResult = { ok: true } | { ok: false; message?: string; fieldErrors?: Record<string, string[] | undefined> };

export async function fixPostingAddressAction(input: z.input<typeof addressSchema>): Promise<AddressResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { number, line1, line2, town, postcode } = parsed.data;
  const pc = postcode.replace(/\s+/g, "");
  const formatted = `${pc.slice(0, -3)} ${pc.slice(-3)}`;

  const rows = await db
    .update(companies)
    .set({
      postingAddress: { line1, line2: line2 || null, town, postcode: formatted, country: null },
      letterState: sql`CASE WHEN ${companies.letterState} = 'address_issue' THEN 'not_reviewed' ELSE ${companies.letterState} END::letter_state`,
      updatedAt: new Date(),
    })
    .where(eq(companies.companyNumber, number.toUpperCase()))
    .returning({ id: companies.id });
  if (!rows.length) return { ok: false, message: "Company not found." };
  await logActivity(rows, user.id, "address_fixed", "Posting address fixed", `${line1}, ${town}, ${formatted}`);
  return { ok: true };
}

/** "Skip this company" from the address modal — it won't get a letter. */
export async function skipCompanyAction(number: string): Promise<ActionResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const n = numberSchema.safeParse(number);
  if (!n.success) return { ok: false, message: "Invalid company." };
  const rows = await db
    .update(companies)
    .set({ letterState: "skipped", skipReason: "manual", updatedAt: new Date() })
    .where(and(eq(companies.companyNumber, n.data.toUpperCase()), sql`${companies.letterState} NOT IN ('printed','posted')`))
    .returning({ id: companies.id, number: companies.companyNumber });
  await logActivity(rows, user.id, "skipped", "Skipped", `By ${user.firstName} ${user.lastName}`);
  return { ok: true, count: rows.length, numbers: rows.map((r) => r.number) };
}
