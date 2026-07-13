// app/admin/accounts/[id]/page.tsx

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  getAccountTriageSettingsAction,
  getOrgTriageDefaultsAction,
} from "@/actions/triage-settings.actions";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import ClientDashboard from "./pageClient";

interface PageProps {
  params: { id: string };
}

export default async function AccountDetailPage({ params }: PageProps) {
  const accountId = parseInt((await params).id, 10);

  if (Number.isNaN(accountId)) {
    return notFound();
  }

  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, accountId),
  });

  if (!account) {
    return notFound();
  }

  const [orgDefaultsRes, accountSettingsRes] = await Promise.all([
    getOrgTriageDefaultsAction(),
    getAccountTriageSettingsAction(accountId),
  ]);

  const orgDefaults =
    orgDefaultsRes.success && orgDefaultsRes.data ? orgDefaultsRes.data : null;
  const initialSettings =
    accountSettingsRes.success && accountSettingsRes.data
      ? accountSettingsRes.data
      : null;

  const accountData = {
    id: account.id,
    googleAccountId: account.googleAccountId,
    name: account.name,
    currencyCode: account.currencyCode,
    includeInBriefing: account.includeInBriefing,
    isActive: account.isActive,
    googleStatus: account.googleStatus,
    syncStatus: account.syncStatus,
    syncError: account.syncError,
  };

  return (
    <ClientDashboard
      account={accountData}
      orgDefaults={orgDefaults}
      initialSettings={initialSettings}
    />
  );
}
