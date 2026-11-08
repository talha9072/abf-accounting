"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { letterTemplates, templateVersions } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/dal";
import { sanitizeTemplateHtml } from "@/lib/letters/html";

export type TemplateResult =
  | { ok: true; id: string; version?: string; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };

const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);

async function auth() {
  return (await getCurrentSession())?.user ?? null;
}

/** "v3.4" → "v3.5"; anything odd → "v1.0". */
function bump(version: string | undefined) {
  const m = /^v(\d+)\.(\d+)$/.exec(version ?? "");
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : "v1.0";
}

async function currentVersion(templateId: string) {
  const [t] = await db.select({ currentVersionId: letterTemplates.currentVersionId }).from(letterTemplates).where(eq(letterTemplates.id, templateId)).limit(1);
  if (!t) return null;
  const [v] = t.currentVersionId
    ? await db.select().from(templateVersions).where(eq(templateVersions.id, t.currentVersionId)).limit(1)
    : await db.select().from(templateVersions).where(eq(templateVersions.templateId, templateId)).orderBy(desc(templateVersions.createdAt)).limit(1);
  return v ?? null;
}

async function isArchived(templateId: string) {
  const [t] = await db.select({ status: letterTemplates.status }).from(letterTemplates).where(eq(letterTemplates.id, templateId)).limit(1);
  return !t ? null : t.status === "archived";
}

/* ------------------------------------------------------------------ */
/* Content tab: name + letter text + offer/CTA. Every save = new version */
/* ------------------------------------------------------------------ */

const contentSchema = z.object({
  id,
  name: text(120).min(1, "Give the template a name."),
  contentHtml: z.string().max(100_000),
  offer: text(200),
  cta: text(200),
});

export async function saveContentAction(input: z.input<typeof contentSchema>): Promise<TemplateResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const p = contentSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: z.flattenError(p.error).fieldErrors };
  const archived = await isArchived(p.data.id);
  if (archived === null) return { ok: false, message: "Template not found." };
  if (archived) return { ok: false, message: "Archived templates are read-only. Set it back to Active or Draft in Settings first." };

  const html = sanitizeTemplateHtml(p.data.contentHtml);
  if (!html.replace(/<[^>]+>/g, "").trim()) return { ok: false, message: "The letter text can’t be empty.", fieldErrors: { contentHtml: ["Write the letter text."] } };

  const cur = await currentVersion(p.data.id);
  const [t] = await db.select().from(letterTemplates).where(eq(letterTemplates.id, p.data.id)).limit(1);
  const changes: string[] = [];
  if (!cur || cur.contentHtml !== html) changes.push("letter text");
  if ((t.defaultOffer ?? "") !== p.data.offer || (t.callToAction ?? "") !== p.data.cta) changes.push("offer");
  if (t.name !== p.data.name) changes.push("name");
  if (changes.length === 0) return { ok: true, id: p.data.id, version: cur?.version, message: "No changes to save." };

  const textChanged = !cur || cur.contentHtml !== html;
  const version = textChanged ? bump(cur?.version) : (cur?.version ?? "v1.0");
  await db.transaction(async (tx) => {
    let versionId = cur?.id ?? null;
    if (textChanged) {
      const [v] = await tx
        .insert(templateVersions)
        .values({
          templateId: p.data.id,
          version,
          summary: `Changed ${changes.join(", ")}`.slice(0, 200),
          contentHtml: html,
          createdBy: user.id,
        })
        .returning({ id: templateVersions.id });
      versionId = v.id;
    }
    await tx
      .update(letterTemplates)
      .set({ name: p.data.name, defaultOffer: p.data.offer || null, callToAction: p.data.cta || null, currentVersionId: versionId })
      .where(eq(letterTemplates.id, p.data.id));
  });
  return { ok: true, id: p.data.id, version, message: `${p.data.name} saved as ${version} · used for the next print run` };
}

/* ------------------------------------------------------------------ */
/* Settings tab                                                        */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({
  id,
  name: text(120).min(1, "Give the template a name."),
  status: z.enum(["active", "draft", "archived"]),
  isDefault: z.boolean(),
  greeting: text(200).min(1, "Add a greeting, e.g. Dear ##DIRECTOR_FIRSTNAME#,"),
  signOff: text(200).min(1, "Add a sign-off, e.g. Kind regards,"),
  signatory: text(120),
  offer: text(200),
  cta: text(200),
});

