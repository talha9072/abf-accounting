import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authAttempts } from "@/lib/db/schema";

export type AttemptKind = "sign_in" | "register" | "reset_request" | "reset" | "change_password";

/** Sign-in: 5 wrong passwords for one email → 15-minute lock (matches the design copy). */
export const SIGN_IN_MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

/** Per-IP ceilings, regardless of which email is tried. */
const IP_LIMITS: Record<AttemptKind, { max: number; windowMs: number }> = {
  sign_in: { max: 30, windowMs: 15 * 60 * 1000 },
  register: { max: 5, windowMs: 60 * 60 * 1000 },
  reset_request: { max: 5, windowMs: 60 * 60 * 1000 },
  reset: { max: 10, windowMs: 60 * 60 * 1000 },
  change_password: { max: 10, windowMs: 15 * 60 * 1000 },
};

export async function recordAttempt(kind: AttemptKind, opts: { email?: string | null; ip: string; success: boolean }) {
  await db.insert(authAttempts).values({
    kind,
    email: opts.email ?? null,
    ipAddress: opts.ip,
    success: opts.success,
  });
}

/** True when this IP has made too many attempts of this kind recently. */
export async function isIpLimited(kind: AttemptKind, ip: string): Promise<boolean> {
  const { max, windowMs } = IP_LIMITS[kind];
  const since = new Date(Date.now() - windowMs);
  const where =
    kind === "sign_in" || kind === "change_password"
      ? and(eq(authAttempts.kind, kind), eq(authAttempts.ipAddress, ip), eq(authAttempts.success, false), gt(authAttempts.createdAt, since))
      : and(eq(authAttempts.kind, kind), eq(authAttempts.ipAddress, ip), gt(authAttempts.createdAt, since));
  const [row] = await db.select({ n: count() }).from(authAttempts).where(where);
  return (row?.n ?? 0) >= max;
}

/**
 * Failed sign-ins for an email in the lock window. Counted per *email string*
 * (not per user row) so unknown emails behave exactly like real ones.
 */
export async function recentSignInFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCK_WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.kind, "sign_in"),
        eq(authAttempts.email, email),
        eq(authAttempts.success, false),
        gt(authAttempts.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}
