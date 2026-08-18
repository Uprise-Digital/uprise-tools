CREATE TABLE "organization_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"template_key" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_email_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN "ghl_sub_account_id" text;--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN "ghl_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN "ghl_error" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "brand_name" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "email_signature" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_api_key" text;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_location_id" text;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_company_id" text;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_status" text DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_onboarding_settings" ADD COLUMN "ghl_error" text;--> statement-breakpoint
ALTER TABLE "organization_email_templates" ADD CONSTRAINT "organization_email_templates_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "ad_accounts" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "organization_email_templates" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true));