import { eq } from "drizzle-orm";
import { getOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import SettingsClient from "./pageClient";

export default async function SettingsPage() {
  const [defaultsRes, accounts] = await Promise.all([
    getOrgTriageDefaultsAction(),
    db.query.adAccounts.findMany({
      where: eq(adAccounts.isActive, true),
    }),
  ]);

  if (!defaultsRes.success || !defaultsRes.data) {
    return (
      <div className="p-8 text-rose-500 font-medium">
        Error loading settings configuration.
      </div>
    );
  }

  const accountsData = accounts.map((acc) => ({
    id: acc.id,
    googleAccountId: acc.googleAccountId,
    name: acc.name,
    isActive: acc.isActive,
    lastSyncedAt: acc.lastSyncedAt ? acc.lastSyncedAt.toISOString() : null,
    syncStatus: acc.syncStatus,
    syncError: acc.syncError,
    includeInBriefing: acc.includeInBriefing,
  }));

  return (
    <SettingsClient
      initialDefaults={defaultsRes.data}
      accounts={accountsData}
    />
  );
}
