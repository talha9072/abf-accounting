/**
 * Checks the Companies House key in Business settings: encrypted storage, the .env fallback,
 * a key that can't be decrypted, the live check with Companies House, the API client using the
 * saved key, and the scheduler waiting quietly when there is no key.
 * Uses the local database and leaves it as it found it (any saved key is restored).
 * Needs COMPANIES_HOUSE_API_KEY and AUTH_ENCRYPTION_KEY in .env.local.
 * Run: npx tsx --conditions=react-server scripts/test-ch-key.ts
 */
export {};

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

let failed = 0;
const check = (label: string, pass: boolean, extra = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
};

async function main() {
  const { db, pool } = await import("../src/lib/db");
  const { appSecrets, users } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const key = await import("../src/lib/companies-house/key");
  const { chGet } = await import("../src/lib/companies-house/client");
  const { runScheduledPull } = await import("../src/lib/pull/run-pull");
  const { getPullOverview } = await import("../src/lib/pull/status");

  const realKey = process.env.COMPANIES_HOUSE_API_KEY?.trim() ?? "";
  const realEnc = process.env.AUTH_ENCRYPTION_KEY ?? "";
  if (!realKey || !realEnc) throw new Error("Set COMPANIES_HOUSE_API_KEY and AUTH_ENCRYPTION_KEY in .env.local first.");
  const [before] = await db.select().from(appSecrets).where(eq(appSecrets.name, "companies_house_api_key"));
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);

  try {
    await key.removeCompaniesHouseKey();

    // 1. Nothing saved: falls back to .env, then to "missing".
    check("no saved key → uses .env key", (await key.getCompaniesHouseKey()) === realKey);
    check("status says .env", (await key.getCompaniesHouseKeyStatus()).state === "env");
    delete process.env.COMPANIES_HOUSE_API_KEY;
    key.clearCompaniesHouseKeyCache();
    check("no key anywhere → null", (await key.getCompaniesHouseKey()) === null);
    check("status says missing", (await key.getCompaniesHouseKeyStatus()).state === "missing");
    const sched = await runScheduledPull(new Date());
    check("scheduler waits quietly without a key", !sched.ran && /no Companies House API key/.test(String(sched.reason)), String(sched.reason));
    check("overview hasKey = false", (await getPullOverview()).hasKey === false);
    let clientErr = "";
    try {
      await chGet("/company/00000006");
    } catch (e) {
      clientErr = e instanceof Error ? e.message : String(e);
    }
    check("API client explains where to add the key", /Business settings/.test(clientErr), clientErr);

    // 2. The live check with Companies House.
    check("check: a made-up key is rejected", (await key.checkCompaniesHouseKey("00000000-0000-4000-8000-000000000000")) === "rejected");
    check("check: the real key is accepted", (await key.checkCompaniesHouseKey(realKey)) === "ok");
    check("key format accepts a UUID key", key.CH_KEY_PATTERN.test("6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b"));
    check("key format rejects junk", !key.CH_KEY_PATTERN.test("abc") && !key.CH_KEY_PATTERN.test("key with spaces and more text"));

    // 3. Saved in the app (with no .env key at all): encrypted, used by the client.
    await key.saveCompaniesHouseKey(realKey, admin?.id ?? "");
    const [row] = await db.select().from(appSecrets).where(eq(appSecrets.name, "companies_house_api_key"));
    check("stored encrypted, never in clear", !!row && row.valueEnc.startsWith("v1.") && !row.valueEnc.includes(realKey));
    check("only the last 4 characters kept", row?.hint === realKey.slice(-4));
    const st = await key.getCompaniesHouseKeyStatus();
    check("status says saved, with who/when", st.state === "saved" && !!st.updatedAt && (admin ? !!st.updatedBy : true), st.state);
    check("saved key is used", (await key.getCompaniesHouseKey()) === realKey);
    const company = await chGet<{ company_number?: string }>("/company/00000006");
    check("API client works with only the saved key", company?.company_number === "00000006");
    check("overview hasKey = true", (await getPullOverview()).hasKey === true);

    // 4. The saved key wins over .env.
    process.env.COMPANIES_HOUSE_API_KEY = "env-key-that-should-not-be-used-000000";
    key.clearCompaniesHouseKeyCache();
    check("saved key wins over .env", (await key.getCompaniesHouseKey()) === realKey);

    // 5. Server's AUTH_ENCRYPTION_KEY changed: shown as unreadable, falls back to .env.
    process.env.AUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    key.clearCompaniesHouseKeyCache();
    check("different encryption key → status unreadable", (await key.getCompaniesHouseKeyStatus()).state === "unreadable");
    check("different encryption key → .env fallback", (await key.getCompaniesHouseKey()) === "env-key-that-should-not-be-used-000000");
    process.env.AUTH_ENCRYPTION_KEY = realEnc;

    // 6. Remove.
    await key.removeCompaniesHouseKey();
    check("remove deletes the row", (await db.select().from(appSecrets).where(eq(appSecrets.name, "companies_house_api_key"))).length === 0);
  } finally {
    process.env.COMPANIES_HOUSE_API_KEY = realKey;
    process.env.AUTH_ENCRYPTION_KEY = realEnc;
    await db.delete(appSecrets).where(eq(appSecrets.name, "companies_house_api_key"));
    if (before) await db.insert(appSecrets).values(before);
    key.clearCompaniesHouseKeyCache();
    await pool.end();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("CRASH", e instanceof Error ? e.message : e);
  process.exit(1);
});
