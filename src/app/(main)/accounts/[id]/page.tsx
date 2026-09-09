// app/admin/accounts/[id]/page.tsx

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  getAccountTriageSettingsAction,
  getOrgTriageDefaultsAction,
} from "@/actions/triage-settings.actions";
import { db } from "@/db";
import { adAccounts, metaAdAccounts } from "@/db/schema";
import { normalizeAccountName } from "@/lib/account-unification";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import ClientDashboard from "./pageClient";

interface PageProps {
  params: { id: string };
}

export default async function AccountDetailPage({ params }: PageProps) {
  const accountId = parseInt((await params).id, 10);

  if (Number.isNaN(accountId)) {
    return notFound();
  }

  const ctx = await getAuthOrgContext();
  const orgId = ctx?.orgId || null;

  const account = await db.query.adAccounts.findFirst({
    where: eq(adAccounts.id, accountId),
  });

  if (!account) {
    return notFound();
  }

  // Look up if there is a linked Meta Ad Account in the same organization matching this client's name
  let linkedMetaAccount: {
    id: number;
    metaAccountId: string;
    name: string;
    currencyCode: string | null;
    timeZone: string | null;
    isActive: boolean;
    accountStatus: number;
  } | null = null;

  if (orgId) {
    const orgMetaAccounts = await db.query.metaAdAccounts.findMany({
      where: eq(metaAdAccounts.organizationId, orgId),
    });

    const normAccountName = normalizeAccountName(account.name);
    const matchedMeta = orgMetaAccounts.find(
      (m) => normalizeAccountName(m.name) === normAccountName,
    );

    if (matchedMeta) {
      linkedMetaAccount = {
        id: matchedMeta.id,
        metaAccountId: matchedMeta.metaAccountId,
        name: matchedMeta.name,
        currencyCode: matchedMeta.currencyCode,
        timeZone: matchedMeta.timeZone,
        isActive: matchedMeta.isActive,
        accountStatus: matchedMeta.accountStatus,
      };
    }
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
    targetNotes: account.targetNotes,
    linkedMetaAccount,
  };

  return (
    <ClientDashboard
      account={accountData}
      orgDefaults={orgDefaults}
      initialSettings={initialSettings}
    />
  );
}

