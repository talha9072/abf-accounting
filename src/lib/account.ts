import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";
import { redirect } from "next/navigation";

/** Narrow, client-safe view of the signed-in user's account. */
export async function getMyAccount() {
  const current = await getCurrentSession();
  if (!current) redirect("/sign-in");

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      mobile: users.mobile,
      twoFactorEnabled: users.twoFactorEnabled,
      emailOnPullFailure: users.emailOnPullFailure,
      passwordChangedAt: users.passwordChangedAt,
    })
    .from(users)
    .where(eq(users.id, current.user.id))
    .limit(1);

  const devices = await db
    .select({ id: sessions.id, userAgent: sessions.userAgent, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.userId, current.user.id), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(10);

  return {
    ...user,
    passwordChangedAt: user.passwordChangedAt.toISOString(),
    mobile: undefined, // never send the raw number to the browser
    mobileMasked: user.mobile ? maskPhone(user.mobile) : "",
    devices: devices.map((d) => ({
      label: describeAgent(d.userAgent),
      current: d.id === current.sessionId,
      lastSeenAt: d.lastSeenAt.toISOString(),
    })),
  };
}

function maskPhone(p: string) {
  const digits = p.replace(/\s/g, "");
  return digits.length <= 5 ? "•••" : `${digits.slice(0, 2)}••• ••• ${digits.slice(-3)}`;
}

function describeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
