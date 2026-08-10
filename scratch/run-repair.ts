import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fixNotionPageImagesRecursive } from "../src/service/notion-service";

async function runRepairCLI() {
  console.log("=== NOTION RETROACTIVE IMAGE REPAIR SCRIPT ===");

  const args = process.argv.slice(2);

  let apiKey = args[0] || process.env.NOTION_API_KEY || "";
  let targetPage = args[1] || process.env.NOTION_TEMPLATE_PAGE_ID || process.env.NOTION_PARENT_PAGE_ID || "";

  if (!apiKey || !targetPage) {
    console.log("\nUsage:");
    console.log("  npx tsx scratch/run-repair.ts <NOTION_API_KEY> <NOTION_PAGE_ID_OR_URL>\n");
    console.log("Example:");
    console.log("  npx tsx scratch/run-repair.ts ntn_123456... https://notion.so/uprisedigital/32charhexid\n");
    process.exit(1);
  }

  // Clean page ID from URL if full URL is passed
  const match = targetPage.match(/([a-f0-9]{32})/i) || targetPage.match(/([a-f0-9-]{36})/i);
  const cleanPageId = match ? match[1].replace(/-/g, "") : targetPage.replace(/-/g, "");

  console.log(`Using API Key: ${apiKey.slice(0, 10)}...`);
  console.log(`Target Page ID: ${cleanPageId}`);
  console.log("Scanning page and subpages for temporary/broken AWS S3 images...\n");

  try {
    const res = await fixNotionPageImagesRecursive(apiKey, cleanPageId);
    console.log("\n=== REPAIR COMPLETE ===");
    console.log(`Total Notion Pages/Subpages Scanned: ${res.pageCount}`);
    console.log(`Total Images Repaired & Re-hosted to Cloudflare R2: ${res.fixedCount}`);
  } catch (err: any) {
    console.error("Error during Notion image repair:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

runRepairCLI().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
