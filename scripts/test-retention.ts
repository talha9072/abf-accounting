/**
 * History retention (12 months) against the LOCAL database. Inserts clearly-marked test rows
 * (company numbers ZZRET…), runs the clean-up and checks what went and what stayed, then removes
 * its own rows. Refuses to run unless DATABASE_URL points at localhost.
 *
 *   npx tsx --conditions=react-server scripts/test-retention.ts
 */
import assert from "node:assert/strict";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) throw new Error("local database only");
  const { db, pool } = await import("../src/lib/db");
  const { companies, exclusions, printRunItems, printRuns } = await import("../src/lib/db/schema");
  const { purgeOldHistory, retentionCutoff } = await import("../src/lib/history/retention");
  const { eq, inArray, like } = await import("drizzle-orm");

  const now = new Date();
  const monthsAgo = (m: number) => retentionCutoff(m, now);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const address = { line1: "1 Test Street", line2: null, town: "Testtown", postcode: "LU3 3RP", country: null };
  const company = (n: string, inc: Date, state: string) => ({
    companyNumber: n,
    name: `RETENTION TEST ${n} LTD`,
    companyType: "ltd",
    companyStatus: "active",
    incorporatedOn: day(inc),
    registeredOffice: address,
    letterState: state as "posted",
    raw: {},
  });

  const cleanup = async () => {
    const ids = (await db.select({ id: companies.id }).from(companies).where(like(companies.companyNumber, "ZZRET%"))).map((r) => r.id);
    if (ids.length) await db.delete(companies).where(inArray(companies.id, ids));
    await db.delete(printRuns).where(like(printRuns.reference, "ZZ-%"));
    await db.delete(exclusions).where(like(exclusions.companyNumber, "ZZRET%"));
  };
  await cleanup();

  // Old: incorporated 14 months ago, printed 13 months ago. Recent: 1 month. Old but still queued: 14 months.
  const [oldCo, newCo, queuedCo, oldExcluded] = await db
    .insert(companies)
    .values([
      company("ZZRET001", monthsAgo(14), "posted"),
      company("ZZRET002", monthsAgo(1), "posted"),
      company("ZZRET003", monthsAgo(14), "added"),
      company("ZZRET004", monthsAgo(14), "excluded"),
    ])
    .returning({ id: companies.id });
  const [oldRun, newRun] = await db
    .insert(printRuns)
    .values([
      { reference: "ZZ-OLD", status: "confirmed", letterCount: 1, printedAt: monthsAgo(13) },
      { reference: "ZZ-NEW", status: "confirmed", letterCount: 1, printedAt: monthsAgo(1) },
    ])
    .returning({ id: printRuns.id });
  await db.insert(printRunItems).values([
    { printRunId: oldRun.id, companyId: oldCo.id, position: 1, reference: "ZZ1", addressSnapshot: address },
    { printRunId: newRun.id, companyId: newCo.id, position: 1, reference: "ZZ2", addressSnapshot: address },
  ]);
  await db.insert(exclusions).values({ companyNumber: "ZZRET004", companyName: "RETENTION TEST ZZRET004 LTD", reason: "test" });

  const result = await purgeOldHistory(now);
  assert.ok(result, "clean-up ran");

  const left = new Set((await db.select({ n: companies.companyNumber }).from(companies).where(like(companies.companyNumber, "ZZRET%"))).map((r) => r.n));
  const runsLeft = new Set((await db.select({ r: printRuns.reference }).from(printRuns).where(like(printRuns.reference, "ZZ-%"))).map((r) => r.r));
  const excl = await db.select({ n: exclusions.companyNumber }).from(exclusions).where(eq(exclusions.companyNumber, "ZZRET004"));

  try {
    assert.ok(!left.has("ZZRET001"), "company older than 12 months is deleted");
    assert.ok(left.has("ZZRET002"), "recent company stays");
    assert.ok(left.has("ZZRET003"), "old company still in the print queue stays");
    assert.ok(!left.has("ZZRET004"), "old excluded company record is deleted …");
    assert.equal(excl.length, 1, "… but its do-not-contact entry stays");
    assert.ok(!runsLeft.has("ZZ-OLD"), "print run older than 12 months is deleted");
    assert.ok(runsLeft.has("ZZ-NEW"), "recent print run stays");
    void oldExcluded;
    console.log("retention: all checks passed", result);
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
