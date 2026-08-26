"use me";
"use server";

import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { metaAdAccounts, metaAdsConnections } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getMetaConnectionAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = session.session.activeOrganizationId;

  try {
    const connection = await db.query.metaAdsConnections.findFirst({
      where: eq(metaAdsConnections.organizationId, orgId),
    });

    if (!connection) {
      return { success: true, connection: null, linkedAccountsCount: 0 };
    }

    const accountsCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(metaAdAccounts)
      .where(eq(metaAdAccounts.organizationId, orgId));

    const linkedAccountsCount = Number(accountsCountResult[0]?.count || 0);

    return {
      success: true,
      connection: {
        id: connection.id,
        connectedEmail: connection.connectedEmail,
        metaUserId: connection.metaUserId,
        businessId: connection.businessId,
        status: connection.status,
        accessLevel: connection.accessLevel,
        autoAddAccounts: connection.autoAddAccounts,
        createdAt: connection.createdAt.toISOString(),
      },
      linkedAccountsCount,
    };
  } catch (err: any) {
    console.error("Error fetching Meta connection:", err);
    return {
      success: false,
      error: err.message || "Failed to fetch Meta connection",
    };
  }
}

export async function disconnectMetaAdsAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = session.session.activeOrganizationId;

  try {
    await db
      .delete(metaAdsConnections)
      .where(eq(metaAdsConnections.organizationId, orgId));

    return { success: true };
  } catch (err: any) {
    console.error("Error disconnecting Meta Ads:", err);
    return {
      success: false,
      error: err.message || "Failed to disconnect Meta Ads",
    };
  }
}

export async function updateMetaAutoSyncSettingsAction(
  autoAddAccounts: boolean,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.session.activeOrganizationId) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = session.session.activeOrganizationId;

  try {
    await db
      .update(metaAdsConnections)
      .set({
        autoAddAccounts,
        updatedAt: new Date(),
      })
      .where(eq(metaAdsConnections.organizationId, orgId));

    return { success: true };
  } catch (err: any) {
    console.error("Error updating Meta auto sync settings:", err);
    return {
      success: false,
      error: err.message || "Failed to update settings",
    };
  }
}
