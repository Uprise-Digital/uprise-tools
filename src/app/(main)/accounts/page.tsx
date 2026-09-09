// app/admin/accounts/page.tsx
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { metaAdAccounts } from "@/db/schema";
import { unifyAccounts } from "@/lib/account-unification";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import AccountsClientPage from "./pageClient";

export default async function AdAccountsPage() {
  const ctx = await getAuthOrgContext();
  const orgId = ctx?.orgId || null;

  // 1. Fetch Google accounts with report schedules and email logs
  const googleAccounts = await db.query.adAccounts.findMany({
    with: {
      reportSchedules: true,
      emailLogs: {
        orderBy: (logs, { desc }) => [desc(logs.sentAt)],
        limit: 20,
      },
    },
    orderBy: (acc, { desc }) => [desc(acc.createdAt)],
  });

  // 2. Fetch Meta ad accounts for current org
  const metaAccounts = orgId
    ? await db.query.metaAdAccounts.findMany({
        where: eq(metaAdAccounts.organizationId, orgId),
        orderBy: (acc, { desc }) => [desc(acc.createdAt)],
      })
    : [];

  // 3. Unify accounts cross-platform
  const unifiedAccounts = unifyAccounts(googleAccounts, metaAccounts);

  return <AccountsClientPage accounts={unifiedAccounts} />;
}
