"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";

export type AccountResult = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80, "Too long")
  .regex(/^[\p{L}\p{M}' .-]+$/u, "Letters, spaces, apostrophes and hyphens only");

const detailsSchema = z.object({
  firstName: name,
  lastName: name,
  // Blank clears it; the masked value (with •) means "unchanged".
  mobile: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || v.includes("•") || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number"),
});

export async function saveDetailsAction(input: { firstName: string; lastName: string; mobile: string }): Promise<AccountResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const { firstName, lastName, mobile } = parsed.data;
  await db
    .update(users)
    .set({
      firstName,
      lastName,
      ...(mobile.includes("•") ? {} : { mobile: mobile ? mobile.replace(/\s+/g, " ") : null }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, s.user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Your details were saved" };
}

export async function saveEmailPrefsAction(input: { emailOnPullFailure: boolean }): Promise<AccountResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const v = z.boolean().safeParse(input?.emailOnPullFailure);
  if (!v.success) return { ok: false, message: "Invalid preference." };
  await db.update(users).set({ emailOnPullFailure: v.data, updatedAt: new Date() }).where(eq(users.id, s.user.id));
  return { ok: true, message: "Email preferences saved" };
}
