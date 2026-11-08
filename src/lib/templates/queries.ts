import "server-only";
import { asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, letterTemplates, printRuns, templateVersions, users } from "@/lib/db/schema";
import { listPrintableTemplates } from "@/lib/letters/data";
import { sanitizeTemplateHtml } from "@/lib/letters/html";
import { formatDate } from "@/lib/companies/format";
import { dateInTz, formatSaTime, SCHEDULE_TZ } from "@/lib/pull/dates";

export type TemplateStatus = "active" | "draft" | "archived";

export type TemplateListItem = {
  id: string;
  name: string;
  status: TemplateStatus;
  isDefault: boolean;
  usage: string;
  edited: string;
};

function editedLabel(d: Date, archived: boolean) {
  const today = dateInTz(new Date(), SCHEDULE_TZ);
  const day = dateInTz(d, SCHEDULE_TZ);
  const label = day === today ? "today" : formatDate(day).replace(/ \d{4}$/, "");
  return `${archived ? "Archived" : "Edited"} ${label}`;
}

/** All templates, default first, archived last. Creates the default template on a fresh database. */
export async function listTemplates(): Promise<TemplateListItem[]> {
  await listPrintableTemplates(); // ensures "Welcome Letter v3" exists
  const rows = await db.select().from(letterTemplates).orderBy(desc(letterTemplates.isDefault), asc(letterTemplates.name));
  const used = await db
    .selectDistinct({ id: templateVersions.templateId })
    .from(printRuns)
    .innerJoin(templateVersions, eq(printRuns.templateVersionId, templateVersions.id))
    .where(ne(printRuns.status, "cancelled"));
  const usedIds = new Set(used.map((u) => u.id));
  const order = { active: 0, draft: 1, archived: 2 } as const;
  return rows
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || order[a.status] - order[b.status] || a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      isDefault: t.isDefault,
      usage:
        t.status === "archived"
          ? "Read-only"
          : t.isDefault
            ? "Default · used for every print run"
            : t.status === "draft"
              ? usedIds.has(t.id)
                ? "Draft · used before"
                : "Not used"
              : "Available",
      edited: editedLabel(t.updatedAt, t.status === "archived"),
    }));
}

export async function defaultTemplateId(): Promise<string | null> {
  const list = await listTemplates();
  return list.find((t) => t.isDefault)?.id ?? list[0]?.id ?? null;
}

export type TemplateVersionItem = {
  id: string;
  version: string;
  summary: string;
  meta: string;
  current: boolean;
  contentHtml: string;
};

export async function getTemplateDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [t] = await db.select().from(letterTemplates).where(eq(letterTemplates.id, id)).limit(1);
  if (!t) return null;

  const versions = await db
    .select({
      id: templateVersions.id,
      version: templateVersions.version,
      summary: templateVersions.summary,
      contentHtml: templateVersions.contentHtml,
      createdAt: templateVersions.createdAt,
      first: users.firstName,
      last: users.lastName,
    })
    .from(templateVersions)
    .leftJoin(users, eq(templateVersions.createdBy, users.id))
    .where(eq(templateVersions.templateId, id))
    .orderBy(desc(templateVersions.createdAt));

  const current = versions.find((v) => v.id === t.currentVersionId) ?? versions[0];
  const today = dateInTz(new Date(), SCHEDULE_TZ);

  return {
    id: t.id,
    name: t.name,
    status: t.status as TemplateStatus,
    isDefault: t.isDefault,
    greeting: t.greeting,
    signOff: t.signOff,
    signatory: t.signatoryName ?? "",
    offer: t.defaultOffer ?? "",
    cta: t.callToAction ?? "",
    version: current?.version ?? "v1.0",
    contentHtml: sanitizeTemplateHtml(current?.contentHtml ?? ""),
    versions: versions.map(
      (v): TemplateVersionItem => ({
        id: v.id,
        version: v.version,
        summary: v.summary,
        meta: [
          v.first ? `${v.first} ${v.last ?? ""}`.trim() : "System",
          dateInTz(v.createdAt, SCHEDULE_TZ) === today ? `Today ${formatSaTime(v.createdAt)}` : formatDate(v.createdAt.toISOString()),
          v.id === current?.id ? "Current" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        current: v.id === current?.id,
        contentHtml: sanitizeTemplateHtml(v.contentHtml),
      }),
    ),
  };
}

export type TemplateDetail = NonNullable<Awaited<ReturnType<typeof getTemplateDetail>>>;

/** A real company to preview letters with (falls back to design sample data). */
export async function getPreviewCompany() {
  const [c] = await db
    .select({
      name: companies.name,
      companyNumber: companies.companyNumber,
      directorFirstName: companies.directorFirstName,
      directorFullName: companies.directorFullName,
      incorporatedOn: companies.incorporatedOn,
      registeredOffice: companies.registeredOffice,
      postingAddress: companies.postingAddress,
    })
    .from(companies)
    .where(inArray(companies.letterState, ["added", "not_reviewed", "printed", "posted"]))
    .orderBy(desc(companies.incorporatedOn))
    .limit(1);
  return (
    c ?? {
      name: "Northfield Studio Labs Ltd",
      companyNumber: "17840124",
      directorFirstName: "Sarah",
      directorFullName: "Sarah Ahmed",
      incorporatedOn: "2026-09-22",
      registeredOffice: { line1: "18 Loom Street", town: "Manchester", postcode: "M1 2AB" },
      postingAddress: null,
    }
  );
}
