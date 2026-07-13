import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  console.log("Wiping database tables...");
  await db.execute(sql`
    TRUNCATE TABLE 
      "user", 
      "session", 
      "account", 
      "verification", 
      "organization", 
      "member", 
      "google_ads_connections", 
      "ad_accounts", 
      "ad_performance_daily", 
      "usage_logs", 
      "threat_matrix_audits", 
      "landing_page_audits", 
      "campaign_landing_pages", 
      "ad_group_ad_audits" 
    CASCADE;
  `);
  console.log("Database wiped successfully!");
}

main().catch((err) => {
  console.error("Failed to wipe database:", err);
  process.exit(1);
});
