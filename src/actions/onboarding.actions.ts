"use server";

import { generateId } from "better-auth";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  adAccounts,
  backgroundTasks,
  googleAdsConnections,
  member,
  organization,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;

// --- Helper: Exchange refresh token for access token ---
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
  return data.access_token;
}

// --- Action 1: Create Organization ---
export async function createOrganizationAction(payload: {
  name: string;
  description: string;
  autoJoinDomain: boolean;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  const userDomain = userEmail.split("@")[1];

  const orgId = generateId();
  const slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const metadata = JSON.stringify({
    description: payload.description,
    autoJoinDomain: payload.autoJoinDomain ? userDomain : null,
  });

  // 1. Insert organization
  await db.insert(organization).values({
    id: orgId,
    name: payload.name,
    slug: slug,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: metadata,
  });

  // 2. Insert member as owner
  await db.insert(member).values({
    id: generateId(),
    organizationId: orgId,
    userId: userId,
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { success: true, organizationId: orgId };
}

// --- Helper: Fetch Google Ads Customer Details via Search Query ---
async function fetchCustomerDetailsInternal(
  accessToken: string,
  customerId: string,
) {
  const sanitizedId = customerId.replace(/-/g, "");
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.manager,
      customer.currency_code,
      customer.time_zone
    FROM customer
  `;
  const response = await fetch(
    `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    },
  );
  const data = await response.json();
  if (data.error) {
    throw new Error(
      `Google Ads API error fetching details for ${customerId}: ${data.error.message}`,
    );
  }
  const customer = data.results?.[0]?.customer;
  if (!customer) {
    throw new Error(`No customer details found for ${customerId}`);
  }
  return {
    id: customer.id.toString(),
    name: customer.descriptiveName || `Account (${customerId})`,
    manager: customer.manager ?? false,
    currencyCode: customer.currencyCode || "AUD",
    timeZone: customer.timeZone || "Australia/Melbourne",
  };
}

// --- Action 2: Get Accessible Google Ads Manager Accounts ---
export async function getAccessibleManagerAccountsAction(connectionId: number) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Fetch connection
  const conn = await db.query.googleAdsConnections.findFirst({
    where: eq(googleAdsConnections.id, connectionId),
  });

  if (!conn) {
    throw new Error("Google Ads connection not found");
  }

  try {
    const decToken = decryptToken(conn.refreshToken);
    const accessToken = await getAccessToken(decToken);

    // Fetch accessible customer list
    const listUrl =
      "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers";
    const listRes = await fetch(listUrl, {
      headers: {
        "developer-token": DEVELOPER_TOKEN,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const listData = await listRes.json();

    if (listData.error) {
      throw new Error(`Google Ads API list error: ${listData.error.message}`);
    }

    const resourceNames: string[] = listData.resourceNames || [];
    const accounts: { id: string; name: string; manager: boolean }[] = [];

    // Fetch details for each customer to check names and manager flag using search
    for (const resName of resourceNames) {
      try {
        const customerId = resName.split("/")[1];
        const detail = await fetchCustomerDetailsInternal(
          accessToken,
          customerId,
        );
        accounts.push({
          id: customerId,
          name: detail.name,
          manager: detail.manager,
        });
      } catch (err) {
        console.error(`Error fetching descriptive name for ${resName}:`, err);
      }
    }

    return { success: true, accounts };
  } catch (error: any) {
    console.error("Failed to get accessible manager accounts:", error);
    return { success: false, error: error.message };
  }
}

// --- Action 2.5: Fetch Sub-Accounts for Selection ---
export async function fetchSubAccountsForPreviewAction(payload: {
  connectionId: number;
  managerCustomerId: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const conn = await db.query.googleAdsConnections.findFirst({
    where: eq(googleAdsConnections.id, payload.connectionId),
  });

  if (!conn) {
    throw new Error("Google Ads connection not found");
  }

  const decToken = decryptToken(conn.refreshToken);

  try {
    const accessToken = await getAccessToken(decToken);
    const sanitizedId = payload.managerCustomerId.replace(/-/g, "");

    // 1. Fetch descriptive details to determine if it is a manager
    const detail = await fetchCustomerDetailsInternal(accessToken, sanitizedId);
    const isManager = detail.manager;

    let accounts: {
      id: string;
      name: string;
      currencyCode: string;
      timeZone: string;
      status: string;
      optimizationScore: number | null;
    }[] = [];

    if (isManager) {
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

      const response = await fetch(
        `https://googleads.googleapis.com/v23/customers/${sanitizedId}/googleAds:search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "developer-token": DEVELOPER_TOKEN,
            Authorization: `Bearer ${accessToken}`,
            "login-customer-id": sanitizedId,
          },
          body: JSON.stringify({ query }),
        },
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(`Google Ads API error: ${data.error.message}`);
      }

      const results = data.results || [];
      accounts = results.map((row: any) => {
        const client = row.customerClient;
        return {
          id: client.id.toString(),
          name: client.descriptiveName || `Client Account (${client.id})`,
          currencyCode: client.currencyCode || "AUD",
          timeZone: client.timeZone || "Australia/Melbourne",
          status: client.status || "ENABLED",
          optimizationScore: null,
        };
      });
    } else {
      // Standard client account: return the account itself as the single option
      accounts = [
        {
          id: detail.id,
          name: detail.name,
          currencyCode: detail.currencyCode,
          timeZone: detail.timeZone,
          status: "ENABLED",
          optimizationScore: null,
        },
      ];
    }

    return { success: true, accounts };
  } catch (error: any) {
    console.error("Failed to fetch sub-accounts for preview:", error);
    return { success: false, error: error.message };
  }
}

// --- Action 3: Link Manager Account & Import Clients ---
export async function linkManagerAccountAction(payload: {
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

  // Fetch connection
  const conn = await db.query.googleAdsConnections.findFirst({
    where: eq(googleAdsConnections.id, payload.connectionId),
  });

  if (!conn) {
    throw new Error("Google Ads connection not found");
  }

  const orgId = conn.organizationId;
  const decToken = decryptToken(conn.refreshToken);

  try {
    const accessToken = await getAccessToken(decToken);

    // 1. Fetch descriptive details of the selected customer using search
    const detail = await fetchCustomerDetailsInternal(
      accessToken,
      payload.managerCustomerId,
    );
    const isManager = detail.manager;
    const sanitizedId = payload.managerCustomerId.replace(/-/g, "");

    // 2. Import accounts
    const accountsToInsert: {
      googleAccountId: string;
      name: string;
      currencyCode: string;
      timeZone: string;
      googleStatus: string;
      organizationId: string;
      connectionId: number;
      isActive: boolean;
    }[] = [];

    if (isManager) {
      // Query the sub-accounts under this MCC
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
            "developer-token": DEVELOPER_TOKEN,
            Authorization: `Bearer ${accessToken}`,
            "login-customer-id": sanitizedId,
          },
          body: JSON.stringify({ query }),
        },
      );
      const searchData = await searchRes.json();

      if (searchData.error) {
        throw new Error(
          `Failed to fetch client accounts under MCC: ${searchData.error.message}`,
        );
      }

      const results = searchData.results || [];
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
    } else {
      // Standard account, just import it directly
      accountsToInsert.push({
        googleAccountId: sanitizedId,
        name: detail.name || `Ads Account (${sanitizedId})`,
        currencyCode: detail.currencyCode || "AUD",
        timeZone: detail.timeZone || "Australia/Melbourne",
        googleStatus: "ENABLED",
        organizationId: orgId,
        connectionId: conn.id,
        isActive: true,
      });
    }

    // 3. Batch insert client accounts into DB (ignoring conflicts or updating details)
    if (accountsToInsert.length > 0) {
      await db
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

    // 4. Update connection record
    await db
      .update(googleAdsConnections)
      .set({
        managerCustomerId: payload.managerCustomerId,
        status: "active",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(googleAdsConnections.id, conn.id));

    // 5. Trigger background sync for the newly imported accounts (last 30 days)
    const endDateStr = new Date().toISOString().split("T")[0];
    const startDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    db.insert(backgroundTasks)
      .values({
        organizationId: orgId,
        name: "Google Ads Portfolio Sync",
        status: "running",
      })
      .returning({ id: backgroundTasks.id })
      .then(([taskRecord]) => {
        if (!taskRecord) return;

        import("@/actions/agency.actions").then(
          ({ syncAgencyPortfolioAction }) => {
            console.log(
              `[Onboarding] Triggering background sync for ${accountsToInsert.length} accounts from ${startDateStr} to ${endDateStr}`,
            );
            syncAgencyPortfolioAction(startDateStr, endDateStr, {
              organizationId: orgId,
              backgroundTaskId: taskRecord.id,
            });
          },
        );
      })
      .catch((err) => {
        console.error("Failed to create background task log:", err);
      });

    return { success: true, importedCount: accountsToInsert.length };
  } catch (error: any) {
    console.error("Failed to link manager account and import clients:", error);
    return { success: false, error: error.message };
  }
}
