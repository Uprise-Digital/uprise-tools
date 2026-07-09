import { eq, and } from "drizzle-orm";
import { getOrgTriageDefaultsAction } from "@/actions/triage-settings.actions";
import { db } from "@/db";
import { adAccounts, googleAdsConnections, organization, member } from "@/db/schema";
import SettingsClient from "./pageClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { withTenantContext } from "@/db/tenant-db";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const userMember = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id),
    });
    if (userMember) {
      orgId = userMember.organizationId;
    }
  }

  if (!orgId) {
    redirect("/onboarding");
  }

  const [
    defaultsRes,
    accounts,
    auditLogsData,
    emailLogsData,
    connection,
    orgRecord,
    memberRecord,
  ] = await Promise.all([
    getOrgTriageDefaultsAction(),
    withTenantContext(orgId, (tx) =>
      tx.query.adAccounts.findMany({
        where: eq(adAccounts.organizationId, orgId),
      })
    ),
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
    db.query.googleAdsConnections.findFirst({
      where: eq(googleAdsConnections.organizationId, orgId),
    }),
    db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    }),
    db.query.member.findFirst({
      where: and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, orgId)
      ),
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
    googleStatus: acc.googleStatus,
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

  const connectionData = connection
    ? {
        id: connection.id,
        connectedEmail: connection.connectedEmail,
        managerCustomerId: connection.managerCustomerId,
        status: connection.status,
        errorMessage: connection.errorMessage,
        createdAt: connection.createdAt.toISOString(),
      }
    : null;

  let initialAutoJoinDomainEnabled = false;
  if (orgRecord?.metadata) {
    try {
      const meta = JSON.parse(orgRecord.metadata);
      initialAutoJoinDomainEnabled = !!meta.autoJoinDomain;
    } catch (e) {
      // Ignore
    }
  }

  return (
    <SettingsClient
      initialDefaults={defaultsRes.data}
      accounts={accountsData}
      auditLogs={auditLogsSerialized}
      emailLogs={emailLogsSerialized}
      connection={connectionData}
      orgName={orgRecord?.name || "Uprise Digital Agency"}
      userEmail={session.user.email}
      userRole={memberRecord?.role || "member"}
      initialAutoJoinDomainEnabled={initialAutoJoinDomainEnabled}
    />
  );
}
