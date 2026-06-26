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

  return (
    <ClientDashboard
      account={account}
      orgDefaults={orgDefaults}
      initialSettings={initialSettings}
    />
  );
}
