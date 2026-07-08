import { eq } from "drizzle-orm";
import { getOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import { db } from "@/db";
import { adAccounts } from "@/db/schema";
import SettingsClient from "./pageClient";

export default async function SettingsPage() {
  const [defaultsRes, accounts, auditLogsData, emailLogsData] =
    await Promise.all([
      getOrgTriageDefaultsAction(),
      db.query.adAccounts.findMany({
        where: eq(adAccounts.isActive, true),
      }),
      db.query.auditLogs.findMany({
        with: {
          actor: true,
        },
        orderBy: (logs, { desc }) => [desc(logs.createdAt)],
        limit: 100,
      }),
      db.query.emailLogs.findMany({
        with: {
          account: true,
        },
        orderBy: (emails, { desc }) => [desc(emails.sentAt)],
        limit: 100,
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

  const auditLogsSerialized = auditLogsData.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    targetTable: log.targetTable,
    targetId: log.targetId,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.name,
          email: log.actor.email,
          image: log.actor.image,
        }
      : null,
  }));

  const emailLogsSerialized = emailLogsData.map((email) => ({
    id: email.id,
    adAccountId: email.adAccountId,
    recipient: email.recipient,
    subject: email.subject,
    emailType: email.emailType,
    status: email.status,
    error: email.error,
    resendId: email.resendId,
    sentAt: email.sentAt.toISOString(),
    accountName: email.account?.name || null,
  }));

  return (
    <SettingsClient
      initialDefaults={defaultsRes.data}
      accounts={accountsData}
      auditLogs={auditLogsSerialized}
      emailLogs={emailLogsSerialized}
    />
  );
}
