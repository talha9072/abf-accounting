"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activityEvents, companies, companyNotes } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";

export type NoteResult = { ok: true } | { ok: false; message: string };

const body = z.string().trim().min(1, "Write something first.").max(2000, "Keep notes under 2,000 characters.");
const uuid = z.string().uuid();

async function auth() {
  return (await getCurrentSession())?.user ?? null;
}

/** Only the author (or an admin) may change a note. */
async function canEdit(noteId: string, user: { id: string; role: string }) {
  const [n] = await db.select({ authorId: companyNotes.authorId, companyId: companyNotes.companyId }).from(companyNotes).where(eq(companyNotes.id, noteId)).limit(1);
  if (!n) return null;
  return n.authorId === user.id || user.role === "admin" ? n : null;
}

export async function addNoteAction(companyNumber: string, text: string): Promise<NoteResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const b = body.safeParse(text);
  if (!b.success) return { ok: false, message: b.error.issues[0].message };
  if (!/^[A-Z0-9]{6,10}$/i.test(companyNumber)) return { ok: false, message: "Company not found." };
  const [c] = await db.select({ id: companies.id }).from(companies).where(eq(companies.companyNumber, companyNumber.toUpperCase())).limit(1);
  if (!c) return { ok: false, message: "Company not found." };

  await db.transaction(async (tx) => {
    await tx.insert(companyNotes).values({ companyId: c.id, authorId: user.id, body: b.data });
    await tx.insert(activityEvents).values({
      companyId: c.id,
      actorId: user.id,
      kind: "note_added",
      title: "Note added",
      detail: `${user.firstName} ${user.lastName}: ${b.data.slice(0, 80)}${b.data.length > 80 ? "…" : ""}`,
    });
  });
  return { ok: true };
}

export async function editNoteAction(noteId: string, text: string): Promise<NoteResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(noteId).success) return { ok: false, message: "Note not found." };
  const b = body.safeParse(text);
  if (!b.success) return { ok: false, message: b.error.issues[0].message };
  if (!(await canEdit(noteId, user))) return { ok: false, message: "You can only edit your own notes." };
  await db.update(companyNotes).set({ body: b.data }).where(eq(companyNotes.id, noteId));
  return { ok: true };
}

export async function deleteNoteAction(noteId: string): Promise<NoteResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!uuid.safeParse(noteId).success) return { ok: false, message: "Note not found." };
  const n = await canEdit(noteId, user);
  if (!n) return { ok: false, message: "You can only delete your own notes." };
  await db.delete(companyNotes).where(and(eq(companyNotes.id, noteId), eq(companyNotes.companyId, n.companyId)));
  return { ok: true };
}
