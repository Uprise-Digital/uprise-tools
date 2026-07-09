CREATE TABLE "account_triage_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer NOT NULL,
	"critical_spend_threshold" double precision,
	"critical_conversions_threshold" integer,
	"ctr_high_threshold" double precision,
	"ctr_high_spend_threshold" double precision,
	"cpc_high_threshold" double precision,
	"anomaly_spend_change_threshold" double precision,
	"anomaly_conversions_change_threshold" double precision,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_triage_settings_ad_account_id_unique" UNIQUE("ad_account_id")
);
--> statement-breakpoint
CREATE TABLE "ad_group_ad_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"ad_group_id" text NOT NULL,
	"ad_group_name" text NOT NULL,
	"ad_id" text NOT NULL,
	"search_term" text NOT NULL,
	"score" integer NOT NULL,
	"ad_strength" text NOT NULL,
	"message_match_score" integer DEFAULT 0 NOT NULL,
	"ai_analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefing_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"send_time" varchar(5) DEFAULT '07:00' NOT NULL,
	"data_points" jsonb DEFAULT '{"spend":true,"conversions":true,"cpa":true,"clicks":true,"impressions":true,"ctr":true,"cpc":true,"anomalies":true,"whaleAnalysis":true}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_landing_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"email_type" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"resend_id" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_ads_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connected_email" text NOT NULL,
	"manager_customer_id" text NOT NULL,
	"refresh_token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"inviterId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_page_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"url" text NOT NULL,
	"search_term" text NOT NULL,
	"score" integer NOT NULL,
	"hero_score" integer DEFAULT 0 NOT NULL,
	"cta_score" integer DEFAULT 0 NOT NULL,
	"trust_score" integer DEFAULT 0 NOT NULL,
	"mobile_score" integer DEFAULT 0 NOT NULL,
	"copy_score" integer DEFAULT 0 NOT NULL,
	"seo_score" integer DEFAULT 0 NOT NULL,
	"design_score" integer DEFAULT 0 NOT NULL,
	"flow_score" integer DEFAULT 0 NOT NULL,
	"market_fit_score" integer DEFAULT 0 NOT NULL,
	"tech_score" integer DEFAULT 0 NOT NULL,
	"ai_analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negative_keyword_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"ad_account_id" integer NOT NULL,
	"keyword" text NOT NULL,
	"match_type" text DEFAULT 'phrase' NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"search_query" text,
	"clicks" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"conversions" numeric(10, 2) DEFAULT '0' NOT NULL,
	"suggested_at" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "org_triage_defaults" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"critical_spend_threshold" double precision DEFAULT 70 NOT NULL,
	"critical_conversions_threshold" integer DEFAULT 0 NOT NULL,
	"ctr_high_threshold" double precision DEFAULT 7 NOT NULL,
	"ctr_high_spend_threshold" double precision DEFAULT 50 NOT NULL,
	"cpc_high_threshold" double precision DEFAULT 30 NOT NULL,
	"anomaly_spend_change_threshold" double precision DEFAULT -30 NOT NULL,
	"anomaly_conversions_change_threshold" double precision DEFAULT -25 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"metadata" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"stripe_subscription_ends_at" timestamp,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"action_type" text NOT NULL,
	"units_used" integer DEFAULT 1 NOT NULL,
	"estimated_cost" numeric(10, 6) DEFAULT '0.000000' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "organization_id" text DEFAULT 'default-org' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "connection_id" integer;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "sync_status" text;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "include_in_briefing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "negative_keyword_turbo_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "organization_id" text DEFAULT 'default-org' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" text DEFAULT 'default-org' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD COLUMN "organization_id" text DEFAULT 'default-org' NOT NULL;--> statement-breakpoint
ALTER TABLE "threat_matrix_audits" ADD COLUMN "organization_id" text DEFAULT 'default-org' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_triage_settings" ADD CONSTRAINT "account_triage_settings_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_group_ad_audits" ADD CONSTRAINT "ad_group_ad_audits_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_landing_pages" ADD CONSTRAINT "campaign_landing_pages_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_connections" ADD CONSTRAINT "google_ads_connections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_page_audits" ADD CONSTRAINT "landing_page_audits_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_keyword_suggestions" ADD CONSTRAINT "negative_keyword_suggestions_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_campaign_lp" ON "campaign_landing_pages" USING btree ("ad_account_id","campaign_id");--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_connection_id_google_ads_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."google_ads_connections"("id") ON DELETE cascade ON UPDATE no action;