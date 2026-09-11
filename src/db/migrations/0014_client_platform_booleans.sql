ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "google_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "meta_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "google_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD COLUMN IF NOT EXISTS "meta_enabled" boolean DEFAULT true NOT NULL;
