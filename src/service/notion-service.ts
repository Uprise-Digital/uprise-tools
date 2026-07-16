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
 * Replaces variables inside double curly braces (e.g. {{client_name}}).
 */
function replaceVariables(
  pattern: string,
  variables: Record<string, string>,
): string {
  let result = pattern;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, val);
  }
  return result;
}

/**
 * Recursively fetches all blocks from a source page and appends them to a target page.
 * If recursive is true, it also duplicates nested child pages.
 */
async function duplicateNotionPageBlocks(
  notion: Client,
  sourcePageId: string,
  targetPageId: string,
  recursive = false,
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

      if (block.type === "child_page") {
        if (recursive) {
          try {
            console.log(
              `Notion Service: Duplicating nested subpage '${block.child_page.title}' under parent ${targetPageId}...`,
            );
            // Create the subpage under target page
            const newSubpage = await notion.pages.create({
              parent: { page_id: targetPageId },
              properties: {
                title: {
                  title: [
                    {
                      text: {
                        content: block.child_page.title,
                      },
                    },
                  ],
                },
              },
              icon: {
                type: "emoji",
                emoji: "📄",
              },
            });
            // Recursively duplicate blocks from old child page to new child page
            await duplicateNotionPageBlocks(
              notion,
              block.id,
              newSubpage.id,
              true,
            );
          } catch (err: any) {
            console.warn(
              `Failed to duplicate nested subpage ${block.id}:`,
              err.message,
            );
          }
        } else {
          console.log(
            `Notion Service: Skipping child page block '${block.child_page?.title || "untitled"}' because recursive copy is disabled.`,
          );
        }
      } else {
        blocksToAppend.push(appendableBlock);
      }
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

export async function createClientNotionDashboard(
  clientName: string,
  customApiKey?: string,
  customParentPageId?: string,
  customTemplatePageId?: string,
  options?: {
    mode?: "copy-page" | "copy-page-with-subpages" | "create-blank-page";
    pageNamePattern?: string;
    pageIcon?: string;
  },
): Promise<string> {
  const notion = customApiKey
    ? new Client({ auth: customApiKey })
    : getNotionClient();

  const parentPageId = customParentPageId || process.env.NOTION_PARENT_PAGE_ID;
  const templatePageId =
    customTemplatePageId || process.env.NOTION_TEMPLATE_PAGE_ID;

  if (!parentPageId) {
    throw new Error(
      "Missing Notion Parent Page ID. Please define NOTION_PARENT_PAGE_ID in env or organization settings.",
    );
  }

  // 1. Resolve naming pattern
  const pattern =
    options?.pageNamePattern ||
    "Uprise Digital x {{client_name}} - Client Dashboard";
  const resolvedPageName = replaceVariables(pattern, {
    client_name: clientName,
  });

  const pageIcon = options?.pageIcon || "🚀";
  const mode =
    options?.mode || (templatePageId ? "copy-page" : "create-blank-page");

  console.log(
    `Notion Service: Creating dashboard '${resolvedPageName}' (mode: ${mode})...`,
  );

  // 2. Create the parent page
  const newPage = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [
          {
            text: {
              content: resolvedPageName,
            },
          },
        ],
      },
    },
    icon: {
      type: "emoji",
      emoji: pageIcon as any,
    },
  });

  const pageId = newPage.id.replace(/-/g, "");

  // 3. Populate blocks based on mode
  if (mode === "copy-page" || mode === "copy-page-with-subpages") {
    if (!templatePageId) {
      throw new Error(`Template Page ID is required for mode ${mode}`);
    }
    console.log(
      `Notion Service: Duplicating template page blocks from: ${templatePageId}`,
    );
    try {
      const recursive = mode === "copy-page-with-subpages";
      await duplicateNotionPageBlocks(
        notion,
        templatePageId,
        newPage.id,
        recursive,
      );
    } catch (err: any) {
      console.error(
        "Failed to copy template blocks, falling back to basic workspace...",
        err,
      );
      await appendDefaultWorkspaceBlocks(notion, newPage.id, clientName);
    }
  } else {
    // create-blank-page
    console.log("Notion Service: Appending default workspace blocks...");
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
            { text: { content: "Uprise Tools Overview: " } },
            {
              text: {
                content: "https://tools.uprisedigital.com.au",
                link: { url: "https://tools.uprisedigital.com.au" },
              },
            },
          ],
        },
      },
    ],
  });
}

/**
 * Verifies if a Notion page is accessible.
 */
export async function verifyNotionConnection(
  apiKey: string,
  pageId: string,
): Promise<boolean> {
  const notion = new Client({ auth: apiKey });
  try {
    const res = await notion.pages.retrieve({ page_id: pageId });
    if (!res || !res.id) {
      throw new Error("Specified Notion page was not found.");
    }
    return true;
  } catch (err: any) {
    throw new Error(err.message || "Failed to verify Notion connection.");
  }
}
