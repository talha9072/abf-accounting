import "server-only";
import { desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { friendlyWhen } from "@/lib/notes/queries";

export type NotificationItem = { id: string; kind: string; title: string; detail: string; when: string; unread: boolean };

/** Team-wide (userId null) + personal notifications, newest first. */
export async function listNotifications(userId: string, limit = 8) {
  const [u] = await db.select({ seenAt: users.notificationsSeenAt }).from(users).where(eq(users.id, userId)).limit(1);
  const rows = await db
    .select()
    .from(notifications)
    .where(or(isNull(notifications.userId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  const seen = u?.seenAt?.getTime() ?? 0;
  const items = rows.map(
    (n): NotificationItem => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      // Older pull notifications end with their own "· HH:MM"; drop it so the time isn't shown twice.
      detail: [n.detail?.replace(/\s·\s\d{2}:\d{2}$/, ""), friendlyWhen(n.createdAt)].filter(Boolean).join(" · "),
      when: friendlyWhen(n.createdAt),
      unread: n.createdAt.getTime() > seen,
    }),
  );
  return { items, unread: items.filter((i) => i.unread).length };
}

/** Add a team-wide notification (shown in everyone's bell). Never throws. */
export async function notify(kind: string, title: string, detail?: string) {
  try {
    await db.insert(notifications).values({ kind, title: title.slice(0, 200), detail: detail?.slice(0, 300) ?? null });
  } catch (e) {
    console.error("[notify] failed", e);
  }
}
