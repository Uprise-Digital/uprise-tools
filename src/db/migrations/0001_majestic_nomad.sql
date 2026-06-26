CREATE TABLE "ad_performance_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_account_id" integer NOT NULL,
	"google_account_id" text NOT NULL,
	"date" date NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_ai_insights_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"insights" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insights_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_account_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"insights" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"agency_id" integer NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"tools_config" jsonb DEFAULT '{"godView":true,"campaignDiagnostics":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_settings_agency_id_unique" UNIQUE("agency_id"),
	CONSTRAINT "mcp_settings_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "threat_matrix_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_account_id" integer NOT NULL,
	"search_term" text NOT NULL,
	"client_url_scraped" text NOT NULL,
	"competitor_urls_scraped" jsonb NOT NULL,
	"ai_analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD COLUMN "custom_ai_instructions" text;--> statement-breakpoint
ALTER TABLE "ad_performance_daily" ADD CONSTRAINT "ad_performance_daily_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights_cache" ADD CONSTRAINT "ai_insights_cache_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threat_matrix_audits" ADD CONSTRAINT "threat_matrix_audits_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_daily_campaign_record" ON "ad_performance_daily" USING btree ("ad_account_id","date","campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_agency_ai_cache_record" ON "agency_ai_insights_cache" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_ai_cache_record" ON "ai_insights_cache" USING btree ("ad_account_id","start_date","end_date");