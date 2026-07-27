CREATE TABLE "pipeline_revival_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"contact_id" text,
	"opportunity_name" text,
	"strategy" text NOT NULL,
	"steps" jsonb NOT NULL,
	"outreach_script" text NOT NULL,
	"recommended_follow_up_days" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_reminder_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"send_time" varchar(5) DEFAULT '08:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_reminder_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "last_negative_generation_explanation" text;--> statement-breakpoint
ALTER TABLE "briefing_settings" ADD COLUMN "only_active_accounts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "auto_add_accounts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "auto_sync_scope" text DEFAULT 'ALL' NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "negative_keyword_broad_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "negative_keyword_phrase_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD COLUMN "negative_keyword_exact_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ADD COLUMN "ad_group_id" text;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ADD COLUMN "ad_group_name" text;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ADD COLUMN "trigger_campaign_id" text;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ADD COLUMN "trigger_campaign_name" text;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "welcome_email_reply_to" text;--> statement-breakpoint
CREATE INDEX "pipeline_revival_plans_opportunity_idx" ON "pipeline_revival_plans" USING btree ("opportunity_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "ai_usage_settings" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "client_onboardings" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "google_ads_connections" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "organization_onboarding_settings" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));