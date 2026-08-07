import * as dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env.local" });

const REFRESH_TOKEN =
  process.env.GOOGLE_ADS_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
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
    throw new Error(
      `Token refresh failed: ${data.error_description || data.error}`,
    );
  }
  return data.access_token;
}

async function run() {
  console.log("=== Checking GA4 Properties & Access ===");
  const accessToken = await getAccessToken();
  console.log("Access token generated successfully.");

  // 1. Try GA4 Admin API Account Summaries
  try {
    const adminRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const adminData = (await adminRes.json()) as any;

    if (adminData.error) {
      console.log("GA4 Admin API response error:", adminData.error.message);
    } else {
      console.log(
        "Account Summaries found:",
        adminData.accountSummaries?.length || 0,
      );
      const properties: Array<{ property: string; displayName: string }> = [];

      if (adminData.accountSummaries) {
        for (const acct of adminData.accountSummaries) {
          console.log(`Account: ${acct.displayName} (${acct.name})`);
          if (acct.propertySummaries) {
            for (const prop of acct.propertySummaries) {
              console.log(
                `  - Property: ${prop.displayName} (${prop.property})`,
              );
              properties.push({
                property: prop.property,
                displayName: prop.displayName,
              });
            }
          }
        }
      }

      if (properties.length > 0) {
        console.log(
          `\nFound ${properties.length} GA4 properties. Running Data API device model report...`,
        );
        await runGa4DeviceReport(accessToken, properties);
        return;
      }
    }
  } catch (err: any) {
    console.log("Error querying GA4 Admin API:", err.message);
  }
}

async function runGa4DeviceReport(
  accessToken: string,
  properties: Array<{ property: string; displayName: string }>,
) {
  const hardwareTotals: Record<
    string,
    { sessions: number; conversions: number; revenue: number }
  > = {};
  const brandTotals: Record<string, { sessions: number; conversions: number }> =
    {};

  let totalSessions = 0;
  let totalConversions = 0;

  for (const { property, displayName } of properties) {
    const propId = property.replace("properties/", "");
    console.log(
      `\nQuerying GA4 Data API for property ${displayName} (${propId})...`,
    );

    // Filter specifically for Google Ads traffic (sessionSourceMedium contains google / cpc)
    const reportBody = {
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

    try {
      const dataRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(reportBody),
        },
      );

      const data = (await dataRes.json()) as any;
      if (data.error) {
        console.warn(
          `  [Warning] GA4 Data API error for property ${displayName}:`,
          data.error.message,
        );
        continue;
      }

      const rows = data.rows || [];
      console.log(
        `  Retrieved ${rows.length} hardware model entries for ${displayName}.`,
      );

      for (const row of rows) {
        const model = row.dimensionValues?.[0]?.value || "Unknown Model";
        const brand = row.dimensionValues?.[1]?.value || "Unknown Brand";
        const os = row.dimensionValues?.[2]?.value || "Unknown OS";

        const sessions = Number(row.metricValues?.[0]?.value || 0);
        const convs = Number(row.metricValues?.[1]?.value || 0);
        const rev = Number(row.metricValues?.[2]?.value || 0);

        const fullKey = `${brand} ${model} (${os})`.trim();

        if (!hardwareTotals[fullKey]) {
          hardwareTotals[fullKey] = { sessions: 0, conversions: 0, revenue: 0 };
        }
        hardwareTotals[fullKey].sessions += sessions;
        hardwareTotals[fullKey].conversions += convs;
        hardwareTotals[fullKey].revenue += rev;

        if (!brandTotals[brand]) {
          brandTotals[brand] = { sessions: 0, conversions: 0 };
        }
        brandTotals[brand].sessions += sessions;
        brandTotals[brand].conversions += convs;

        totalSessions += sessions;
        totalConversions += convs;
      }
    } catch (e: any) {
      console.warn(`  Error calling GA4 report for ${displayName}:`, e.message);
    }
  }

  console.log("\n=============================================");
  console.log(
    "AGENCY GA4 HARDWARE SPECIFIC DEVICE BREAKDOWN (GOOGLE ADS TRAFFIC)",
  );
  console.log("=============================================\n");

  console.log(
    `Total Google Ads Sessions (GA4): ${totalSessions.toLocaleString()}`,
  );
  console.log(
    `Total Google Ads Conversions (GA4): ${totalConversions.toLocaleString()}\n`,
  );

  console.log("--- TOP HARDWARE MODELS ---");
  const modelTable = Object.entries(hardwareTotals)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 30)
    .map(([model, m]) => ({
      "Hardware Model": model,
      Sessions: m.sessions.toLocaleString(),
      "Session Share":
        totalSessions > 0
          ? `${((m.sessions / totalSessions) * 100).toFixed(2)}%`
          : "0%",
      Conversions: m.conversions.toLocaleString(),
      "Conv Share":
        totalConversions > 0
          ? `${((m.conversions / totalConversions) * 100).toFixed(2)}%`
          : "0%",
      Revenue: `$${m.revenue.toFixed(2)}`,
    }));

  console.table(modelTable);

  console.log("\n--- BRAND BREAKDOWN ---");
  const brandTable = Object.entries(brandTotals)
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .map(([brand, m]) => ({
      Brand: brand,
      Sessions: m.sessions.toLocaleString(),
      "Session Share":
        totalSessions > 0
          ? `${((m.sessions / totalSessions) * 100).toFixed(2)}%`
          : "0%",
      Conversions: m.conversions.toLocaleString(),
      "Conv Share":
        totalConversions > 0
          ? `${((m.conversions / totalConversions) * 100).toFixed(2)}%`
          : "0%",
    }));

  console.table(brandTable);
}

run().catch((err) => console.error("Fatal Error:", err));
