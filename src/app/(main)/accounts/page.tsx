// app/admin/accounts/page.tsx
import { db } from "@/db";
import AccountsClientPage from "./pageClient";

export default async function AdAccountsPage() {
  // Fetch accounts with their associated report schedules on the server
  const accounts = await db.query.adAccounts.findMany({
    with: {
      reportSchedules: true,
    },
    orderBy: (acc, { desc }) => [desc(acc.createdAt)],
  });

  return <AccountsClientPage accounts={accounts} />;
}
