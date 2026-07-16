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

const CONTENT_ALLOWLIST: Record<string, string[]> = {
  paragraph: ["rich_text", "color", "children"],
  heading_1: ["rich_text", "color", "is_toggleable", "children"],
  heading_2: ["rich_text", "color", "is_toggleable", "children"],
  heading_3: ["rich_text", "color", "is_toggleable", "children"],
  bulleted_list_item: ["rich_text", "color", "children"],
  numbered_list_item: ["rich_text", "color", "children"],
  to_do: ["rich_text", "checked", "color", "children"],
  toggle: ["rich_text", "color", "children"],
  callout: ["rich_text", "icon", "color", "children"],
  quote: ["rich_text", "color", "children"],
  code: ["rich_text", "language", "caption"],
  divider: [],
  column_list: ["children"],
  column: ["children"], // width_ratio intentionally omitted — let Notion auto-distribute
  table: ["table_width", "has_column_header", "has_row_header", "children"],
  table_row: ["cells"],
  image: ["type", "external", "file", "caption"],
  bookmark: ["url", "caption"],
  embed: ["url"],
  equation: ["expression"],
  synced_block: ["synced_from", "children"],
};

/**
 * Sanitizes a block for creation, removing read-only metadata fields
 * and stripping null values (such as icon: null or color: null) that fail Notion API validation.
 */
function sanitizeBlockForCreate(block: any): any {
  if (!block || !block.type) return block;
  const { type } = block;

  // child_database, child_page, or unsupported block types cannot be appended directly.
  if (["unsupported", "child_database", "child_page"].includes(type)) {
    return null;
  }

  const original = block[type] ?? {};
  const allowed = CONTENT_ALLOWLIST[type];

  let cleanContent: Record<string, any> = {};

  if (allowed) {
    for (const key of allowed) {
      const val = original[key];
      if (val !== null && val !== undefined) {
        cleanContent[key] = val;
      }
    }
  } else {
    // Unknown/unhandled block type — best-effort: strip nulls
    console.warn(`No allowlist entry for block type "${type}" — falling back to null-stripping`);
    cleanContent = { ...original };
    for (const key of Object.keys(cleanContent)) {
      if (cleanContent[key] === null) {
        delete cleanContent[key];
      }
    }
  }

  // --- SPECIAL TYPE TRANSLATIONS ---

  // 1. Media blocks (image, video, file, pdf, audio)
  if (["image", "video", "file", "pdf", "audio"].includes(type)) {
    // If original block was type "file" (temporary hosted url), convert it to "external"
    if (original.type === "file" && original.file?.url) {
      cleanContent.type = "external";
      cleanContent.external = { url: original.file.url };
      delete cleanContent.file;
    }
  }

  const newBlock: any = { type, [type]: cleanContent };

  // Recurse into children if they exist on the tree
  if (cleanContent.children) {
    cleanContent.children = cleanContent.children
      .map(sanitizeBlockForCreate)
      .filter((b: any) => b !== null);
  }
  if (block.children) {
    newBlock.children = block.children
      .map(sanitizeBlockForCreate)
      .filter((b: any) => b !== null);
  }

  return newBlock;
}

/**
 * Recursively fetches all children blocks of a given container block.
 */
async function fetchBlockChildrenRecursive(
  notion: Client,
  blockId: string,
): Promise<any[]> {
  const children: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const res: any = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const child of res.results) {
      if (child.type === "child_page") {
        continue;
      }

      const appendableChild = sanitizeBlockForCreate(child);
      if (!appendableChild) {
        continue;
      }

      if (child.has_children) {
        const nested = await fetchBlockChildrenRecursive(notion, child.id);
        if (appendableChild[child.type]) {
          appendableChild[child.type].children = nested;
        }
      }
      children.push(appendableChild);
    }

    hasMore = res.has_more;
    startCursor = res.next_cursor || undefined;
  }

  return children;
}

/**
 * Cleans database properties schema for databases.create.
 */
function cleanDatabasePropertiesForCreate(properties: any): any {
  const cleanProps: any = {};
  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    const { id, ...cleanProp } = prop;

    if (cleanProp.type === "select" && cleanProp.select?.options) {
      cleanProp.select.options = cleanProp.select.options.map((opt: any) => {
        const { id: _, ...cleanOpt } = opt;
        return cleanOpt;
      });
    }
    if (cleanProp.type === "multi_select" && cleanProp.multi_select?.options) {
      cleanProp.multi_select.options = cleanProp.multi_select.options.map((opt: any) => {
        const { id: _, ...cleanOpt } = opt;
        return cleanOpt;
      });
    }
    if (cleanProp.type === "status") {
      // Notion does not allow customizing status options on creation via API
      cleanProp.status = {};
    }
    if (
      [
        "formula",
        "rollup",
        "unique_id",
        "created_time",
        "created_by",
        "last_edited_time",
        "last_edited_by",
      ].includes(cleanProp.type)
    ) {
      continue;
    }

    cleanProps[key] = cleanProp;
  }
  return cleanProps;
}

/**
 * Copies all rows from one database to another recursively copying block content.
 */
