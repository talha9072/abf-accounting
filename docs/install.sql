-- ABF New Companies — database install (all tables), generated from /drizzle.
--
-- Run ONCE on a new, EMPTY PostgreSQL database (PostgreSQL 14 or newer), for example:
--   psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f install.sql
-- or paste it into pgAdmin / your host's SQL tool and run it.
--
-- It is the same as running `npm run db:migrate` — do one or the other, not both.
-- No data is inserted: the default letter template and business settings are created by the
-- app the first time it opens. Later updates: `npm run db:migrate` applies only newer files.

BEGIN;

-- ─── 0000_init ───────────────────────────────────────────
CREATE TYPE "public"."letter_state" AS ENUM('not_reviewed', 'added', 'printed', 'posted', 'excluded', 'address_issue');
CREATE TYPE "public"."template_status" AS ENUM('active', 'draft', 'archived');
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff');
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"actor_id" uuid,
	"kind" varchar(48) NOT NULL,
	"title" varchar(200) NOT NULL,
	"detail" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(24) NOT NULL,
	"email" varchar(254),
	"ip_address" varchar(64),
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "business_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"brand_name" varchar(200) NOT NULL,
	"address_line" varchar(300) NOT NULL,
	"support_telephone" varchar(40),
	"support_email" varchar(254),
	"website" varchar(200),
	"reference_prefix" varchar(16) DEFAULT 'ABF-' NOT NULL,
	"qr_link" varchar(300),
	"registration_line" varchar(400),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_number" varchar(16) NOT NULL,
	"name" varchar(300) NOT NULL,
	"company_type" varchar(64) NOT NULL,
	"company_status" varchar(32) DEFAULT 'active' NOT NULL,
	"incorporated_on" timestamp NOT NULL,
	"sic_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"registered_office" jsonb NOT NULL,
	"posting_address" jsonb,
	"director_first_name" varchar(120),
	"director_full_name" varchar(240),
	"letter_state" "letter_state" DEFAULT 'not_reviewed' NOT NULL,
	"eligibility" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pull_id" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "company_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_number" varchar(16),
	"company_name" varchar(300),
	"reason" varchar(300),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "letter_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" "template_status" DEFAULT 'draft' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"greeting" varchar(200) DEFAULT 'Dear ##DIRECTOR_FIRSTNAME#,' NOT NULL,
	"sign_off" varchar(200) DEFAULT 'Kind regards,' NOT NULL,
	"default_offer" varchar(200),
	"call_to_action" varchar(200),
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" varchar(32) NOT NULL,
	"title" varchar(200) NOT NULL,
	"detail" varchar(300),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"requested_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "print_run_items" (
	"print_run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"reference" varchar(32) NOT NULL,
	"address_snapshot" jsonb NOT NULL,
	CONSTRAINT "print_run_items_print_run_id_company_id_pk" PRIMARY KEY("print_run_id","company_id")
);
CREATE TABLE "print_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(16) NOT NULL,
	"template_version_id" uuid,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"letter_count" integer DEFAULT 0 NOT NULL,
	"printed_by" uuid,
	"printed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"labels_printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "pulls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar(16) NOT NULL,
	"trigger" varchar(16) DEFAULT 'schedule' NOT NULL,
	"from_date" timestamp NOT NULL,
	"to_date" timestamp NOT NULL,
	"pages_total" integer,
	"pages_done" integer DEFAULT 0 NOT NULL,
	"companies_found" integer DEFAULT 0 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(512),
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" varchar(16) NOT NULL,
	"summary" varchar(200) NOT NULL,
	"content_html" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"mobile" varchar(32),
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"email_on_pull_failure" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "companies" ADD CONSTRAINT "companies_pull_id_pulls_id_fk" FOREIGN KEY ("pull_id") REFERENCES "public"."pulls"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "print_run_items" ADD CONSTRAINT "print_run_items_print_run_id_print_runs_id_fk" FOREIGN KEY ("print_run_id") REFERENCES "public"."print_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "print_run_items" ADD CONSTRAINT "print_run_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."template_versions"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_printed_by_users_id_fk" FOREIGN KEY ("printed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_letter_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."letter_templates"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "activity_company_idx" ON "activity_events" USING btree ("company_id","created_at");
CREATE INDEX "auth_attempts_ip_idx" ON "auth_attempts" USING btree ("ip_address","created_at");
CREATE INDEX "auth_attempts_email_idx" ON "auth_attempts" USING btree ("email","created_at");
CREATE UNIQUE INDEX "companies_number_unique" ON "companies" USING btree ("company_number");
CREATE INDEX "companies_state_idx" ON "companies" USING btree ("letter_state");
CREATE INDEX "companies_incorporated_idx" ON "companies" USING btree ("incorporated_on");
CREATE INDEX "company_notes_company_idx" ON "company_notes" USING btree ("company_id");
CREATE INDEX "exclusions_number_idx" ON "exclusions" USING btree ("company_number");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "password_reset_token_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX "template_versions_template_idx" ON "template_versions" USING btree ("template_id");
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");

