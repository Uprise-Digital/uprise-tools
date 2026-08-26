CREATE TABLE "mcp_keys" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"scopes" jsonb DEFAULT '["read:analytics","run:audits","write:negatives"]'::jsonb NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "mcp_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mcp_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"key_id" varchar(36),
	"user_id" text,
	"tool_name" text NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_usage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_ad_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" integer,
	"meta_account_id" text NOT NULL,
	"name" text NOT NULL,
	"currency_code" text DEFAULT 'USD',
	"time_zone" text DEFAULT 'Australia/Melbourne',
	"is_active" boolean DEFAULT true NOT NULL,
	"account_status" integer DEFAULT 1 NOT NULL,
	"last_synced_at" timestamp DEFAULT now(),
	"sync_status" text,
	"sync_error" text,
	"target_cpa" numeric(10, 2),
	"target_roas" numeric(5, 2),
	"monthly_budget_cap" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_ad_accounts_meta_account_id_unique" UNIQUE("meta_account_id")
);
--> statement-breakpoint
ALTER TABLE "meta_ad_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "meta_ads_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connected_email" text NOT NULL,
	"meta_user_id" text,
	"business_id" text,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"access_level" text DEFAULT 'read_only' NOT NULL,
	"error_message" text,
	"auto_add_accounts" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meta_ads_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agency_ai_insights_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "unique_agency_ai_cache_record";--> statement-breakpoint
ALTER TABLE "agency_ai_insights_cache" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_connection_id_meta_ads_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_ads_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_ads_connections" ADD CONSTRAINT "meta_ads_connections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_agency_ai_cache_record" ON "agency_ai_insights_cache" USING btree ("organization_id","start_date","end_date");--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "agency_ai_insights_cache" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "mcp_keys" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "mcp_usage_logs" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "meta_ad_accounts" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "meta_ads_connections" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));