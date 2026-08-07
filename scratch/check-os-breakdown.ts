import * as dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.local" });

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const MANAGER_ID = process.env.GOOGLE_ADS_MANAGER_ID?.replace(/-/g, "");
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as any;
  return data.access_token;
}

async function run() {
  const accessToken = await getAccessToken();

  // Fetch client accounts
  const mccRes = await fetch(`https://googleads.googleapis.com/v23/customers/${MANAGER_ID}/googleAds:search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "developer-token": DEVELOPER_TOKEN!,
      Authorization: `Bearer ${accessToken}`,
      "login-customer-id": MANAGER_ID!,
    },
    body: JSON.stringify({
      query: `
        SELECT customer_client.id, customer_client.descriptive_name
        FROM customer_client
        WHERE customer_client.level <= 1
          AND customer_client.status = 'ENABLED'
          AND customer_client.manager = false
      `,
    }),
  });

  const mccData = (await mccRes.json()) as any;
  const clients = mccData.results || [];

  const osTotals: Record<string, { clicks: number; impressions: number; costMicros: number; conversions: number }> = {};
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalCostMicros = 0;
  let totalConversions = 0;

  for (const client of clients) {
    const custId = client.customerClient.id;
    const custName = client.customerClient.descriptiveName || custId;

    // Operating System Performance View
    const osQuery = `
      SELECT
        operating_system_version_constant.os_major_version,
        operating_system_version_constant.os_minor_version,
        operating_system_version_constant.operator_type,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions
      FROM os_version_view
      WHERE segments.date DURING LAST_30_DAYS
    `;

    try {
      const res = await fetch(`https://googleads.googleapis.com/v23/customers/${custId}/googleAds:search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "developer-token": DEVELOPER_TOKEN!,
          Authorization: `Bearer ${accessToken}`,
          "login-customer-id": MANAGER_ID!,
        },
        body: JSON.stringify({ query: osQuery }),
      });
      const data = (await res.json()) as any;
      if (data.error) {
        // Fallback or log error
        console.log(`OS View for ${custName}: ${data.error.message}`);
        continue;
      }

      const rows = data.results || [];
      for (const row of rows) {
        const opType = row.operatingSystemVersionConstant?.operatorType || "UNKNOWN";
        const major = row.operatingSystemVersionConstant?.osMajorVersion || "";
        const minor = row.operatingSystemVersionConstant?.osMinorVersion || "";
        const osName = `${opType} ${major}${minor ? "." + minor : ""}`.trim();

        const clicks = Number(row.metrics?.clicks || 0);
        const imps = Number(row.metrics?.impressions || 0);
        const cost = Number(row.metrics?.costMicros || 0);
        const convs = Number(row.metrics?.conversions || 0);

        if (!osTotals[osName]) {
          osTotals[osName] = { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 };
        }
        osTotals[osName].clicks += clicks;
        osTotals[osName].impressions += imps;
        osTotals[osName].costMicros += cost;
        osTotals[osName].conversions += convs;

        totalClicks += clicks;
        totalImpressions += imps;
        totalCostMicros += cost;
        totalConversions += convs;
      }
    } catch (e: any) {
      console.warn(`Error on ${custName}:`, e.message);
    }
  }

  console.log("\n=============================================");
  console.log("GOOGLE ADS OPERATING SYSTEM BREAKDOWN (LAST 30 DAYS)");
  console.log("=============================================\n");
  console.log(`Total Clicks in OS View: ${totalClicks}`);
  console.log(`Total Spend in OS View: $${(totalCostMicros / 1_000_000).toFixed(2)}`);

  console.table(
    Object.entries(osTotals)
      .sort((a, b) => b[1].clicks - a[1].clicks)
      .map(([os, m]) => ({
        "OS Version": os,
        Clicks: m.clicks.toLocaleString(),
        "Click Share": totalClicks > 0 ? ((m.clicks / totalClicks) * 100).toFixed(2) + "%" : "0%",
        Impressions: m.impressions.toLocaleString(),
        Spend: `$${(m.costMicros / 1_000_000).toFixed(2)}`,
        Conversions: m.conversions.toFixed(1),
      }))
  );
}

run().catch(console.error);
