import * as dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.local" });

/**
 * GA4 Hardware-Specific Device Breakdown Script
 *
 * Google Analytics 4 (GA4) captures hardware-specific device strings via HTTP User-Agent / Client-Hints
 * when users arrive on your landing pages from Google Ads (google / cpc).
 *
 * Required OAuth Scope: https://www.googleapis.com/auth/analytics.readonly
 */

const REFRESH_TOKEN =
  process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_ADS_REFRESH_TOKEN;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Specify one or multiple GA4 Property IDs (e.g. ['312345678', '409876543'])
const GA4_PROPERTY_IDS: string[] = process.env.GA4_PROPERTY_IDS
  ? process.env.GA4_PROPERTY_IDS.split(",")
  : [];

async function getAccessToken(): Promise<string> {
  if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Missing OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) in .env.local",
    );
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
    throw new Error(
      `Token refresh failed: ${data.error_description || data.error}`,
    );
  }
  return data.access_token;
}

export async function fetchHardwareBreakdownForProperty(
  propertyId: string,
  accessToken: string,
) {
  const cleanId = propertyId.trim().replace("properties/", "");
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${cleanId}:runReport`;

  const requestBody = {
    dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
    dimensions: [
      { name: "deviceModel" },
      { name: "mobileDeviceBranding" },
      { name: "operatingSystem" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "conversions" },
      { name: "totalRevenue" },
    ],
    dimensionFilter: {
      filter: {
        fieldName: "sessionSourceMedium",
        stringFilter: {
          matchType: "CONTAINS",
          value: "google / cpc",
        },
      },
    },
    limit: 100,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await res.json()) as any;
  if (data.error) {
    console.error(
      `Error querying GA4 Property ${cleanId}: ${data.error.message}`,
    );
    return null;
  }

  return data;
}

async function main() {
  console.log(
    "=== GA4 Hardware-Specific Device Breakdown (Google Ads Traffic) ===",
  );

  if (GA4_PROPERTY_IDS.length === 0) {
    console.log(
      "\n[Notice] No GA4 Property IDs provided in env variable GA4_PROPERTY_IDS.",
    );
    console.log(
      "Usage: Add GA4_PROPERTY_IDS=123456789,987654321 to .env.local or pass property IDs.",
    );
    return;
  }

  const accessToken = await getAccessToken();

  const hardwareAggregates: Record<
    string,
    { sessions: number; conversions: number; revenue: number }
  > = {};
  let totalAgencySessions = 0;
  let totalAgencyConversions = 0;

  for (const propId of GA4_PROPERTY_IDS) {
    console.log(`\nQuerying GA4 Property: ${propId}...`);
    const reportData = await fetchHardwareBreakdownForProperty(
      propId,
      accessToken,
    );
    if (!reportData || !reportData.rows) continue;

    for (const row of reportData.rows) {
      const model = row.dimensionValues?.[0]?.value || "Unknown Model";
      const brand = row.dimensionValues?.[1]?.value || "Unknown Brand";
      const os = row.dimensionValues?.[2]?.value || "Unknown OS";

      const sessions = Number(row.metricValues?.[0]?.value || 0);
      const conversions = Number(row.metricValues?.[1]?.value || 0);
      const revenue = Number(row.metricValues?.[2]?.value || 0);

      const label = `${brand} ${model} (${os})`;

      if (!hardwareAggregates[label]) {
        hardwareAggregates[label] = { sessions: 0, conversions: 0, revenue: 0 };
      }

      hardwareAggregates[label].sessions += sessions;
      hardwareAggregates[label].conversions += conversions;
      hardwareAggregates[label].revenue += revenue;

      totalAgencySessions += sessions;
      totalAgencyConversions += conversions;
    }
  }

  console.log("\n=============================================");
  console.log("AGENCY HARDWARE-SPECIFIC DEVICE BREAKDOWN SUMMARY");
  console.log("=============================================\n");

  console.log(`Total Sessions: ${totalAgencySessions.toLocaleString()}`);
  console.log(
    `Total Conversions: ${totalAgencyConversions.toLocaleString()}\n`,
  );

  const sortedHardware = Object.entries(hardwareAggregates)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .map(([device, m]) => ({
      "Hardware Model": device,
      Sessions: m.sessions.toLocaleString(),
      "Session Share":
        totalAgencySessions > 0
          ? `${((m.sessions / totalAgencySessions) * 100).toFixed(2)}%`
          : "0%",
      Conversions: m.conversions.toLocaleString(),
      "Conv Share":
        totalAgencyConversions > 0
          ? `${((m.conversions / totalAgencyConversions) * 100).toFixed(2)}%`
          : "0%",
      Revenue: `$${m.revenue.toFixed(2)}`,
    }));

  console.table(sortedHardware);
}

main().catch(console.error);
