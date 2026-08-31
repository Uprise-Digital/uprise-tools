ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "industry" text DEFAULT 'OTHER' NOT NULL;--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "sub_niche" text;
