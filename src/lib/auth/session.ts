import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, ne, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { generateToken, sha256 } from "./crypto";
import { getClientMeta } from "./request";

const isProd = process.env.NODE_ENV === "production";

/**
 * `__Host-` prefix (prod only, needs HTTPS) pins the cookie to this exact
 * host, path "/" and Secure — it can't be set or overwritten by subdomains.
 */
export const SESSION_COOKIE = isProd ? "__Host-abf_session" : "abf_session";

const HOUR = 60 * 60 * 1000;
/** Browser-session sign-in: expires after 12h without activity. */
const SHORT_SESSION_MS = 12 * HOUR;
/** "Keep me signed in on this computer": 30 days. */
const REMEMBER_SESSION_MS = 30 * 24 * HOUR;
/** Only write lastSeenAt / extend expiry this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "staff";
};

export async function createSession(userId: string, remember: boolean) {
  const token = generateToken();
  const { ip, userAgent } = await getClientMeta();
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS));

  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    remember,
    ipAddress: ip,
    userAgent,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // No maxAge → cookie dies with the browser unless "keep me signed in".
    ...(remember ? { expires: expiresAt } : {}),
    priority: "high",
  });
}

/**
 * Validates the cookie against the database. Returns null for missing,
 * expired, revoked or disabled-user sessions.
 */
export async function validateSession(): Promise<{ user: SessionUser; sessionId: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const sessionId = sha256(token);

  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      remember: sessions.remember,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.status !== "active") return null;

  // Sliding expiry for browser sessions; periodic last-seen for all.
  const now = Date.now();
  if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: new Date(now),
        ...(row.remember ? {} : { expiresAt: new Date(now + SHORT_SESSION_MS) }),
      })
      .where(eq(sessions.id, sessionId));
  }

  return {
    sessionId,
    user: { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role },
  };
}

/** Revoke the current session (sign out) and clear the cookie. */
export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user except (optionally) the current one. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}

/** Housekeeping — safe to call from a cron job. */
export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
