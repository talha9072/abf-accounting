ALTER TYPE "public"."letter_state" ADD VALUE 'skipped';--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "incorporated_on" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pulls" ALTER COLUMN "from_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "pulls" ALTER COLUMN "to_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "skip_reason" varchar(48);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "officers_fetched" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "stage" varchar(16) DEFAULT 'fetch' NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "companies_new" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "companies_eligible" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "officers_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "officers_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "failure_emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "started_by" uuid;--> statement-breakpoint
ALTER TABLE "pulls" ADD COLUMN "heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pulls" ADD CONSTRAINT "pulls_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_pull_idx" ON "companies" USING btree ("pull_id");--> statement-breakpoint
CREATE INDEX "pulls_started_idx" ON "pulls" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "pulls_status_idx" ON "pulls" USING btree ("status");