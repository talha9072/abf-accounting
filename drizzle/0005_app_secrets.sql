CREATE TABLE "app_secrets" (
	"name" varchar(48) PRIMARY KEY NOT NULL,
	"value_enc" varchar(600) NOT NULL,
	"hint" varchar(8) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_secrets" ADD CONSTRAINT "app_secrets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;