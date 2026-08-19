import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import LpAnalysisClientPage from "./pageClient";

export default async function LpAnalysisPage() {
  const ctx = await getAuthOrgContext();
  if (!ctx) {
    redirect("/login");
  }

  // Fetch ad accounts for active organization ordered by name
  const accounts = await db.query.adAccounts.findMany({
    where: and(
      eq(adAccounts.isActive, true),
      eq(adAccounts.organizationId, ctx.orgId),
    ),
    orderBy: (table, { asc }) => asc(table.name),
  });

  return <LpAnalysisClientPage accounts={accounts} />;
}
