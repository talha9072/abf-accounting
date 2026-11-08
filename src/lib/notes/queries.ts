import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companyNotes, users } from "@/lib/db/schema";
import { formatDate } from "@/lib/companies/format";
import { addDays, dateInTz, formatSaTime, SCHEDULE_TZ } from "@/lib/pull/dates";

export type NoteItem = { id: string; author: string; when: string; body: string; edited: boolean; mine: boolean };

/** Friendly time: "Today 09:40", "Yesterday 16:05", "4 Nov 2026". */
export function friendlyWhen(d: Date) {
  const today = dateInTz(new Date(), SCHEDULE_TZ);
  const day = dateInTz(d, SCHEDULE_TZ);
  if (day === today) return `Today ${formatSaTime(d)}`;
  if (day === addDays(today, -1)) return `Yesterday ${formatSaTime(d)}`;
  return formatDate(day);
}

export async function listNotes(companyId: string, viewer: { id: string; role: string }): Promise<NoteItem[]> {
  const rows = await db
    .select({
      id: companyNotes.id,
      body: companyNotes.body,
      createdAt: companyNotes.createdAt,
      updatedAt: companyNotes.updatedAt,
      authorId: companyNotes.authorId,
      first: users.firstName,
      last: users.lastName,
    })
    .from(companyNotes)
    .leftJoin(users, eq(companyNotes.authorId, users.id))
    .where(eq(companyNotes.companyId, companyId))
    .orderBy(desc(companyNotes.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    author: r.first ? `${r.first} ${r.last ?? ""}`.trim() : "Former user",
    when: friendlyWhen(r.createdAt),
    body: r.body,
    edited: r.updatedAt.getTime() - r.createdAt.getTime() > 1000,
    mine: r.authorId === viewer.id || viewer.role === "admin",
  }));
}

/** Newest note + total count, for the company overview card. */
export async function latestNote(companyId: string) {
  const [row] = await db
    .select({ body: companyNotes.body, createdAt: companyNotes.createdAt, first: users.firstName, last: users.lastName, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(companyNotes)
    .leftJoin(users, eq(companyNotes.authorId, users.id))
    .where(eq(companyNotes.companyId, companyId))
    .orderBy(desc(companyNotes.createdAt))
    .limit(1);
  if (!row) return null;
  return { body: row.body, author: row.first ? `${row.first} ${row.last ?? ""}`.trim() : "Former user", when: friendlyWhen(row.createdAt), total: row.total };
}
