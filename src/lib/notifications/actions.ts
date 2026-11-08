"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";
import { listNotifications } from "./server";

export async function markAllReadAction() {
  const s = await getCurrentSession();
  if (!s) return { ok: false as const };
  await db.update(users).set({ notificationsSeenAt: new Date() }).where(eq(users.id, s.user.id));
  return { ok: true as const };
}

/** Fresh list for the bell (polled lightly by the top bar). */
export async function getNotificationsAction() {
  const s = await getCurrentSession();
  if (!s) return null;
  return listNotifications(s.user.id);
}
