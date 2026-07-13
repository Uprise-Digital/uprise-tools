"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
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
    let orgId = session.session.activeOrganizationId;
    if (!orgId) {
      const userMember = await db.query.member.findFirst({
        where: eq(member.userId, session.user.id),
      });
      orgId = userMember?.organizationId;
    }
    if (!orgId) throw new Error("No active organization found");

    const conn = await db.query.googleAdsConnections.findFirst({
      where: eq(googleAdsConnections.organizationId, orgId),
    });

    if (!conn) {
      throw new Error(
        "Google Ads connection not found. Please connect your manager account first.",
      );
    }

    console.log(
      `[Sync] Initiating MCC account sync by ${session.user.email} for connection ${conn.id}...`,
    );

    const data = await fetchMCCAccounts();
    const results = data.results || [];
    let syncCount = 0;

    // Collect all Google Account IDs returned by MCC API
    const googleIdsInApi = results
      .map((row: any) => row.customerClient?.id?.toString())
      .filter(Boolean) as string[];

    // Deactivate/archive accounts in our database that are NOT in Google Ads API response (delinked)
    if (googleIdsInApi.length > 0) {
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
            eq(adAccounts.connectionId, conn.id),
            eq(adAccounts.organizationId, orgId),
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
          organizationId: orgId,
          connectionId: conn.id,
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
    return { success: false, error: error.message || "Failed to sync accounts" };
  }
}
