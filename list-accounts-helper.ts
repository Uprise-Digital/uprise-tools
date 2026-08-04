import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const apiKey = "pit-3d8b8a44-5f9f-48b8-b522-721d098184b0";
const locationId = "4DzNF3tH5ln9gwq7GtjW";
const companyId = "BwvkM3wHfHWTcRf9EO3t";

async function testEndpoint(name: string, url: string) {
  console.log(`\n=== ${name} ===`);
  console.log(`URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-04-15",
        "Content-Type": "application/json",
      },
    });
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      console.log("Parsed Result:", JSON.stringify(parsed, null, 2).slice(0, 2500));
    } catch {
      console.log("Raw Result:", text.slice(0, 1000));
    }
  } catch (err: any) {
    console.error("Fetch error:", err.message);
  }
}

async function run() {
  await testEndpoint("1. GET /snapshots/ (Agency Snapshots)", `${GHL_API_BASE}/snapshots/`);
  await testEndpoint(
    "2. GET /snapshots/?companyId=... (Company Snapshots)",
    `${GHL_API_BASE}/snapshots/?companyId=${companyId}`,
  );
  await testEndpoint(
    "3. GET /locations/search (List Agency Locations)",
    `${GHL_API_BASE}/locations/search?companyId=${companyId}`,
  );
  await testEndpoint(
    "4. GET /contacts/?locationId=... (Search/Pull Contacts)",
    `${GHL_API_BASE}/contacts/?locationId=${locationId}`,
  );
  await testEndpoint(
    "5. GET /locations/{locationId}/templates (Location Templates)",
    `${GHL_API_BASE}/locations/${locationId}/templates`,
  );
}

run();