-- ─── 0001_pulls_v2 ───────────────────────────────────────────
ALTER TYPE "public"."letter_state" ADD VALUE 'skipped';
ALTER TABLE "companies" ALTER COLUMN "incorporated_on" SET DATA TYPE date;
ALTER TABLE "pulls" ALTER COLUMN "from_date" SET DATA TYPE date;
ALTER TABLE "pulls" ALTER COLUMN "to_date" SET DATA TYPE date;
ALTER TABLE "companies" ADD COLUMN "skip_reason" varchar(48);
ALTER TABLE "companies" ADD COLUMN "officers_fetched" boolean DEFAULT false NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "stage" varchar(16) DEFAULT 'fetch' NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "companies_new" integer DEFAULT 0 NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "companies_eligible" integer DEFAULT 0 NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "officers_total" integer DEFAULT 0 NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "officers_done" integer DEFAULT 0 NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;
ALTER TABLE "pulls" ADD COLUMN "failure_emailed_at" timestamp with time zone;
ALTER TABLE "pulls" ADD COLUMN "started_by" uuid;
ALTER TABLE "pulls" ADD COLUMN "heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "pulls" ADD CONSTRAINT "pulls_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "companies_pull_idx" ON "companies" USING btree ("pull_id");
CREATE INDEX "pulls_started_idx" ON "pulls" USING btree ("started_at");
CREATE INDEX "pulls_status_idx" ON "pulls" USING btree ("status");

-- ─── 0002_print_runs ───────────────────────────────────────────
ALTER TABLE "print_runs" ALTER COLUMN "status" SET DEFAULT 'printed';
ALTER TABLE "letter_templates" ADD COLUMN "signatory_name" varchar(120);
ALTER TABLE "print_run_items" ADD COLUMN "letter" jsonb;
ALTER TABLE "print_runs" ADD COLUMN "template_name" varchar(120);
ALTER TABLE "print_runs" ADD COLUMN "cancelled_at" timestamp with time zone;
CREATE INDEX "print_run_items_company_idx" ON "print_run_items" USING btree ("company_id");
CREATE UNIQUE INDEX "print_runs_reference_unique" ON "print_runs" USING btree ("reference");
CREATE INDEX "print_runs_status_idx" ON "print_runs" USING btree ("status");

-- ─── 0003_notifications_seen ───────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN "notifications_seen_at" timestamp with time zone;

-- ─── 0004_two_factor ───────────────────────────────────────────
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "trusted_devices" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" varchar(512),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "two_factor_challenges" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"next_path" varchar(512),
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "users" ADD COLUMN "totp_secret" text;
ALTER TABLE "users" ADD COLUMN "totp_pending_secret" text;
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer;
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "recovery_codes_user_idx" ON "recovery_codes" USING btree ("user_id");
CREATE INDEX "trusted_devices_user_idx" ON "trusted_devices" USING btree ("user_id");
CREATE INDEX "two_factor_challenges_user_idx" ON "two_factor_challenges" USING btree ("user_id");

-- ─── 0005_app_secrets ───────────────────────────────────────────
CREATE TABLE "app_secrets" (
	"name" varchar(48) PRIMARY KEY NOT NULL,
	"value_enc" varchar(600) NOT NULL,
	"hint" varchar(8) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "app_secrets" ADD CONSTRAINT "app_secrets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- ─── Migration record (lets `npm run db:migrate` skip what is already installed) ───
CREATE SCHEMA IF NOT EXISTS "drizzle";
CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES
  ('ed314da9286e2ade0cbc24a33006a3db0bb90626075e3342302a152e0a92f419', 1793818950786),
  ('06af21ba5b85038ed4a6491602405309b81a4843b8bfa110554f10900417678e', 1793885934954),
  ('5c93907a0363fca6887066aa7d4b5f2cd950a5223bf586e29442e973810cdf07', 1794145179455),
  ('41c329523aab8acf725e2c98404353a8dfe52e26c28b59138467f80b5467713f', 1794146499597),
  ('99a143f2b5ac98506a4d6e0aba224391ce6fdc0934809b4e6adf9832af80c79f', 1794938803295),
  ('87c24a13dee92bf549764c253132a051abd39db67d102dc73f576991e525be73', 1795528863361);

COMMIT;
