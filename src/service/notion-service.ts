import { Client } from "@notionhq/client";

/**
 * Initializes a Notion client using the integration API key.
 */
function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing Notion API Key. Please define NOTION_API_KEY in env.",
    );
  }
  return new Client({ auth: apiKey });
}

/**
 * Recursively fetches all blocks from a source page and appends them to a target page.
 */
async function duplicateNotionPageBlocks(
  notion: Client,
  sourcePageId: string,
  targetPageId: string,
) {
  let hasMore = true;
  let startCursor: string | undefined;
  const blocksToAppend: any[] = [];

  // 1. Fetch source page blocks
  while (hasMore) {
    const res: any = await notion.blocks.children.list({
      block_id: sourcePageId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of res.results) {
      // Remove read-only block attributes to allow creation
      const {
        id,
        parent,
        has_children,
        created_time,
        last_edited_time,
        created_by,
        last_edited_by,
        ...appendableBlock
      } = block;
      blocksToAppend.push(appendableBlock);
    }

    hasMore = res.has_more;
    startCursor = res.next_cursor || undefined;
  }

  // 2. Append blocks to target in chunks of 100
  for (let i = 0; i < blocksToAppend.length; i += 100) {
    const chunk = blocksToAppend.slice(i, i + 100);
    await notion.blocks.children.append({
      block_id: targetPageId,
      children: chunk,
    });
  }
}

/**
 * Creates a client dashboard in Notion.
 * Duplicates a template page if configured, or builds a clean onboarding workspace from scratch.
 */
export async function createClientNotionDashboard(
  clientName: string,
): Promise<string> {
  const notion = getNotionClient();
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  const templatePageId = process.env.NOTION_TEMPLATE_PAGE_ID;

  if (!parentPageId) {
    throw new Error(
      "Missing Notion Parent Page ID. Please define NOTION_PARENT_PAGE_ID in env.",
    );
  }

  console.log(
    `Notion Service: Creating dashboard for client '${clientName}'...`,
  );

  // 1. Create a blank page under the parent page
  const newPage = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [
          {
            text: {
              content: `Uprise Digital x ${clientName} - Client Dashboard`,
            },
          },
        ],
      },
    },
    icon: {
      type: "emoji",
      emoji: "🚀",
    },
  });

  const pageId = newPage.id.replace(/-/g, "");

  // 2. If a template page is configured, copy its blocks
  if (templatePageId) {
    console.log(
      `Notion Service: Duplicating template page blocks from: ${templatePageId}`,
    );
    try {
      await duplicateNotionPageBlocks(notion, templatePageId, newPage.id);
    } catch (err) {
      console.error(
        "Failed to copy template blocks, falling back to basic workspace...",
        err,
      );
      await appendDefaultWorkspaceBlocks(notion, newPage.id, clientName);
    }
  } else {
    // 3. Otherwise, append standard Uprise onboarding blocks
    console.log(
      "Notion Service: No template page configured. Appending default workspace blocks...",
    );
    await appendDefaultWorkspaceBlocks(notion, newPage.id, clientName);
  }

  return `https://notion.so/uprisedigital/${pageId}`;
}

/**
 * Appends default client workspace blocks.
 */
async function appendDefaultWorkspaceBlocks(
  notion: Client,
  pageId: string,
  clientName: string,
) {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [
            {
              text: {
                content: `Welcome to your Uprise Client Workspace, ${clientName}! 👋`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              text: {
                content:
                  "This workspace is our central dashboard for collaborating on campaigns, tracking objectives, sharing creative assets, and reviewing monthly performance reports.",
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "📋 Onboarding Checklist" } }],
        },
      },
      {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [
            {
              text: {
                content:
                  "Provide Google Ads 10-Digit Customer ID & Whitelist Uprise Domain",
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [
            {
              text: {
                content:
                  "Assign permissions to Uprise Digital Partner on Meta Business Manager",
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [
            {
              text: {
                content:
                  "Upload branding assets, logos, and raw video folders to Google Drive",
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ text: { content: "🔗 Quick Links" } }],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { text: { content: "Google Ads Dashboard: " } },
            {
              text: {
                content: "https://ads.google.com",
                link: { url: "https://ads.google.com" },
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { text: { content: "Meta Business Manager: " } },
            {
              text: {
                content: "https://business.facebook.com",
                link: { url: "https://business.facebook.com" },
              },
            },
          ],
        },
      },
    ],
  });
}
