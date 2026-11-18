import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { recoveryCodes, trustedDevices, twoFactorChallenges, users } from "@/lib/db/schema";
import { generateToken, sha256 } from "./crypto";
import { getClientMeta } from "./request";
import { decryptSecret, normaliseRecoveryCode, verifyTotp } from "./totp";

const isProd = process.env.NODE_ENV === "production";

/** Short-lived "password OK, code next" cookie. */
const CHALLENGE_COOKIE = isProd ? "__Host-abf_2fa" : "abf_2fa";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
/** Wrong codes allowed per sign-in before the password has to be entered again. */
export const CHALLENGE_MAX_ATTEMPTS = 5;

/** "Don't ask again on this computer". */
const TRUSTED_COOKIE = isProd ? "__Host-abf_trusted" : "abf_trusted";
const TRUSTED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cookieBase = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

/* ------------------------------------------------------------------ */
/* Sign-in challenge                                                   */
/* ------------------------------------------------------------------ */

export async function createChallenge(userId: string, remember: boolean, nextPath: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  // One pending challenge per user; also clears out old ones.
  await db.delete(twoFactorChallenges).where(eq(twoFactorChallenges.userId, userId));
  await db.delete(twoFactorChallenges).where(lt(twoFactorChallenges.expiresAt, new Date()));
  await db.insert(twoFactorChallenges).values({ id: sha256(token), userId, remember, nextPath, expiresAt });
  (await cookies()).set(CHALLENGE_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

/** The pending challenge for this browser, or null if missing / expired / used up. */
export async function getChallenge() {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const [row] = await db
    .select({
      id: twoFactorChallenges.id,
      userId: twoFactorChallenges.userId,
      remember: twoFactorChallenges.remember,
      nextPath: twoFactorChallenges.nextPath,
      attempts: twoFactorChallenges.attempts,
      email: users.email,
    })
    .from(twoFactorChallenges)
    .innerJoin(users, eq(users.id, twoFactorChallenges.userId))
    .where(and(eq(twoFactorChallenges.id, sha256(token)), gt(twoFactorChallenges.expiresAt, new Date())))
    .limit(1);
  if (!row || row.attempts >= CHALLENGE_MAX_ATTEMPTS) return null;
  return row;
}

export async function clearChallenge(id?: string) {
  if (id) await db.delete(twoFactorChallenges).where(eq(twoFactorChallenges.id, id));
  (await cookies()).delete(CHALLENGE_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

/**
 * Checks an authenticator code or a recovery code for a user.
 * A matching authenticator code moves `totpLastStep` forward; a recovery code is used up.
 */
export async function checkSecondFactor(userId: string, input: string): Promise<"totp" | "recovery" | null> {
  const [user] = await db
    .select({ secret: users.totpSecret, lastStep: users.totpLastStep, enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.enabled || !user.secret) return null;

  const digits = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(digits)) {
    const step = verifyTotp(decryptSecret(user.secret), digits, user.lastStep);
    if (step === null) return null;
    await db.update(users).set({ totpLastStep: step }).where(eq(users.id, userId));
    return "totp";
  }

  const code = normaliseRecoveryCode(input);
  if (code.length !== 8) return null;
  const used = await db
    .update(recoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, sha256(code)), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  return used.length > 0 ? "recovery" : null;
}

/* ------------------------------------------------------------------ */
/* Trusted computers                                                   */
/* ------------------------------------------------------------------ */

export async function isTrustedDevice(userId: string): Promise<boolean> {
  const token = (await cookies()).get(TRUSTED_COOKIE)?.value;
  if (!token || token.length > 128) return false;
  const [row] = await db
    .select({ id: trustedDevices.id })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.id, sha256(token)), eq(trustedDevices.userId, userId), gt(trustedDevices.expiresAt, new Date())))
    .limit(1);
  return Boolean(row);
}

export async function trustThisDevice(userId: string) {
  const token = generateToken();
  const { userAgent } = await getClientMeta();
  const expiresAt = new Date(Date.now() + TRUSTED_TTL_MS);
  await db.insert(trustedDevices).values({ id: sha256(token), userId, userAgent, expiresAt });
  (await cookies()).set(TRUSTED_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

/** Every computer asks for a code again (password reset, 2-step turned off/on). */
export async function forgetTrustedDevices(userId: string) {
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));
}
