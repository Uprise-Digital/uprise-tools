import { db } from "../src/db";
import { organizationOnboardingSettings, clientOnboardings } from "../src/db/schema";
import { decryptToken } from "../src/lib/crypto";
import { fixNotionPageImagesRecursive } from "../src/service/notion-service";

async function main() {
  console.log("=== CONNECTING TO RAILWAY DATABASE & REPAIRING NOTION IMAGES ===");

  const settingsList = await db.select().from(organizationOnboardingSettings);
  console.log(`Found ${settingsList.length} organization settings row(s) in DB.`);

  if (settingsList.length === 0) {
    console.error("No organization settings found in database.");
    process.exit(1);
  }

  let grandTotalFixed = 0;
  let grandTotalPagesScanned = 0;

  for (const settings of settingsList) {
    let apiKey = process.env.NOTION_API_KEY || "";
    if (settings.notionApiKey) {
      try {
        apiKey = decryptToken(settings.notionApiKey);
      } catch (err: any) {
        console.warn("Could not decrypt DB notionApiKey:", err.message);
      }
    }

    if (!apiKey) {
      console.warn(`[Org ${settings.organizationId}] No Notion API key found in DB record.`);
      continue;
    }

    console.log(`\n[Org ID: ${settings.organizationId}] Notion API Key decrypted: ${apiKey.slice(0, 8)}...`);

    const pagesToScan: { name: string; id: string }[] = [];

    const templateId = settings.notionTemplatePageId || process.env.NOTION_TEMPLATE_PAGE_ID;
    const parentId = settings.notionParentPageId || process.env.NOTION_PARENT_PAGE_ID;

    if (templateId) {
      pagesToScan.push({ name: "Master Template Page", id: templateId });
    }
    if (parentId) {
      pagesToScan.push({ name: "Parent Dashboard Page", id: parentId });
    }

    // Get client onboardings for this org
    const clients = await db.select().from(clientOnboardings);
    console.log(`[Org ID: ${settings.organizationId}] Total client onboardings: ${clients.length}`);

    for (const client of clients) {
      if (client.notionDashboardLink) {
        const match = client.notionDashboardLink.match(/([a-f0-9]{32})/i) || client.notionDashboardLink.match(/([a-f0-9-]{36})/i);
        if (match && match[1]) {
          pagesToScan.push({
            name: `Client: ${client.clientName}`,
            id: match[1].replace(/-/g, ""),
          });
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniquePages = pagesToScan.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    console.log(`Found ${uniquePages.length} unique Notion page(s) to inspect for Org ${settings.organizationId}:`);
    for (const p of uniquePages) {
      console.log(`  - ${p.name} (ID: ${p.id})`);
    }

    for (const target of uniquePages) {
      console.log(`\nScanning & repairing ${target.name} (${target.id})...`);
      try {
        const res = await fixNotionPageImagesRecursive(apiKey, target.id);
        console.log(`   ✓ Done: scanned ${res.pageCount} page(s), fixed & re-hosted ${res.fixedCount} image(s) to R2.`);
        grandTotalFixed += res.fixedCount;
        grandTotalPagesScanned += res.pageCount;
      } catch (err: any) {
        console.error(`   ✕ Error scanning ${target.name}:`, err.message);
      }
    }
  }

  console.log("\n==========================================");
  console.log("🎉 RETROACTIVE NOTION REPAIR COMPLETE 🎉");
  console.log(`Total Pages Scanned: ${grandTotalPagesScanned}`);
  console.log(`Total Expired S3 Images Re-hosted to Cloudflare R2: ${grandTotalFixed}`);
  console.log("==========================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
