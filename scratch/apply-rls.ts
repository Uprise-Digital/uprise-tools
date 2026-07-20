import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function main() {
  console.log(
    "Applying RLS policies to client_onboardings, organization_onboarding_settings, and ai_usage_settings...",
  );

  // Drop policies if they exist first, to be idempotent
  try {
    await sql`DROP POLICY IF EXISTS tenant_isolation_policy ON "client_onboardings"`;
    await sql`DROP POLICY IF EXISTS tenant_isolation_policy ON "organization_onboarding_settings"`;
    await sql`DROP POLICY IF EXISTS tenant_isolation_policy ON "ai_usage_settings"`;
  } catch (e) {
    // Ignore
  }

  await sql`ALTER TABLE "client_onboardings" FORCE ROW LEVEL SECURITY`;
  await sql`CREATE POLICY tenant_isolation_policy ON "client_onboardings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true))`;
  console.log("client_onboardings RLS applied.");

  await sql`ALTER TABLE "organization_onboarding_settings" FORCE ROW LEVEL SECURITY`;
  await sql`CREATE POLICY tenant_isolation_policy ON "organization_onboarding_settings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true))`;
  console.log("organization_onboarding_settings RLS applied.");

  await sql`ALTER TABLE "ai_usage_settings" FORCE ROW LEVEL SECURITY`;
  await sql`CREATE POLICY tenant_isolation_policy ON "ai_usage_settings" FOR ALL USING (current_setting('app.bypass_rls', true) = 'true' OR organization_id = current_setting('app.current_organization_id', true))`;
  console.log("ai_usage_settings RLS applied.");

  console.log("RLS policies applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error applying RLS:", err);
  process.exit(1);
});
