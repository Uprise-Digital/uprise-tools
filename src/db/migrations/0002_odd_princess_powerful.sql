ALTER TABLE "ad_accounts" ADD COLUMN "target_cpa" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "target_roas" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "monthly_budget_cap" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "target_notes" text;