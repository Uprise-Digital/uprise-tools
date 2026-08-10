import { Client } from "@notionhq/client";
import { db } from "../src/db";
import { organizationOnboardingSettings } from "../src/db/schema";
import { decryptToken } from "../src/lib/crypto";

const SALES_CYCLE_R2_URL =
  "https://pub-76a2919d321345868f6cb33accae2b1b.r2.dev/notion-assets/asset_1786345003291_zg4re.png";

async function fixBrokenImageBlocks() {
  console.log("=== FIXING BROKEN/EXPIRED IMAGE BLOCKS IN NOTION ===");

  const settingsList = await db.select().from(organizationOnboardingSettings);
  const apiKey = decryptToken(settingsList[0].notionApiKey!);
  const notion = new Client({ auth: apiKey });

  let fixedCount = 0;

  async function repairContainer(containerId: string) {
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const res: any = await notion.blocks.children.list({
        block_id: containerId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const block of res.results) {
        if (block.type === "child_page") {
          try {
            await repairContainer(block.id);
          } catch (e) {}
        } else if (block.type === "image") {
          const img = block.image;
          // Check if image URL is missing, expired, broken, or contains amazonaws/notion-static
          const isBroken =
            !img.file?.url && !img.external?.url;
          const isExpiringS3 =
            img.file?.url ||
            (img.external?.url &&
              (img.external.url.includes("amazonaws.com") ||
                img.external.url.includes("notion-static.com")));

          if (isBroken || isExpiringS3) {
            console.log(`Found broken/expired image block: ${block.id} (broken: ${isBroken})`);
            try {
              await notion.blocks.update({
                block_id: block.id,
                image: {
                  external: {
                    url: SALES_CYCLE_R2_URL,
                  },
                },
              } as any);
              fixedCount++;
              console.log(`   ✓ RESTORED image block ${block.id} to permanent R2 URL: ${SALES_CYCLE_R2_URL}`);
            } catch (err: any) {
              console.error(`   ✕ Failed to update block ${block.id}:`, err.message);
            }
          }
        }

        if (block.has_children && block.type !== "child_page") {
          try {
            await repairContainer(block.id);
          } catch (e) {}
        }
      }

      hasMore = res.has_more;
      startCursor = res.next_cursor || undefined;
    }
  }

  // Target Ray Amp Solar page specifically first
  const rayAmpSolarId = "3b20d9465bcd811582bcff8eefb5617e";
  console.log(`Repairing Ray Amp Solar page (${rayAmpSolarId})...`);
  await repairContainer(rayAmpSolarId);

  console.log(`\nDone! Total broken images restored: ${fixedCount}`);
  process.exit(0);
}

fixBrokenImageBlocks().catch(console.error);
