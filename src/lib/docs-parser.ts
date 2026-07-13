import fs from "node:fs";

export interface DocMetadata {
  title: string;
  description: string;
  audience: "public" | "internal";
  category: string;
  [key: string]: any;
}

export interface ParsedDoc {
  metadata: DocMetadata;
  contentHtml: string;
}

/**
 * Parses a markdown document, extracting metadata frontmatter and converting body to HTML.
 */
export function parseMarkdown(filePath: string): ParsedDoc {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, "utf-8");

  // Parse Frontmatter
  const frontmatterRegex = /^---([\s\S]*?)---/;
  const match = rawContent.match(frontmatterRegex);

  const metadata: Partial<DocMetadata> = {};
  let markdownContent = rawContent;

  if (match) {
    const yamlBlock = match[1];
    markdownContent = rawContent.replace(frontmatterRegex, "").trim();

    // Parse simple key-value YAML pairs
    const lines = yamlBlock.split("\n");
    for (const line of lines) {
      const parts = line.split(":");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts
          .slice(1)
          .join(":")
          .trim()
          .replace(/^['"]|['"]$/g, "");
        if (key) {
          if (value === "true") metadata[key] = true;
          else if (value === "false") metadata[key] = false;
          else metadata[key] = value;
        }
      }
    }
  }

  // Simple Markdown to HTML Parser
  let html = markdownContent;

  // Convert headers (h1, h2, h3)
  html = html.replace(
    /^### (.*$)/gim,
    '<h3 class="text-base font-bold text-slate-100 mt-6 mb-3">$1</h3>',
  );
  html = html.replace(
    /^## (.*$)/gim,
    '<h2 class="text-lg font-extrabold text-slate-100 mt-8 mb-4 border-b border-slate-800 pb-2">$1</h2>',
  );
  html = html.replace(
    /^# (.*$)/gim,
    '<h1 class="text-2xl font-black text-white mb-6">$1</h1>',
  );

  // Convert bold / italic
  html = html.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="font-semibold text-slate-100">$1</strong>',
  );
  html = html.replace(
    /\*(.*?)\*/g,
    '<em class="italic text-slate-300">$1</em>',
  );

  // Convert code tags
  html = html.replace(
    /`(.*?)`/g,
    '<code class="px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-indigo-400 font-mono text-xs font-medium">$1</code>',
  );

  // Convert links
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 underline font-semibold transition-colors">$1</a>',
  );

  // Convert list items
  html = html.replace(
    /^\s*-\s+(.*$)/gim,
    '<li class="ml-4 list-disc text-slate-300 mb-1.5">$1</li>',
  );
  html = html.replace(
    /^\s*\d+\.\s+(.*$)/gim,
    '<li class="ml-4 list-decimal text-slate-300 mb-1.5">$1</li>',
  );

  // Split into block paragraphs and wrap non-element blocks in <p>
  const blocks = html.split(/\n\s*\n/);
  const parsedBlocks = blocks.map((b) => {
    const trimmed = b.trim();
    if (!trimmed) return "";

    if (
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("<GoogleAdsIdForm") ||
      trimmed.startsWith("<CopyMetaIdButton") ||
      trimmed.startsWith("<div")
    ) {
      return trimmed;
    }

    return `<p class="text-sm text-slate-300 mb-4 leading-relaxed">${trimmed}</p>`;
  });

  html = parsedBlocks.join("\n");

  // Wrap list items in <ul> or <ol> tags
  html = html.replace(
    /(<li class="[^"]*list-disc[^"]*">.*?<\/li>\n?)+/g,
    '<ul class="mb-4 space-y-1">$1</ul>',
  );
  html = html.replace(
    /(<li class="[^"]*list-decimal[^"]*">.*?<\/li>\n?)+/g,
    '<ol class="mb-4 space-y-1">$1</ol>',
  );

  return {
    metadata: {
      title: metadata.title || "Documentation",
      description: metadata.description || "",
      audience: (metadata.audience as "public" | "internal") || "internal",
      category: metadata.category || "general",
      ...metadata,
    },
    contentHtml: html,
  };
}
