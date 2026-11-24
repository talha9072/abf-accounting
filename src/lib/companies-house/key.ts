import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSecrets, users } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/auth/totp";

/**
 * The Companies House API key lives in Business settings (an admin pastes it there), stored
 * encrypted in app_secrets. COMPANIES_HOUSE_API_KEY in .env still works as a fallback for
 * development, but the key saved in the app always wins.
 */
const NAME = "companies_house_api_key";
const CACHE_MS = 30_000;
const g = globalThis as unknown as { __abfChKey?: { value: string | null; at: number } };

/** Real keys are UUIDs (36 chars); older ones are ~40 letters/digits. */
export const CH_KEY_PATTERN = /^[A-Za-z0-9-]{20,64}$/;

export function clearCompaniesHouseKeyCache() {
  g.__abfChKey = undefined;
}

/** The key to use for API calls, or null when none is set. Cached for 30 s (a pull makes thousands of calls). */
export async function getCompaniesHouseKey(): Promise<string | null> {
  const hit = g.__abfChKey;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value: string | null = null;
  const [row] = await db.select({ valueEnc: appSecrets.valueEnc }).from(appSecrets).where(eq(appSecrets.name, NAME)).limit(1);
  if (row) {
    try {
      value = decryptSecret(row.valueEnc);
    } catch (e) {
      // AUTH_ENCRYPTION_KEY missing or changed since the key was saved: it has to be entered again.
      console.error("[companies-house] the saved API key can't be decrypted — enter it again in Business settings.", e instanceof Error ? e.message : e);
    }
  }
  value ??= process.env.COMPANIES_HOUSE_API_KEY?.trim() || null;
  g.__abfChKey = { value, at: Date.now() };
  return value;
}

export type CompaniesHouseKeyStatus =
  | { state: "saved"; hint: string; updatedAt: string; updatedBy: string | null }
  | { state: "unreadable"; hint: string; updatedAt: string; updatedBy: string | null }
  | { state: "env" }
  | { state: "missing" };

/** What Business settings shows. Never returns the key itself. */
export async function getCompaniesHouseKeyStatus(): Promise<CompaniesHouseKeyStatus> {
  const [row] = await db
    .select({ valueEnc: appSecrets.valueEnc, hint: appSecrets.hint, updatedAt: appSecrets.updatedAt, first: users.firstName, last: users.lastName })
    .from(appSecrets)
    .leftJoin(users, eq(users.id, appSecrets.updatedBy))
    .where(eq(appSecrets.name, NAME))
    .limit(1);
  if (row) {
    const base = { hint: row.hint, updatedAt: row.updatedAt.toISOString(), updatedBy: row.first ? `${row.first} ${row.last ?? ""}`.trim() : null };
    try {
      decryptSecret(row.valueEnc);
      return { state: "saved", ...base };
    } catch {
      return { state: "unreadable", ...base };
    }
  }
  return process.env.COMPANIES_HOUSE_API_KEY?.trim() ? { state: "env" } : { state: "missing" };
}

export async function saveCompaniesHouseKey(key: string, userId: string) {
  const row = { valueEnc: encryptSecret(key), hint: key.slice(-4), updatedBy: userId, updatedAt: new Date() };
  await db.insert(appSecrets).values({ name: NAME, ...row }).onConflictDoUpdate({ target: appSecrets.name, set: row });
  clearCompaniesHouseKeyCache();
}

export async function removeCompaniesHouseKey() {
  await db.delete(appSecrets).where(eq(appSecrets.name, NAME));
  clearCompaniesHouseKeyCache();
}

/**
 * One cheap request with this key (company 00000006, Marks and Spencer's old number, always exists).
 * "rejected" = Companies House said the key is wrong; "unreachable" = no answer (try later).
 */
export async function checkCompaniesHouseKey(key: string): Promise<"ok" | "rejected" | "unreachable"> {
  try {
    const res = await fetch("https://api.company-information.service.gov.uk/company/00000006", {
      headers: { Authorization: "Basic " + Buffer.from(`${key}:`).toString("base64"), Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return "rejected";
    return res.ok || res.status === 404 ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}
