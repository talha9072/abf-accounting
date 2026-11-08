/**
 * Database schema — PostgreSQL via Drizzle ORM.
 *
 * Every change here becomes a versioned SQL migration in /drizzle
 * (`npm run db:generate`). Those .sql files are what you run on the live
 * server (`npm run db:migrate`), so they are committed with the code.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ================================================================== */
/* Auth & users                                                        */
/* ================================================================== */

export const userRole = pgEnum("user_role", ["admin", "staff"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lower-cased + trimmed. */
    email: varchar("email", { length: 254 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    mobile: varchar("mobile", { length: 32 }),
    /** Argon2id PHC string. Never selected into client-facing objects. */
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("staff"),
    status: userStatus("status").notNull().default("active"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    emailOnPullFailure: boolean("email_on_pull_failure").notNull().default(true),
    /** Consecutive failed sign-ins; reset on success. */
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/**
 * Server-side sessions. The cookie holds a random 256-bit token;
 * only its SHA-256 hash is stored here, so a DB leak can't be replayed.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256(token) hex
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    remember: boolean("remember").notNull().default(false),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: varchar("requested_ip", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_reset_token_hash_unique").on(t.tokenHash), index("password_reset_user_idx").on(t.userId)],
);

/** Every sign-in / reset attempt — used for IP + account rate limiting and audit. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 24 }).notNull(), // sign_in | register | reset_request | reset
    email: varchar("email", { length: 254 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("auth_attempts_ip_idx").on(t.ipAddress, t.createdAt),
    index("auth_attempts_email_idx").on(t.email, t.createdAt),
  ],
);

/* ================================================================== */
/* Companies House data                                                */
/* ================================================================== */

export const letterState = pgEnum("letter_state", [
  "not_reviewed",
  "added",
  "printed",
  "posted",
  "excluded",
  "address_issue",
  /** Failed a selection rule (wrong company type, agent address …) — never gets a letter. */
  "skipped",
]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyNumber: varchar("company_number", { length: 16 }).notNull(),
    name: varchar("name", { length: 300 }).notNull(),
    companyType: varchar("company_type", { length: 64 }).notNull(), // ltd, llp, plc …
    companyStatus: varchar("company_status", { length: 32 }).notNull().default("active"),
    /** UK calendar date, "YYYY-MM-DD". */
    incorporatedOn: date("incorporated_on", { mode: "string" }).notNull(),
    sicCodes: jsonb("sic_codes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Registered office exactly as Companies House returned it. */
    registeredOffice: jsonb("registered_office").$type<Address>().notNull(),
    /** Optional override used only for posting (Fix posting address). */
    postingAddress: jsonb("posting_address").$type<Address>(),
    directorFirstName: varchar("director_first_name", { length: 120 }),
    directorFullName: varchar("director_full_name", { length: 240 }),
    letterState: letterState("letter_state").notNull().default("not_reviewed"),
    eligibility: jsonb("eligibility").$type<Record<string, boolean>>(),
    /** First failed rule, e.g. "shared_address" — null when every rule passed. */
    skipReason: varchar("skip_reason", { length: 48 }),
    /** True once officers were fetched (director name filled or confirmed missing). */
    officersFetched: boolean("officers_fetched").notNull().default(false),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    pullId: uuid("pull_id").references(() => pulls.id, { onDelete: "set null" }),
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("companies_number_unique").on(t.companyNumber),
    index("companies_state_idx").on(t.letterState),
    index("companies_incorporated_idx").on(t.incorporatedOn),
    index("companies_pull_idx").on(t.pullId),
  ],
);

export type Address = {
  line1: string;
  line2?: string | null;
  town: string;
  postcode?: string | null;
  country?: string | null;
};

/** Daily (06:00 South Africa time) and manual Companies House pulls. */
export const pulls = pgTable(
  "pulls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: varchar("status", { length: 16 }).notNull(), // running | succeeded | failed
    trigger: varchar("trigger", { length: 16 }).notNull().default("schedule"), // schedule | manual | retry
    /** fetch → rules → officers → done */
    stage: varchar("stage", { length: 16 }).notNull().default("fetch"),
    /** Incorporation dates covered (UK dates, inclusive). */
    fromDate: date("from_date", { mode: "string" }).notNull(),
    toDate: date("to_date", { mode: "string" }).notNull(),
    pagesTotal: integer("pages_total"),
    pagesDone: integer("pages_done").notNull().default(0),
    companiesFound: integer("companies_found").notNull().default(0),
    companiesNew: integer("companies_new").notNull().default(0),
    companiesEligible: integer("companies_eligible").notNull().default(0),
    officersTotal: integer("officers_total").notNull().default(0),
    officersDone: integer("officers_done").notNull().default(0),
    /** Attempt number for this day's pull (1 = first try). */
    attempt: integer("attempt").notNull().default(1),
    /** Kept for compatibility with earlier code; equals attempt - 1. */
    retries: integer("retries").notNull().default(0),
    error: text("error"),
    failureEmailedAt: timestamp("failure_emailed_at", { withTimezone: true }),
    startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("pulls_started_idx").on(t.startedAt), index("pulls_status_idx").on(t.status)],
);

/** Do-not-contact list (Exclude). */
export const exclusions = pgTable(
  "exclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyNumber: varchar("company_number", { length: 16 }),
    companyName: varchar("company_name", { length: 300 }),
    reason: varchar("reason", { length: 300 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("exclusions_number_idx").on(t.companyNumber)],
);

/* ================================================================== */
/* Letters                                                             */
/* ================================================================== */

export const templateStatus = pgEnum("template_status", ["active", "draft", "archived"]);

export const letterTemplates = pgTable("letter_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  status: templateStatus("status").notNull().default("draft"),
  isDefault: boolean("is_default").notNull().default(false),
  greeting: varchar("greeting", { length: 200 }).notNull().default("Dear ##DIRECTOR_FIRSTNAME#,"),
  signOff: varchar("sign_off", { length: 200 }).notNull().default("Kind regards,"),
  defaultOffer: varchar("default_offer", { length: 200 }),
  callToAction: varchar("call_to_action", { length: 200 }),
  /** Name printed under the sign-off, e.g. "Lekan". */
  signatoryName: varchar("signatory_name", { length: 120 }),
  currentVersionId: uuid("current_version_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templateVersions = pgTable(
  "template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => letterTemplates.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 16 }).notNull(), // v3.4
    summary: varchar("summary", { length: 200 }).notNull(),
    /** Sanitised HTML from the editor, with ##CODE# placeholders. */
    contentHtml: text("content_html").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("template_versions_template_idx").on(t.templateId)],
);

export const printRuns = pgTable(
  "print_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 16 }).notNull(), // PR-0811-01
    templateVersionId: uuid("template_version_id").references(() => templateVersions.id, { onDelete: "set null" }),
    /** "Welcome Letter v3" — kept even if the template is renamed later. */
    templateName: varchar("template_name", { length: 120 }),
    /** printed → confirmed (letters marked sent) · or cancelled */
    status: varchar("status", { length: 16 }).notNull().default("printed"),
    letterCount: integer("letter_count").notNull().default(0),
    printedBy: uuid("printed_by").references(() => users.id, { onDelete: "set null" }),
    printedAt: timestamp("printed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    labelsPrintedAt: timestamp("labels_printed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("print_runs_reference_unique").on(t.reference), index("print_runs_status_idx").on(t.status)],
);

/** Everything printed on one letter, frozen at print time so a reprint is identical. */
export type LetterSnapshot = {
  companyName: string;
  companyNumber: string;
  directorFullName: string | null;
  directorFirstName: string | null;
  addressLines: string[];
  incorporatedOn: string;
  letterDate: string; // YYYY-MM-DD
  /** Merged + sanitised body HTML. */
  bodyHtml: string;
  greeting: string;
  signOff: string;
  signatory: string | null;
  offer: string | null;
  cta: string | null;
  qrUrl: string | null;
};

export const printRunItems = pgTable(
  "print_run_items",
  {
    printRunId: uuid("print_run_id")
      .notNull()
      .references(() => printRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reference: varchar("reference", { length: 32 }).notNull(), // ABF-17840124
    addressSnapshot: jsonb("address_snapshot").$type<Address>().notNull(),
    letter: jsonb("letter").$type<LetterSnapshot>(),
  },
  (t) => [primaryKey({ columns: [t.printRunId, t.companyId] }), index("print_run_items_company_idx").on(t.companyId)],
);

/* ================================================================== */
/* Notes, activity, notifications                                      */
/* ================================================================== */

export const companyNotes = pgTable(
  "company_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("company_notes_company_idx").on(t.companyId)],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 48 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    detail: varchar("detail", { length: 300 }),
    createdAt: createdAt(),
  },
  (t) => [index("activity_company_idx").on(t.companyId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    detail: varchar("detail", { length: 300 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Business details used by ##BRAND_*# codes, letterhead and footer. */
export const businessSettings = pgTable("business_settings", {
  id: integer("id").primaryKey().default(1),
  brandName: varchar("brand_name", { length: 200 }).notNull(),
  addressLine: varchar("address_line", { length: 300 }).notNull(),
  supportTelephone: varchar("support_telephone", { length: 40 }),
  supportEmail: varchar("support_email", { length: 254 }),
  website: varchar("website", { length: 200 }),
  referencePrefix: varchar("reference_prefix", { length: 16 }).notNull().default("ABF-"),
  qrLink: varchar("qr_link", { length: 300 }),
  registrationLine: varchar("registration_line", { length: 400 }),
  updatedAt: updatedAt(),
});