export async function saveSettingsAction(input: z.input<typeof settingsSchema>): Promise<TemplateResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const p = settingsSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: z.flattenError(p.error).fieldErrors };
  const d = p.data;
  if (d.isDefault && d.status !== "active") return { ok: false, message: "The default template must be Active.", fieldErrors: { status: ["Set it to Active to make it the default."] } };

  const [t] = await db.select({ isDefault: letterTemplates.isDefault }).from(letterTemplates).where(eq(letterTemplates.id, d.id)).limit(1);
  if (!t) return { ok: false, message: "Template not found." };
  if (t.isDefault && !d.isDefault) return { ok: false, message: "Pick another template as the default instead — there must always be one." };

  await db.transaction(async (tx) => {
    if (d.isDefault) await tx.update(letterTemplates).set({ isDefault: false }).where(and(eq(letterTemplates.isDefault, true), ne(letterTemplates.id, d.id)));
    await tx
      .update(letterTemplates)
      .set({
        name: d.name,
        status: d.status,
        isDefault: d.isDefault,
        greeting: d.greeting,
        signOff: d.signOff,
        signatoryName: d.signatory || null,
        defaultOffer: d.offer || null,
        callToAction: d.cta || null,
      })
      .where(eq(letterTemplates.id, d.id));
  });
  return { ok: true, id: d.id, message: "Template settings saved" };
}

export async function archiveTemplateAction(templateId: string): Promise<TemplateResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!id.safeParse(templateId).success) return { ok: false, message: "Template not found." };
  const [t] = await db.select({ isDefault: letterTemplates.isDefault, name: letterTemplates.name }).from(letterTemplates).where(eq(letterTemplates.id, templateId)).limit(1);
  if (!t) return { ok: false, message: "Template not found." };
  if (t.isDefault) return { ok: false, message: "This is the default template. Make another one the default before archiving it." };
  await db.update(letterTemplates).set({ status: "archived" }).where(eq(letterTemplates.id, templateId));
  return { ok: true, id: templateId, message: `${t.name} archived — it stays available for past print runs` };
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

export async function restoreVersionAction(templateId: string, versionId: string): Promise<TemplateResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!id.safeParse(templateId).success || !id.safeParse(versionId).success) return { ok: false, message: "Version not found." };
  if (await isArchived(templateId)) return { ok: false, message: "Archived templates are read-only." };
  const [old] = await db
    .select()
    .from(templateVersions)
    .where(and(eq(templateVersions.id, versionId), eq(templateVersions.templateId, templateId)))
    .limit(1);
  if (!old) return { ok: false, message: "Version not found." };
  const cur = await currentVersion(templateId);
  const version = bump(cur?.version);
  await db.transaction(async (tx) => {
    const [v] = await tx
      .insert(templateVersions)
      .values({ templateId, version, summary: `Restored ${old.version}`, contentHtml: old.contentHtml, createdBy: user.id })
      .returning({ id: templateVersions.id });
    await tx.update(letterTemplates).set({ currentVersionId: v.id }).where(eq(letterTemplates.id, templateId));
  });
  return { ok: true, id: templateId, version, message: `${old.version} restored as ${version}` };
}

/* ------------------------------------------------------------------ */
/* New / duplicate                                                     */
/* ------------------------------------------------------------------ */

const BLANK = "<p>Write your letter here. Use replace codes like ##COMPANY_NAME# to personalise it.</p>";

const newSchema = z.object({ name: text(120).min(1, "Give the template a name."), copyFrom: id.nullable() });

export async function createTemplateAction(input: z.input<typeof newSchema>): Promise<TemplateResult> {
  const user = await auth();
  if (!user) return { ok: false, message: "Please sign in again." };
  const p = newSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: z.flattenError(p.error).fieldErrors };

  const source = p.data.copyFrom ? (await db.select().from(letterTemplates).where(eq(letterTemplates.id, p.data.copyFrom)).limit(1))[0] : null;
  const sourceVersion = source ? await currentVersion(source.id) : null;

  const newId = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(letterTemplates)
      .values({
        name: p.data.name,
        status: "draft",
        isDefault: false,
        greeting: source?.greeting ?? "Dear ##DIRECTOR_FIRSTNAME#,",
        signOff: source?.signOff ?? "Kind regards,",
        signatoryName: source?.signatoryName ?? null,
        defaultOffer: source?.defaultOffer ?? null,
        callToAction: source?.callToAction ?? null,
      })
      .returning({ id: letterTemplates.id });
    const [v] = await tx
      .insert(templateVersions)
      .values({
        templateId: t.id,
        version: "v1.0",
        summary: source ? `Created from ${source.name} ${sourceVersion?.version ?? ""}`.trim() : "Created from a blank letter",
        contentHtml: sourceVersion?.contentHtml ?? BLANK,
        createdBy: user.id,
      })
      .returning({ id: templateVersions.id });
    await tx.update(letterTemplates).set({ currentVersionId: v.id }).where(eq(letterTemplates.id, t.id));
    return t.id;
  });
  return { ok: true, id: newId, message: `${p.data.name} created as a draft` };
}

export async function duplicateTemplateAction(templateId: string): Promise<TemplateResult> {
  if (!id.safeParse(templateId).success) return { ok: false, message: "Template not found." };
  const [t] = await db.select({ name: letterTemplates.name }).from(letterTemplates).where(eq(letterTemplates.id, templateId)).limit(1);
  if (!t) return { ok: false, message: "Template not found." };
  return createTemplateAction({ name: `Copy of ${t.name}`.slice(0, 120), copyFrom: templateId });
}
