import * as dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.local" });

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID?.replace(/-/g, "");
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
  if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing Google OAuth environment variables in .env.local");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as any;
  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

async function run() {
  console.log("=== Agency Device Share Analysis Script ===");
  console.log(`Manager ID: ${MANAGER_ID}`);
  console.log(`Developer Token present: ${!!DEVELOPER_TOKEN}`);

  const accessToken = await getAccessToken();
  console.log("OAuth Access Token obtained successfully.");

  // 1. Fetch child accounts under MCC
  const searchUrl = `https://googleads.googleapis.com/v23/customers/${MANAGER_ID}/googleAds:search`;
  const mccQuery = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.status,
      customer_client.manager,
      customer_client.test_account
    FROM customer_client
    WHERE customer_client.level <= 1
      AND customer_client.status = 'ENABLED'
      AND customer_client.manager = false
  `;

  const mccRes = await fetch(searchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "developer-token": DEVELOPER_TOKEN!,
      Authorization: `Bearer ${accessToken}`,
      "login-customer-id": MANAGER_ID!,
    },
    body: JSON.stringify({ query: mccQuery }),
  });

  const mccData = (await mccRes.json()) as any;
  if (mccData.error) {
    console.error("MCC Query Error:", JSON.stringify(mccData.error, null, 2));
    return;
  }

  const clients = mccData.results || [];
  console.log(`Found ${clients.length} active client accounts under MCC.`);

  // Device aggregators
  const totalsByDevice: Record<string, { impressions: number; clicks: number; costMicros: number; conversions: number }> = {};
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalCostMicros = 0;
  let totalConversions = 0;

  const accountBreakdowns: Array<{
    id: string;
    name: string;
    devices: Record<string, { impressions: number; clicks: number; costMicros: number; conversions: number }>;
  }> = [];

  for (const client of clients) {
    const custId = client.customerClient.id;
    const custName = client.customerClient.descriptiveName || `Account ${custId}`;
    
    // Query device performance for LAST_30_DAYS
    const deviceQuery = `
      SELECT
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
        AND campaign.status != 'REMOVED'
    `;

    try {
      const devRes = await fetch(`https://googleads.googleapis.com/v23/customers/${custId}/googleAds:search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": DEVELOPER_TOKEN!,
          Authorization: `Bearer ${accessToken}`,
          "login-customer-id": MANAGER_ID!,
        },
        body: JSON.stringify({ query: deviceQuery }),
      });
      const devData = (await devRes.json()) as any;
      if (devData.error) {
        console.warn(`[Warning] Could not query account ${custName} (${custId}): ${devData.error.message}`);
        continue;
      }

      const rows = devData.results || [];
      const acctDeviceMap: Record<string, { impressions: number; clicks: number; costMicros: number; conversions: number }> = {};

      for (const row of rows) {
        const dev = row.segments?.device || "UNKNOWN";
        const imps = Number(row.metrics?.impressions || 0);
        const clicks = Number(row.metrics?.clicks || 0);
        const cost = Number(row.metrics?.costMicros || 0);
        const convs = Number(row.metrics?.conversions || 0);

        if (!acctDeviceMap[dev]) {
          acctDeviceMap[dev] = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
        }
        acctDeviceMap[dev].impressions += imps;
        acctDeviceMap[dev].clicks += clicks;
        acctDeviceMap[dev].costMicros += cost;
        acctDeviceMap[dev].conversions += convs;

        if (!totalsByDevice[dev]) {
          totalsByDevice[dev] = { impressions: 0, clicks: 0, costMicros: 0, conversions: 0 };
        }
        totalsByDevice[dev].impressions += imps;
        totalsByDevice[dev].clicks += clicks;
        totalsByDevice[dev].costMicros += cost;
        totalsByDevice[dev].conversions += convs;

        totalImpressions += imps;
        totalClicks += clicks;
        totalCostMicros += cost;
        totalConversions += convs;
      }

      accountBreakdowns.push({ id: custId, name: custName, devices: acctDeviceMap });
    } catch (err: any) {
      console.warn(`Error processing ${custName}: ${err.message}`);
    }
  }

  console.log("\n=============================================");
  console.log("AGENCY-WIDE GOOGLE ADS DEVICE SHARE (LAST 30 DAYS)");
  console.log("=============================================\n");

  console.log(`Total Accounts Processed: ${accountBreakdowns.length}`);
  console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
  console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
  console.log(`Total Spend: $${(totalCostMicros / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Total Conversions: ${totalConversions.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}\n`);

  console.log("--- DEVICE BREAKDOWN SUMMARY ---");
  const deviceTable = Object.entries(totalsByDevice).map(([device, metrics]) => {
    const impShare = totalImpressions > 0 ? ((metrics.impressions / totalImpressions) * 100).toFixed(2) + "%" : "0%";
    const clickShare = totalClicks > 0 ? ((metrics.clicks / totalClicks) * 100).toFixed(2) + "%" : "0%";
    const spend = (metrics.costMicros / 1_000_000).toFixed(2);
    const spendShare = totalCostMicros > 0 ? ((metrics.costMicros / totalCostMicros) * 100).toFixed(2) + "%" : "0%";
    const convShare = totalConversions > 0 ? ((metrics.conversions / totalConversions) * 100).toFixed(2) + "%" : "0%";
    const ctr = metrics.impressions > 0 ? ((metrics.clicks / metrics.impressions) * 100).toFixed(2) + "%" : "0%";

    return {
      Device: device,
      Impressions: metrics.impressions.toLocaleString(),
      "Imp Share": impShare,
      Clicks: metrics.clicks.toLocaleString(),
      "Click Share": clickShare,
      "CTR": ctr,
      "Spend ($)": Number(spend).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      "Spend Share": spendShare,
      Conversions: metrics.conversions.toFixed(1),
      "Conv Share": convShare,
    };
  });

  console.table(deviceTable);

  console.log("\n--- ACCOUNT BREAKDOWN ---");
  accountBreakdowns.forEach((acct) => {
    console.log(`\nAccount: ${acct.name} (ID: ${acct.id})`);
    const rows = Object.entries(acct.devices).map(([dev, m]) => ({
      Device: dev,
      Clicks: m.clicks,
      Impressions: m.impressions,
      Spend: `$${(m.costMicros / 1_000_000).toFixed(2)}`,
      Conversions: m.conversions.toFixed(1),
    }));
    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log("  No ad performance data in last 30 days.");
    }
  });
}

run().catch((err) => console.error("Fatal Error running device share script:", err));
