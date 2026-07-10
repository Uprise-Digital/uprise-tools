import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "../src/db";
import { adAccounts, googleAdsConnections, organization, member } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrgTriageDefaultsAction } from "../src/actions/triage-settings.actions";

async function main() {
  console.log("Checking DB connection and running queries...");
  try {
    // Get the first organization as a test target
    const firstOrg = await db.query.organization.findFirst();
    if (!firstOrg) {
      console.log("No organization found in DB. Did you wipe the database?");
      return;
    }
    const orgId = firstOrg.id;
    console.log(`Using Org ID: ${orgId}`);

    // Get first member to use for test
    const firstMember = await db.query.member.findFirst({
      where: eq(member.organizationId, orgId)
    });
    const userId = firstMember?.userId || "test-user";
    console.log(`Using User ID: ${userId}`);

    console.log("1. Fetching triage defaults...");
    const defaults = await getOrgTriageDefaultsAction();
    console.log("Defaults fetch success:", defaults.success);

    console.log("2. Querying adAccounts...");
    const accounts = await db.query.adAccounts.findMany({
      where: eq(adAccounts.organizationId, orgId),
    });
    console.log("Accounts count:", accounts.length);

    console.log("3. Querying auditLogs...");
    const auditLogs = await db.query.auditLogs.findMany({
      with: { actor: true },
      limit: 10,
    });
    console.log("Audit logs count:", auditLogs.length);

    console.log("4. Querying emailLogs...");
    const emailLogs = await db.query.emailLogs.findMany({
      with: { account: true },
      limit: 10,
    });
    console.log("Email logs count:", emailLogs.length);

    console.log("5. Querying googleAdsConnections...");
    const connection = await db.query.googleAdsConnections.findFirst({
      where: eq(googleAdsConnections.organizationId, orgId),
    });
    console.log("Connection exists:", !!connection);

    console.log("6. Querying member...");
    const memberRecord = await db.query.member.findFirst({
      where: and(
        eq(member.userId, userId),
        eq(member.organizationId, orgId)
      ),
    });
    console.log("Member role:", memberRecord?.role || "none");

    console.log("ALL QUERIES PASSED!");
  } catch (error: any) {
    console.error("DIAGNOSTICS FAILED WITH ERROR:");
    console.error(error);
  }
}

main().then(() => process.exit(0));
