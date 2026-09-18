import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adAccounts, organization } from "@/db/schema";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import LpAnalysisClientPage from "./pageClient";

export default async function LpAnalysisPage() {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  // Fetch ad accounts and organization settings in parallel
  const [accounts, org] = await Promise.all([
    db.query.adAccounts.findMany({
      where: and(
        eq(adAccounts.isActive, true),
        eq(adAccounts.organizationId, ctx.orgId),
      ),
      orderBy: (table, { asc }) => asc(table.name),
    }),
    db.query.organization.findFirst({
      where: eq(organization.id, ctx.orgId),
    }),
  ]);

  let initialPageSpeedScope: "ALL" | "ENABLED_ONLY" = "ALL";
  if (org?.metadata) {
    try {
      const meta = JSON.parse(org.metadata);
      if (
        meta.pageSpeedAuditScope === "ENABLED_ONLY" ||
        meta.pageSpeedAuditScope === "ALL"
      ) {
        initialPageSpeedScope = meta.pageSpeedAuditScope;
      }
    } catch (e) {
      // Ignore JSON parse error
    }
  }

  return (
    <LpAnalysisClientPage
      accounts={accounts}
      initialPageSpeedScope={initialPageSpeedScope}
    />
  );
}

