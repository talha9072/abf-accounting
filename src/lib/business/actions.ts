"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { businessSettings } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";

export type BusinessResult = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/i;
const optional = (max: number) => z.string().trim().max(max, "Too long");

const schema = z.object({
  brandName: z.string().trim().min(2, "Enter the business name").max(200, "Too long"),
  addressLine: z
    .string()
    .trim()
    .min(8, "Enter the office address")
    .max(300, "Too long")
    // The pull compares new companies' addresses with this one ("not your own office").
    .refine((v) => v.split(",").map((p) => p.trim()).some((p) => POSTCODE.test(p) && p.replace(POSTCODE, "").trim() === ""), "Separate the parts with commas and end with the postcode, e.g. 18 Thricknells Close, Luton, LU3 3RP"),
  supportTelephone: optional(40).refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number"),
  supportEmail: optional(254).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address"),
  website: optional(200).refine((v) => v === "" || /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), "Enter a web address like abfaccounting.com"),
  registrationLine: optional(400),
  referencePrefix: z.string().trim().min(1, "Enter a prefix").max(16, "16 characters at most").regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  qrLink: optional(300).refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use a full https:// link"),
});

export async function saveBusinessSettingsAction(input: Record<string, string>): Promise<BusinessResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  if (s.user.role !== "admin") return { ok: false, message: "Only admins can change business settings." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const row = {
    brandName: v.brandName,
    addressLine: v.addressLine.replace(/\s*,\s*/g, ", "),
    supportTelephone: v.supportTelephone || null,
    supportEmail: v.supportEmail.toLowerCase() || null,
    website: v.website.replace(/^https?:\/\//i, "").replace(/\/$/, "") || null,
    registrationLine: v.registrationLine || null,
    referencePrefix: v.referencePrefix.toUpperCase(),
    qrLink: v.qrLink || null,
    updatedAt: new Date(),
  };
  await db
    .insert(businessSettings)
    .values({ id: 1, ...row })
    .onConflictDoUpdate({ target: businessSettings.id, set: row });
  revalidatePath("/", "layout");
  return { ok: true, message: "Business settings saved — new letters use them straight away" };
}
