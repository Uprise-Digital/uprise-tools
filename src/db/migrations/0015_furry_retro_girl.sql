CREATE TABLE "ad_account_share_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"ad_account_id" integer NOT NULL,
	"organization_id" text NOT NULL,
	"token" varchar(16) NOT NULL,
	"pin_code" text,
	"is_pin_required" boolean DEFAULT false NOT NULL,
	"theme_color" varchar(32) DEFAULT 'violet' NOT NULL,
	"allowed_channels" varchar(32) DEFAULT 'all' NOT NULL,
	"visible_charts" jsonb DEFAULT '["spend","cpc","ctr"]'::jsonb NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_account_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "analyst_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New Analysis' NOT NULL,
	"ad_account_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyst_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "analyst_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_pulse_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"pulse_date" text NOT NULL,
	"risk_score" integer NOT NULL,
	"sentiment" text NOT NULL,
	"primary_factor" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_pulse_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "client_report_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"is_globally_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_report_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weekly_client_report_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text DEFAULT 'default-org' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"send_day_of_week" text DEFAULT 'monday' NOT NULL,
	"send_time" varchar(5) DEFAULT '08:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"include_risk_watchlist" boolean DEFAULT true NOT NULL,
	"include_performance_metrics" boolean DEFAULT true NOT NULL,
	"include_sentiment_prompt" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_client_report_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "background_tasks" ADD COLUMN "total_items" integer;--> statement-breakpoint
ALTER TABLE "background_tasks" ADD COLUMN "completed_items" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "background_tasks" ADD COLUMN "current_item" text;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN "google_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN "meta_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "meta_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_agency_api_key" text;--> statement-breakpoint
ALTER TABLE "ad_account_share_links" ADD CONSTRAINT "ad_account_share_links_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_account_share_links" ADD CONSTRAINT "ad_account_share_links_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyst_conversations" ADD CONSTRAINT "analyst_conversations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyst_conversations" ADD CONSTRAINT "analyst_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyst_conversations" ADD CONSTRAINT "analyst_conversations_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyst_messages" ADD CONSTRAINT "analyst_messages_conversation_id_analyst_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."analyst_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_pulse_ratings" ADD CONSTRAINT "client_pulse_ratings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_pulse_ratings" ADD CONSTRAINT "client_pulse_ratings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_pulse_ratings" ADD CONSTRAINT "client_pulse_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_account_share_links_token_idx" ON "ad_account_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "ad_account_share_links_account_idx" ON "ad_account_share_links" USING btree ("ad_account_id");--> statement-breakpoint
CREATE INDEX "analyst_conv_org_idx" ON "analyst_conversations" USING btree (organization_id);--> statement-breakpoint
CREATE INDEX "analyst_conv_user_idx" ON "analyst_conversations" USING btree (user_id);--> statement-breakpoint
CREATE INDEX "analyst_conv_updated_idx" ON "analyst_conversations" USING btree (updated_at);--> statement-breakpoint
CREATE INDEX "analyst_msg_conv_idx" ON "analyst_messages" USING btree (conversation_id);--> statement-breakpoint
CREATE INDEX "analyst_msg_created_idx" ON "analyst_messages" USING btree (created_at);--> statement-breakpoint
CREATE INDEX "pulse_client_date_idx" ON "client_pulse_ratings" USING btree ("client_id","pulse_date");--> statement-breakpoint
CREATE INDEX "pulse_org_idx" ON "client_pulse_ratings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pulse_user_idx" ON "client_pulse_ratings" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "analyst_conversations" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "client_pulse_ratings" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));