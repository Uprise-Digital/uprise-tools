CREATE TABLE "ai_model_pricing" (
	"model_name" text PRIMARY KEY NOT NULL,
	"input_cost_per_million" numeric(10, 6) NOT NULL,
	"output_cost_per_million" numeric(10, 6) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"monthly_budget_limit" numeric(10, 2) DEFAULT '50.00' NOT NULL,
	"soft_limit_percentage" integer DEFAULT 80 NOT NULL,
	"hard_limit_blocked" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_onboardings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ghl_contact_id" text,
	"ghl_opportunity_id" text,
	"client_name" text NOT NULL,
	"primary_contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"google_ads_access" boolean DEFAULT true NOT NULL,
	"meta_ads_access" boolean DEFAULT true NOT NULL,
	"drive_folder_link" text,
	"notion_dashboard_link" text,
	"signal_group_link" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"google_ads_status" text DEFAULT 'pending' NOT NULL,
	"meta_ads_status" text DEFAULT 'pending' NOT NULL,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_onboardings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_onboarding_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"google_drive_enabled" boolean DEFAULT false NOT NULL,
	"google_drive_parent_folder_id" text,
	"google_drive_template_folder_id" text,
	"google_drive_refresh_token" text,
	"google_drive_email" text,
	"google_drive_status" text DEFAULT 'unconfigured' NOT NULL,
	"google_drive_error" text,
	"notion_enabled" boolean DEFAULT false NOT NULL,
	"notion_api_key" text,
	"notion_parent_page_id" text,
	"notion_template_page_id" text,
	"notion_status" text DEFAULT 'unconfigured' NOT NULL,
	"notion_error" text,
	"welcome_email_subject" text,
	"welcome_email_template" text,
	"workflow_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_onboarding_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_triage_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_group_ad_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "background_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "briefing_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_landing_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "landing_page_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_triage_defaults" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "threat_matrix_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mcp_settings" DROP CONSTRAINT "mcp_settings_agency_id_unique";--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "client_onboarding_id" integer;--> statement-breakpoint
ALTER TABLE "campaign_landing_pages" ADD COLUMN "status" text DEFAULT 'ENABLED' NOT NULL;--> statement-breakpoint
ALTER TABLE "landing_page_audits" ADD COLUMN "audit_type" text DEFAULT 'PAGE_SOURCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "landing_page_audits" ADD COLUMN "screenshot_url" text;--> statement-breakpoint
ALTER TABLE "landing_page_audits" ADD COLUMN "screenshot_mobile_url" text;--> statement-breakpoint
ALTER TABLE "mcp_settings" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_settings" ADD CONSTRAINT "ai_usage_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD CONSTRAINT "client_onboardings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD CONSTRAINT "organization_onboarding_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_client_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("client_onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_settings" DROP COLUMN "agency_id";--> statement-breakpoint
ALTER TABLE "mcp_settings" ADD CONSTRAINT "mcp_settings_organization_id_unique" UNIQUE("organization_id");--> statement-breakpoint
ALTER TABLE "client_onboardings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "client_onboardings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "organization_onboarding_settings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
ALTER TABLE "ai_usage_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "ai_usage_settings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));