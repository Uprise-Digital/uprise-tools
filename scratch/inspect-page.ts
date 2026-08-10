import { Client } from "@notionhq/client";
import { db } from "../src/db";
import { organizationOnboardingSettings } from "../src/db/schema";
import { decryptToken } from "../src/lib/crypto";

async function inspectPage() {
  const pageId = "3b20d9465bcd811582bcff8eefb5617e";
  console.log(`=== INSPECTING PAGE ${pageId} ===`);

  const settingsList = await db.select().from(organizationOnboardingSettings);
  const apiKey = decryptToken(settingsList[0].notionApiKey!);
  const notion = new Client({ auth: apiKey });

  async function dumpBlocks(blockId: string, depth = 0) {
    const indent = "  ".repeat(depth);
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const res: any = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const block of res.results) {
        console.log(`${indent}- Block ID: ${block.id} | Type: ${block.type}`);
        if (block.type === "image" || block.type === "file" || block.type === "video" || block.type === "embed") {
          console.log(`${indent}  FULL OBJECT:`, JSON.stringify(block[block.type], null, 2));
        }

        if (block.has_children) {
          await dumpBlocks(block.id, depth + 1);
        }
      }

      hasMore = res.has_more;
      startCursor = res.next_cursor || undefined;
    }
  }

  await dumpBlocks(pageId);
  process.exit(0);
}

inspectPage().catch(console.error);
