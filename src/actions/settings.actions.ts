"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { withBypassTenantDb } from "@/db/db-helper";
import {
  adAccounts,
  googleAdsConnections,
  member,
  organization,
} from "@/db/schema";
import { withTenantContext } from "@/db/tenant-db";
import { auth } from "@/lib/auth";

async function getAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(
      `Failed to refresh access token: ${data.error_description || data.error}`,
    );
  }
  return data.access_token as string;
}

// --- Action 1: Disconnect Google Ads Connection ---
export async function disconnectGoogleAdsAction(payload: {
  connectionId: number;
  deleteSyncedData: boolean;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    await withTenantContext(orgId, async (tx) => {
      // 1. If deleteSyncedData is true, delete all ad accounts under this connection
      if (payload.deleteSyncedData) {
        await tx
          .delete(adAccounts)
          .where(
            and(
              eq(adAccounts.connectionId, payload.connectionId),
              eq(adAccounts.organizationId, orgId),
            ),
          );
      } else {
        // Otherwise, keep the accounts but set connectionId to null so they are orphaned
        await tx
          .update(adAccounts)
          .set({ connectionId: null, isActive: false })
          .where(
            and(
              eq(adAccounts.connectionId, payload.connectionId),
              eq(adAccounts.organizationId, orgId),
            ),
          );
      }

      // 2. Delete the connection
      await tx
        .delete(googleAdsConnections)
        .where(
          and(
            eq(googleAdsConnections.id, payload.connectionId),
            eq(googleAdsConnections.organizationId, orgId),
          ),
        );
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to disconnect Google Ads:", error);
    return { success: false, error: error.message };
  }
}

// --- Action 2: Update Selected/Linked Sub-Accounts ---
export async function updateLinkedAccountsAction(payload: {
  connectionId: number;
  managerCustomerId: string;
  selectedCustomerIds: string[];
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    // 1. Fetch connection and fetch details from Google Ads
    const conn = await db.query.googleAdsConnections.findFirst({
      where: eq(googleAdsConnections.id, payload.connectionId),
    });

    if (!conn) {
      throw new Error("Connection not found");
    }

    const { decryptToken } = await import("@/lib/crypto");
    const decToken = decryptToken(conn.refreshToken);
    const accessToken = await getAccessToken(decToken);
    const sanitizedId = payload.managerCustomerId.replace(/-/g, "");

    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    // Fetch all child accounts from Google Ads to populate details
    const query = `
      SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.status
      FROM customer_client
      WHERE customer_client.level <= 1
        AND customer_client.manager = false
    `;

    const searchRes = await fetch(
      `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": DEVELOPER_TOKEN || "",
          Authorization: `Bearer ${accessToken}`,
          "login-customer-id": sanitizedId,
        },
        body: JSON.stringify({ query }),
      },
    );
    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(
        `Failed to fetch client accounts: ${searchData.error.message}`,
      );
    }

    const results = searchData.results || [];
    const accountsToInsert: any[] = [];

    // Loop through and insert/activate checked ones
    for (const row of results) {
      const client = row.customerClient;
      if (client) {
        const clientIdStr = client.id.toString();
        if (payload.selectedCustomerIds.includes(clientIdStr)) {
          accountsToInsert.push({
            googleAccountId: clientIdStr,
            name: client.descriptiveName || `Client Account (${client.id})`,
            currencyCode: client.currencyCode || "AUD",
            timeZone: client.timeZone || "Australia/Melbourne",
            googleStatus: client.status || "ENABLED",
            organizationId: orgId,
            connectionId: conn.id,
            isActive: true,
          });
        }
      }
    }

    // Deactivate accounts that are NOT checked & upsert checked ones inside RLS context
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(adAccounts)
        .set({ isActive: false })
        .where(
          and(
            eq(adAccounts.connectionId, conn.id),
            eq(adAccounts.organizationId, orgId),
            payload.selectedCustomerIds.length > 0
              ? sql`${adAccounts.googleAccountId} NOT IN (${sql.join(
                  payload.selectedCustomerIds.map((id) => sql`${id}`),
                  sql`, `,
                )})`
              : sql`TRUE`,
          ),
        );

      // Upsert the checked ones (activate or insert)
      if (accountsToInsert.length > 0) {
        await tx
          .insert(adAccounts)
          .values(accountsToInsert)
          .onConflictDoUpdate({
            target: adAccounts.googleAccountId,
            set: {
              name: sql`EXCLUDED.name`,
              currencyCode: sql`EXCLUDED.currency_code`,
              timeZone: sql`EXCLUDED.time_zone`,
              googleStatus: sql`EXCLUDED.google_status`,
              isActive: true,
            },
          });
      }
    });

    // Trigger background sync for newly imported/re-activated accounts
    const endDateStr = new Date().toISOString().split("T")[0];
    const startDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { backgroundTasks } = await import("@/db/schema");
    const [taskRecord] = await db
      .insert(backgroundTasks)
      .values({
        organizationId: orgId,
        name: "Google Ads Portfolio Sync",
        status: "running",
      })
      .returning({ id: backgroundTasks.id });

    if (taskRecord) {
      const { syncAgencyPortfolioAction } = await import(
        "@/actions/agency.actions"
      );
      syncAgencyPortfolioAction(startDateStr, endDateStr, {
        organizationId: orgId,
        backgroundTaskId: taskRecord.id,
      });
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update linked accounts:", error);
    return { success: false, error: error.message };
  }
}

// --- Action 3: Update Organization Name & Domain Auto-Join Settings ---
export async function updateOrganizationNameAction(payload: {
  name: string;
  allowDomainAutoJoin: boolean;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, orgId),
    });
    if (!org) throw new Error("Organization not found");

    const userEmail = session.user.email;
    const userDomain = userEmail.split("@")[1];

    let metaObj: any = {};
    if (org.metadata) {
      try {
        metaObj = JSON.parse(org.metadata);
      } catch (e) {
        // Ignore
      }
    }

    metaObj.autoJoinDomain = payload.allowDomainAutoJoin ? userDomain : null;

    await db
      .update(organization)
      .set({
        name: payload.name,
        metadata: JSON.stringify(metaObj),
        updatedAt: new Date(),
      })
      .where(eq(organization.id, orgId));

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update organization name:", error);
    return { success: false, error: error.message };
  }
}

export async function refreshAdAccountsMetadataInternal(orgId: string) {
  const conn = await db.query.googleAdsConnections.findFirst({
    where: eq(googleAdsConnections.organizationId, orgId),
  });

  if (!conn) {
    throw new Error(
      "Google Ads connection not found. Please connect your manager account first.",
    );
  }

  const { decryptToken } = await import("@/lib/crypto");
  const decToken = decryptToken(conn.refreshToken);
  const accessToken = await getAccessToken(decToken);
  const sanitizedId = conn.managerCustomerId.replace(/-/g, "");

  const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status
    FROM customer_client
    WHERE customer_client.level <= 1
      AND customer_client.manager = false
  `;

  const searchRes = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN || "",
        Authorization: `Bearer ${accessToken}`,
        "login-customer-id": sanitizedId,
      },
      body: JSON.stringify({ query }),
    },
  );
  const searchData = await searchRes.json();
  if (searchData.error) {
    throw new Error(
      `Failed to fetch live client accounts: ${searchData.error.message}`,
    );
  }

  const results = searchData.results || [];
  const googleIdsInApi = results
    .map((row: any) => row.customerClient?.id?.toString())
    .filter(Boolean) as string[];

  await withTenantContext(orgId, async (tx) => {
    // Deactivate/archive accounts in our database that are NOT in Google Ads API response (delinked)
    if (googleIdsInApi.length > 0) {
      await tx
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
      if (client) {
        const clientIdStr = client.id.toString();
        const liveStatus = client.status || "ENABLED";

        if (conn.autoAddAccounts) {
          const shouldBeActive =
            conn.autoSyncScope === "ACTIVE_ONLY"
              ? liveStatus === "ENABLED"
              : true;

          await tx
            .insert(adAccounts)
            .values({
              googleAccountId: clientIdStr,
              name: client.descriptiveName || `Client Account (${client.id})`,
              currencyCode: client.currencyCode || "AUD",
              timeZone: client.timeZone || "Australia/Melbourne",
              googleStatus: liveStatus,
              organizationId: orgId,
              connectionId: conn.id,
              isActive: shouldBeActive,
            })
            .onConflictDoUpdate({
              target: adAccounts.googleAccountId,
              set: {
                name: client.descriptiveName || `Client Account (${client.id})`,
                currencyCode: client.currencyCode || "AUD",
                timeZone: client.timeZone || "Australia/Melbourne",
                googleStatus: liveStatus,
                isActive: shouldBeActive,
              },
            });
        } else {
          await tx
            .update(adAccounts)
            .set({
              name: client.descriptiveName || `Client Account (${client.id})`,
              currencyCode: client.currencyCode || "AUD",
              timeZone: client.timeZone || "Australia/Melbourne",
              googleStatus: liveStatus,
              isActive: liveStatus === "ENABLED",
            })
            .where(
              and(
                eq(adAccounts.googleAccountId, clientIdStr),
                eq(adAccounts.organizationId, orgId),
              ),
            );
        }
      }
    }
  });
}

export async function refreshAdAccountsMetadataAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    await refreshAdAccountsMetadataInternal(orgId);
    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to refresh ad accounts metadata:", error);
    return { success: false, error: error.message };
  }
}

