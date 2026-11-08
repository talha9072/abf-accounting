ALTER TABLE "print_runs" ALTER COLUMN "status" SET DEFAULT 'printed';--> statement-breakpoint
ALTER TABLE "letter_templates" ADD COLUMN "signatory_name" varchar(120);--> statement-breakpoint
ALTER TABLE "print_run_items" ADD COLUMN "letter" jsonb;--> statement-breakpoint
ALTER TABLE "print_runs" ADD COLUMN "template_name" varchar(120);--> statement-breakpoint
ALTER TABLE "print_runs" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "print_run_items_company_idx" ON "print_run_items" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "print_runs_reference_unique" ON "print_runs" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "print_runs_status_idx" ON "print_runs" USING btree ("status");