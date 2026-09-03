import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL found in .env.local");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("Applying schema updates for Landing Page Speed Testing...");

  // 1. Add weekly_speed_check column to campaign_landing_pages if not exists
  await sql`
    ALTER TABLE campaign_landing_pages
    ADD COLUMN IF NOT EXISTS weekly_speed_check BOOLEAN NOT NULL DEFAULT FALSE;
  `;
  console.log("✓ Added weekly_speed_check column to campaign_landing_pages");

  // 2. Create landing_page_speed_tests table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS landing_page_speed_tests (
      id SERIAL PRIMARY KEY,
      organization_id TEXT NOT NULL DEFAULT 'default-org',
      ad_account_id INTEGER NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
      campaign_landing_page_id INTEGER REFERENCES campaign_landing_pages(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      device TEXT NOT NULL DEFAULT 'mobile',
      performance_score INTEGER NOT NULL,
      accessibility_score INTEGER,
      best_practices_score INTEGER,
      seo_score INTEGER,
      lcp_ms INTEGER,
      lcp_display TEXT,
      cls_score DOUBLE PRECISION,
      cls_display TEXT,
      inp_ms INTEGER,
      inp_display TEXT,
      fcp_ms INTEGER,
      fcp_display TEXT,
      ttfb_ms INTEGER,
      ttfb_display TEXT,
      speed_index_ms INTEGER,
      speed_index_display TEXT,
      total_byte_weight INTEGER,
      opportunities JSONB,
      diagnostics JSONB,
      crux_data JSONB,
      raw_metrics JSONB,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      error_message TEXT,
      trigger_source TEXT NOT NULL DEFAULT 'MANUAL',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Created landing_page_speed_tests table");

  // 3. Create indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lp_speed_account ON landing_page_speed_tests (ad_account_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lp_speed_url ON landing_page_speed_tests (url);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lp_speed_org ON landing_page_speed_tests (organization_id);
  `;
  console.log("✓ Created indexes for landing_page_speed_tests");

  // 4. Enable RLS and add basic tenant policy if not present
  await sql`
    ALTER TABLE landing_page_speed_tests ENABLE ROW LEVEL SECURITY;
  `;
  console.log("✓ Enabled RLS on landing_page_speed_tests");

  await sql.end();
  console.log("Schema migration successfully completed!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