async function duplicateDatabaseRows(
  notion: Client,
  sourceDbId: string,
  targetDbId: string,
  dataSourceId?: string,
) {
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    let res: any;
    if (dataSourceId) {
      res = await notion.request({
        path: `data_sources/${dataSourceId}/query`,
        method: "post",
        body: {
          start_cursor: startCursor,
          page_size: 100,
        },
      });
    } else {
      res = await notion.request({
        path: `databases/${sourceDbId}/query`,
        method: "post",
        body: {
          start_cursor: startCursor,
          page_size: 100,
        },
      });
    }

    for (const page of res.results) {
      const cleanProperties: any = {};
      for (const key of Object.keys(page.properties)) {
        const propValue = page.properties[key];
        const { id, ...cleanVal } = propValue;

        if (
          [
            "formula",
            "rollup",
            "unique_id",
            "created_time",
            "created_by",
            "last_edited_time",
            "last_edited_by",
          ].includes(cleanVal.type)
        ) {
          continue;
        }

        cleanProperties[key] = cleanVal;
      }

      const newPage = await notion.pages.create({
        parent: { database_id: targetDbId },
        properties: cleanProperties,
      });

      // Copy body content inside the database row page
      await duplicateNotionPageBlocks(notion, page.id, newPage.id, true);
    }

    hasMore = res.has_more;
    startCursor = res.next_cursor || undefined;
  }
}

/**
 * Duplicates a Notion database schema and copies all its rows.
 */
async function duplicateNotionDatabase(
  notion: Client,
  sourceDbId: string,
  targetPageId: string,
) {
  console.log(`Notion Service: Duplicating database ${sourceDbId} under page ${targetPageId}...`);
  const sourceDb: any = await notion.databases.retrieve({ database_id: sourceDbId });
  console.log("Notion Service: sourceDb retrieved:", JSON.stringify(sourceDb));

  let properties = sourceDb.properties;
  const dataSourceId = sourceDb.data_sources?.[0]?.id;

  if (dataSourceId) {
    console.log(`Notion Service: Database uses data source ${dataSourceId}. Fetching schema...`);
    const dataSource: any = await notion.request({
      path: `data_sources/${dataSourceId}`,
      method: "get",
    });
    properties = dataSource.properties;
  }

  if (!properties) {
    throw new Error(`Database ${sourceDbId} has no properties schema`);
  }

  const cleanProperties = cleanDatabasePropertiesForCreate(properties);

  const createParams: any = {
    parent: { type: "page_id", page_id: targetPageId },
    title: sourceDb.title,
    icon: sourceDb.icon || undefined,
    description: sourceDb.description || undefined,
    is_inline: sourceDb.is_inline,
  };

  if (dataSourceId) {
    createParams.initial_data_source = {
      properties: cleanProperties,
    };
  } else {
    createParams.properties = cleanProperties;
  }

  const newDb = await notion.databases.create(createParams);

  console.log(`Notion Service: Database duplicated. New DB ID: ${newDb.id}. Copying rows...`);
  await duplicateDatabaseRows(notion, sourceDbId, newDb.id, dataSourceId);
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
      } else if (block.type === "child_database") {
        if (recursive) {
          try {
            await duplicateNotionDatabase(notion, block.id, targetPageId);
          } catch (err: any) {
            console.warn(
              `Failed to duplicate database ${block.id}:`,
              err,
            );
          }
        } else {
          console.log(
            `Notion Service: Skipping child database block '${block.child_database?.title || "untitled"}' because recursive copy is disabled.`,
          );
        }
      } else {
        const appendableBlock = sanitizeBlockForCreate(block);
        if (!appendableBlock) {
          continue;
        }
        if (block.has_children) {
          try {
            const nested = await fetchBlockChildrenRecursive(notion, block.id);
            if (appendableBlock[block.type]) {
              appendableBlock[block.type].children = nested;
            }
          } catch (err: any) {
            console.warn(
              `Failed to fetch children for block ${block.id}:`,
              err.message,
            );
          }
        }
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

/**
 * Recursively scans a page/block tree to find all nested child pages.
 */
async function findAllChildPagesRecursive(
  notion: Client,
  blockId: string,
): Promise<{ id: string; title: string }[]> {
  const subpages: { id: string; title: string }[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const res: any = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of res.results) {
      if (block.type === "child_page") {
        subpages.push({ id: block.id, title: block.child_page.title });
      } else if (block.has_children) {
        try {
          const nested = await findAllChildPagesRecursive(notion, block.id);
          subpages.push(...nested);
        } catch (err: any) {
          console.warn(`Failed to scan children of block ${block.id}:`, err.message);
        }
      }
    }

    hasMore = res.has_more;
    startCursor = res.next_cursor || undefined;
  }

  return subpages;
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
      // First copy page layout & blocks (this will skip databases/child pages since they are handled separately)
      await duplicateNotionPageBlocks(
        notion,
        templatePageId,
        newPage.id,
        recursive,
      );

      // Recursively find and copy subpages
      if (recursive) {
        console.log("Notion Service: Finding all nested subpages to duplicate...");
        const subpages = await findAllChildPagesRecursive(notion, templatePageId);
        console.log(`Notion Service: Found ${subpages.length} nested subpages to copy.`);
        for (const subpage of subpages) {
          console.log(`Notion Service: Duplicating subpage '${subpage.title}'...`);
          const newSubpage = await notion.pages.create({
            parent: { page_id: newPage.id },
            properties: {
              title: {
                title: [{ text: { content: subpage.title } }],
              },
            },
            icon: { type: "emoji", emoji: "📄" },
          });
          // Duplicate blocks of the subpage recursively
          await duplicateNotionPageBlocks(notion, subpage.id, newSubpage.id, true);
        }
      }
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
