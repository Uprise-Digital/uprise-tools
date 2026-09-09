CREATE TABLE IF NOT EXISTS "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"legal_business_name" text,
	"industry" text DEFAULT 'OTHER' NOT NULL,
	"sub_niche" text,
	"website_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"drive_folder_link" text,
	"notion_dashboard_link" text,
	"signal_group_link" text,
	"ghl_sub_account_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" integer,
	"ghl_contact_id" text,
	"ghl_opportunity_id" text,
	"first_name" text,
	"last_name" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"job_title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"pipeline_stage" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer;
--> statement-breakpoint
ALTER TABLE "meta_ad_accounts" ADD COLUMN IF NOT EXISTS "client_id" integer;
--> statement-breakpoint
ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "client_id" integer;
--> statement-breakpoint
ALTER TABLE "call_records" ADD COLUMN IF NOT EXISTS "contact_id" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_client_id_idx" ON "contacts"("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_ghl_contact_id_idx" ON "contacts"("ghl_contact_id");
