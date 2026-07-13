"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { adAccounts, googleAdsConnections, member } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { fetchMCCAccounts } from "@/lib/google-ads";

export async function syncAdAccountsAction() {
  // 1. Auth Check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  try {
    let orgId = session.session?.activeOrganizationId;
    let connectionId: number | null = null;
    let hasConnection = false;

    try {
      if (!orgId && db.query.member) {
        const userMember = await db.query.member.findFirst({
          where: eq(member.userId, session.user.id),
        });
        orgId = userMember?.organizationId;
      }

      if (orgId && db.query.googleAdsConnections) {
        const conn = await db.query.googleAdsConnections.findFirst({
          where: eq(googleAdsConnections.organizationId, orgId),
        });
        if (conn) {
          connectionId = conn.id;
          hasConnection = true;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve organization context for sync:", err);
    }

    console.log(
      `[Sync] Initiating MCC account sync by ${session.user.email} (hasConnection: ${hasConnection})...`,
    );

    const data = await fetchMCCAccounts();
    const results = data.results || [];
    let syncCount = 0;

    // Collect all Google Account IDs returned by MCC API
    const googleIdsInApi = results
      .map((row: any) => row.customerClient?.id?.toString())
      .filter(Boolean) as string[];

    // Deactivate/archive accounts in our database that are NOT in Google Ads API response (delinked)
    if (hasConnection && connectionId && googleIdsInApi.length > 0) {
      await db
        .update(adAccounts)
        .set({
          isActive: false,
          googleStatus: "DELINKED",
          syncStatus: "failed",
          syncError: "Account delinked from Google Ads MCC connection",
        })
        .where(
          and(
            eq(adAccounts.connectionId, connectionId),
            eq(adAccounts.organizationId, orgId || "default-org"),
            sql`${adAccounts.googleAccountId} NOT IN (${sql.join(
              googleIdsInApi.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );
    }

    for (const row of results) {
      const client = row.customerClient;
      if (!client) continue;

      const liveStatus = client.status || "ENABLED";
      const isClientActive = liveStatus === "ENABLED";

      await db
        .insert(adAccounts)
        .values({
          googleAccountId: client.id.toString(),
          name: client.descriptiveName || "Unnamed Account",
          currencyCode: client.currencyCode,
          timeZone: client.timeZone,
          googleStatus: liveStatus,
          isActive: isClientActive,
          organizationId: orgId || "default-org",
          connectionId: connectionId,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: adAccounts.googleAccountId,
          set: {
            name: client.descriptiveName || "Unnamed Account",
            currencyCode: client.currencyCode,
            timeZone: client.timeZone,
            googleStatus: liveStatus,
            isActive: isClientActive,
            lastSyncedAt: new Date(),
          },
        });

      if (isClientActive) {
        syncCount++;
      }
    }

    // SUCCESS LOGGING
    await logAction(
      session.user.id,
      "SYNC_MCC_ACCOUNTS",
      "ad_accounts",
      "MCC_ROOT",
      {
        accountsProcessed: results.length,
        accountsEnabled: syncCount,
        status: "SUCCESS",
      },
    );

    revalidatePath("/admin/accounts");
    revalidatePath("/accounts");
    return { success: true, count: syncCount };
  } catch (error: any) {
    // FAILURE LOGGING
    await logAction(
      session.user.id,
      "SYNC_MCC_ACCOUNTS_FAILED",
      "ad_accounts",
      "MCC_ROOT",
      { error: error.message || "Google Ads API connection failed" },
    );

    console.error("Sync Error:", error);
    return {
      success: false,
      error: error.message || "Failed to sync accounts",
    };
  }
}
