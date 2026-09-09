// app/admin/accounts/page.tsx
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaAdAccounts } from "@/db/schema";
import { unifyAccounts } from "@/lib/account-unification";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import AccountsClientPage from "./pageClient";

export const dynamic = "force-dynamic";

export default async function AdAccountsPage() {
  try {
    const ctx = await getAuthOrgContext();
    const orgId = ctx?.orgId || null;

    // 1. Fetch Google accounts with report schedules and email logs
    let googleAccounts: any[] = [];
    try {
      googleAccounts = await db.query.adAccounts.findMany({
        with: {
          reportSchedules: true,
          emailLogs: {
            orderBy: (logs, { desc }) => [desc(logs.sentAt)],
            limit: 20,
          },
        },
        orderBy: (acc, { desc }) => [desc(acc.createdAt)],
      });
    } catch (gErr) {
      console.warn("Could not query googleAccounts with nested relations, fallback to base query:", gErr);
      googleAccounts = await db.query.adAccounts.findMany({
        orderBy: (acc, { desc }) => [desc(acc.createdAt)],
      });
    }

    // 2. Fetch Meta ad accounts for current org
    let metaAccounts: any[] = [];
    if (orgId) {
      try {
        metaAccounts = await db.query.metaAdAccounts.findMany({
          where: eq(metaAdAccounts.organizationId, orgId),
          orderBy: (acc, { desc }) => [desc(acc.createdAt)],
        });
      } catch (mErr) {
        console.warn("Could not query metaAccounts:", mErr);
      }
    }

    // 3. Unify accounts cross-platform
    const unifiedAccounts = unifyAccounts(googleAccounts, metaAccounts);

    return <AccountsClientPage accounts={unifiedAccounts} />;
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    console.error("AdAccountsPage top-level error:", err);
    return <AccountsClientPage accounts={[]} />;
  }
}
