"use server";
import { db } from "@/db";
import { organizationOnboardingSettings, clientOnboardings } from "@/db/schema";
import { decryptToken } from "@/lib/crypto";
import { fixNotionPageImagesRecursive } from "@/service/notion-service";

/**
 * Server action to retroactively scan and repair all Notion templates & copied client dashboards,
 * replacing expiring AWS S3 image URLs with permanent Cloudflare R2 URLs.
 */
export async function repairNotionImagesAction(customPageId?: string) {
  try {
    const settingsList = await db.select().from(organizationOnboardingSettings);
    const settings = settingsList[0];

    let apiKey = process.env.NOTION_API_KEY || "";
    if (settings?.notionApiKey) {
      try {
        apiKey = decryptToken(settings.notionApiKey);
      } catch (err) {
        console.warn("Failed to decrypt Notion API key:", err);
      }
    }

    if (!apiKey) {
      return {
        success: false,
        error: "No valid Notion API key configured in system or env.",
      };
    }

    const pagesToRepair: string[] = [];

    if (customPageId) {
      pagesToRepair.push(customPageId);
    } else {
      // 1. Template page
      const templateId =
        settings?.notionTemplatePageId || process.env.NOTION_TEMPLATE_PAGE_ID;
      if (templateId) pagesToRepair.push(templateId);

      // 2. Parent page
      const parentId =
        settings?.notionParentPageId || process.env.NOTION_PARENT_PAGE_ID;
      if (parentId) pagesToRepair.push(parentId);

      // 3. Client onboarding pages
      const clients = await db.select().from(clientOnboardings);
      for (const client of clients) {
        if (client.notionDashboardLink) {
          // Extract page ID from URL (e.g. https://notion.so/uprisedigital/32charhexid)
          const match = client.notionDashboardLink.match(/([a-f0-9]{32})/i);
          if (match && match[1]) {
            pagesToRepair.push(match[1]);
          }
        }
      }
    }

    // Deduplicate page IDs
    const uniquePages = Array.from(new Set(pagesToRepair));
    let totalFixed = 0;
    let totalPagesScanned = 0;

    for (const pageId of uniquePages) {
      try {
        const result = await fixNotionPageImagesRecursive(apiKey, pageId);
        totalFixed += result.fixedCount;
        totalPagesScanned += result.pageCount;
      } catch (err: any) {
        console.warn(`Failed to repair Notion page ${pageId}:`, err.message);
      }
    }

    return {
      success: true,
      scannedPages: totalPagesScanned,
      fixedImages: totalFixed,
      message: `Scanned ${totalPagesScanned} Notion page(s) and repaired ${totalFixed} image(s) to permanent Cloudflare R2 storage.`,
    };
  } catch (error: any) {
    console.error("repairNotionImagesAction failed:", error);
    return {
      success: false,
      error: error.message || "Failed to repair Notion images.",
    };
  }
}
