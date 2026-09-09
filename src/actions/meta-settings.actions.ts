"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { metaAdAccounts, metaAdsConnections } from "@/db/schema";
import { getAuthOrgContext } from "@/lib/auth-helpers";
import { decryptToken, encryptToken } from "@/lib/crypto";

export async function getMetaConnectionAction() {
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;

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
        isPermanent: !connection.tokenExpiresAt,
        tokenExpiresAt: connection.tokenExpiresAt
          ? connection.tokenExpiresAt.toISOString()
          : null,
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

export async function getMetaAdAccountsAction() {
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;

  try {
    const accounts = await db.query.metaAdAccounts.findMany({
      where: eq(metaAdAccounts.organizationId, orgId),
      orderBy: (metaAdAccounts, { asc }) => [asc(metaAdAccounts.name)],
    });

    return {
      success: true,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        metaAccountId: acc.metaAccountId,
        name: acc.name,
        currencyCode: acc.currencyCode,
        timeZone: acc.timeZone,
        isActive: acc.isActive,
        accountStatus: acc.accountStatus,
        lastSyncedAt: acc.lastSyncedAt?.toISOString() || null,
        syncStatus: acc.syncStatus,
      })),
    };
  } catch (err: any) {
    console.error("Error fetching Meta ad accounts:", err);
    return {
      success: false,
      error: err.message || "Failed to fetch ad accounts",
    };
  }
}