/**
 * System action to loop through all active connections and sync their ad accounts metadata.
 * Bypasses RLS since it's run via a background system cron job.
 */
export async function syncAllConnectionsMetadataAction() {
  try {
    const connections = await withBypassTenantDb(async (tx) => {
      return await tx.query.googleAdsConnections.findMany({
        where: eq(googleAdsConnections.status, "active"),
      });
    });

    console.log(
      `[Sync Accounts Cron] Found ${connections.length} active connections to process.`,
    );

    let successCount = 0;
    for (const conn of connections) {
      try {
        console.log(
          `[Sync Accounts Cron] Syncing accounts for connection ID ${conn.id} (Org: ${conn.organizationId})...`,
        );
        await refreshAdAccountsMetadataInternal(conn.organizationId);
        successCount++;
      } catch (err: any) {
        console.error(
          `[Sync Accounts Cron] Failed to sync connection ID ${conn.id}:`,
          err,
        );
      }
    }

    return { success: true, processedCount: connections.length, successCount };
  } catch (error: any) {
    console.error("[syncAllConnectionsMetadataAction Error]:", error);
    return { success: false, error: error.message };
  }
}

// --- Action 5: Update Auto Sync Settings ---
export async function updateAutoSyncSettingsAction(payload: {
  connectionId: number;
  autoAddAccounts: boolean;
  autoSyncScope: "ALL" | "ACTIVE_ONLY";
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    const conn = await db.query.googleAdsConnections.findFirst({
      where: and(
        eq(googleAdsConnections.id, payload.connectionId),
        eq(googleAdsConnections.organizationId, orgId),
      ),
    });

    if (!conn) {
      throw new Error("Google Ads connection not found.");
    }

    await db
      .update(googleAdsConnections)
      .set({
        autoAddAccounts: payload.autoAddAccounts,
        autoSyncScope: payload.autoSyncScope,
        updatedAt: new Date(),
      })
      .where(eq(googleAdsConnections.id, conn.id));

    if (payload.autoAddAccounts) {
      await refreshAdAccountsMetadataAction();
    } else {
      revalidatePath("/settings");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to update auto-sync settings:", error);
    return { success: false, error: error.message };
  }
}

export async function updateNegativeKeywordOptionsAction(payload: {
  connectionId: number;
  broadEnabled: boolean;
  phraseEnabled: boolean;
  exactEnabled: boolean;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
    throw new Error("No active organization found");
  }

  try {
    const conn = await db.query.googleAdsConnections.findFirst({
      where: and(
        eq(googleAdsConnections.id, payload.connectionId),
        eq(googleAdsConnections.organizationId, orgId),
      ),
    });

    if (!conn) {
      throw new Error("Google Ads connection not found.");
    }

    await db
      .update(googleAdsConnections)
      .set({
        negativeKeywordBroadEnabled: payload.broadEnabled,
        negativeKeywordPhraseEnabled: payload.phraseEnabled,
        negativeKeywordExactEnabled: payload.exactEnabled,
        updatedAt: new Date(),
      })
      .where(eq(googleAdsConnections.id, conn.id));

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update negative keyword options:", error);
    return { success: false, error: error.message };
  }
}