async function syncMetaAdAccountsInternal(
  orgId: string,
  connectionId: number,
  accessToken: string,
  businessId?: string | null,
) {
  const discoveredAccounts: Array<{
    id: string;
    account_id: string;
    name: string;
    currency?: string;
    timezone_name?: string;
    account_status?: number;
  }> = [];

  const seenIds = new Set<string>();

  // 1. Fetch client ad accounts from Business Manager if businessId exists
  if (businessId) {
    try {
      const bizRes = await fetch(
        `https://graph.facebook.com/v19.0/${businessId}/client_ad_accounts?fields=id,account_id,name,currency,timezone_name,account_status&access_token=${encodeURIComponent(accessToken)}&limit=100`,
      );
      const bizData = await bizRes.json();
      if (Array.isArray(bizData?.data)) {
        for (const acc of bizData.data) {
          const accId = acc.account_id || acc.id?.replace(/^act_/, "");
          if (accId && !seenIds.has(accId)) {
            seenIds.add(accId);
            discoveredAccounts.push(acc);
          }
        }
      }
    } catch (err) {
      console.warn("Error fetching client ad accounts from business:", err);
    }
  }

  // 2. Also fetch directly assigned ad accounts via /me/adaccounts
  try {
    const meAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status&access_token=${encodeURIComponent(accessToken)}&limit=100`,
    );
    const meAccountsData = await meAccountsRes.json();
    if (Array.isArray(meAccountsData?.data)) {
      for (const acc of meAccountsData.data) {
        const accId = acc.account_id || acc.id?.replace(/^act_/, "");
        if (accId && !seenIds.has(accId)) {
          seenIds.add(accId);
          discoveredAccounts.push(acc);
        }
      }
    }
  } catch (err) {
    console.warn("Error fetching ad accounts from /me/adaccounts:", err);
  }

  // 3. Upsert discovered accounts into metaAdAccounts
  for (const acc of discoveredAccounts) {
    const cleanId = acc.account_id || acc.id?.replace(/^act_/, "");
    const accStatus = acc.account_status ?? 1;
    const isActive = accStatus === 1;

    const existing = await db.query.metaAdAccounts.findFirst({
      where: eq(metaAdAccounts.metaAccountId, cleanId),
    });

    if (existing) {
      await db
        .update(metaAdAccounts)
        .set({
          name: acc.name || `Meta Ad Account ${cleanId}`,
          currencyCode: acc.currency || "USD",
          timeZone: acc.timezone_name || "Australia/Melbourne",
          accountStatus: accStatus,
          isActive,
          lastSyncedAt: new Date(),
          syncStatus: "success",
          syncError: null,
        })
        .where(eq(metaAdAccounts.id, existing.id));
    } else {
      await db.insert(metaAdAccounts).values({
        organizationId: orgId,
        connectionId,
        metaAccountId: cleanId,
        name: acc.name || `Meta Ad Account ${cleanId}`,
        currencyCode: acc.currency || "USD",
        timeZone: acc.timezone_name || "Australia/Melbourne",
        accountStatus: accStatus,
        isActive,
        lastSyncedAt: new Date(),
        syncStatus: "success",
        syncError: null,
      });
    }
  }

  return { count: discoveredAccounts.length };
}

export async function connectMetaPermanentTokenAction(input: {
  accessToken: string;
  businessId?: string;
}) {
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;
  const rawToken = input.accessToken?.trim();
  const businessId = input.businessId?.trim() || "2448649278688629";

  if (!rawToken) {
    return { success: false, error: "Meta Access Token is required." };
  }

  try {
    // 1. Verify token with Graph API /me
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(rawToken)}`,
    );
    const meData = await meRes.json();

    if (meData?.error) {
      return {
        success: false,
        error: `Meta API Verification Error: ${meData.error.message || "Invalid access token."}`,
      };
    }

    const metaUserId = meData?.id;
    const connectedName =
      meData?.name || `System User (${metaUserId || "Meta"})`;

    // 2. Check token debug info to inspect expiry and validity
    let tokenExpiresAt: Date | null = null;
    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(rawToken)}&access_token=${encodeURIComponent(rawToken)}`,
      );
      const debugData = await debugRes.json();
      if (debugData?.data) {
        const { expires_at, is_valid } = debugData.data;
        if (is_valid === false) {
          return {
            success: false,
            error: "The provided Meta token is marked as invalid by Facebook.",
          };
        }
        // If expires_at is positive, it's not permanent. If 0 or omitted, it's permanent.
        if (expires_at && expires_at > 0) {
          tokenExpiresAt = new Date(expires_at * 1000);
        }
      }
    } catch (debugErr) {
      console.warn(
        "Could not debug token, continuing with token validation:",
        debugErr,
      );
    }

    // 3. Encrypt token
    const encryptedToken = encryptToken(rawToken);

    // 4. Upsert connection in database
    const existingConn = await db.query.metaAdsConnections.findFirst({
      where: eq(metaAdsConnections.organizationId, orgId),
    });

    let connectionId: number;

    if (existingConn) {
      await db
        .update(metaAdsConnections)
        .set({
          connectedEmail: connectedName,
          metaUserId,
          businessId,
          accessToken: encryptedToken,
          tokenExpiresAt,
          status: "active",
          accessLevel: "system_user",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(metaAdsConnections.id, existingConn.id));
      connectionId = existingConn.id;
    } else {
      const [newConn] = await db
        .insert(metaAdsConnections)
        .values({
          organizationId: orgId,
          connectedEmail: connectedName,
          metaUserId,
          businessId,
          accessToken: encryptedToken,
          tokenExpiresAt,
          status: "active",
          accessLevel: "system_user",
          autoAddAccounts: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: metaAdsConnections.id });
      connectionId = newConn.id;
    }

    // 5. Automatically trigger an initial sync of ad accounts
    const syncResult = await syncMetaAdAccountsInternal(
      orgId,
      connectionId,
      rawToken,
      businessId,
    );

    return {
      success: true,
      message: "Meta System User connected successfully.",
      syncedAccountsCount: syncResult.count,
    };
  } catch (err: any) {
    console.error("Error connecting Meta permanent token:", err);
    return {
      success: false,
      error: err.message || "Failed to connect Meta System User token.",
    };
  }
}

export async function syncMetaAdAccountsAction() {
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;

  try {
    const connection = await db.query.metaAdsConnections.findFirst({
      where: eq(metaAdsConnections.organizationId, orgId),
    });

    if (!connection) {
      return { success: false, error: "No Meta connection found." };
    }

    const rawToken = decryptToken(connection.accessToken);
    const syncRes = await syncMetaAdAccountsInternal(
      orgId,
      connection.id,
      rawToken,
      connection.businessId,
    );

    return {
      success: true,
      syncedAccountsCount: syncRes.count,
    };
  } catch (err: any) {
    console.error("Error syncing Meta ad accounts:", err);
    return {
      success: false,
      error: err.message || "Failed to sync Meta ad accounts",
    };
  }
}

export async function disconnectMetaAdsAction() {
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;

  try {
    await db
      .delete(metaAdAccounts)
      .where(eq(metaAdAccounts.organizationId, orgId));

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
  const ctx = await getAuthOrgContext();

  if (!ctx) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = ctx.orgId;

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
