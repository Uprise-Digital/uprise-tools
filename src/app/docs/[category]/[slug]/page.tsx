import fs from "node:fs";
import path from "node:path";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyMetaIdButton, GoogleAdsIdForm } from "@/components/docs-widgets";
import { auth } from "@/lib/auth";
import { parseMarkdown } from "@/lib/docs-parser";

interface DocPageProps {
  params: Promise<{
    category: string;
    slug: string;
  }>;
}

export default async function DocDetailPage({ params }: DocPageProps) {
  const { category, slug } = await params;

  const docsDir = path.join(process.cwd(), "src/content/docs");
  const filePath = path.join(docsDir, category, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  // Parse Markdown File
  let parsed: ReturnType<typeof parseMarkdown>;
  try {
    parsed = parseMarkdown(filePath);
  } catch (err) {
    console.error("Failed to parse markdown:", err);
    notFound();
  }

  const { metadata, contentHtml } = parsed;

  // Access Control: Non-public documents require a logged-in session
  if (metadata.audience !== "public") {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      redirect("/login");
    }
  }

  // Split parsed HTML content to inject active React components in-line
  const parts = contentHtml.split(
    /(<GoogleAdsIdForm \/>|<CopyMetaIdButton \/>)/,
  );

  // Extract Headings for TOC
  const toc: { text: string; id: string }[] = [];
  try {
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const headingLines = rawContent.split("\n");
    for (const line of headingLines) {
      if (line.startsWith("## ")) {
        const cleanText = line.replace("## ", "").trim();
        const id = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        toc.push({ text: cleanText, id });
      }
    }
  } catch (err) {
    console.error("Failed to parse TOC:", err);
  }

  const categoryTitles: Record<string, string> = {
    "client-guides": "Client Guides",
    "user-manual": "User Manuals",
    "developer-docs": "Developer Blueprints",
  };

  return (
    <div className="flex gap-8 items-start relative w-full">
      {/* Article Content */}
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 border-b border-slate-100 pb-4 mb-6">
          <Link
            href="/docs"
            className="hover:text-indigo-600 flex items-center gap-1 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" /> Docs
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-500">
            {categoryTitles[category] || category}
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700 truncate max-w-[200px]">
            {metadata.title}
          </span>
        </div>

        {/* Dynamic Document Content */}
        <article className="prose prose-slate prose-indigo max-w-none">
          {parts.map((part, index) => {
            if (part === "<GoogleAdsIdForm />") {
              return <GoogleAdsIdForm key={index} />;
            }
            if (part === "<CopyMetaIdButton />") {
              return <CopyMetaIdButton key={index} />;
            }
            return (
              // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering parsed markdown blocks
              <div key={index} dangerouslySetInnerHTML={{ __html: part }} />
            );
          })}
        </article>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 pt-6 mt-12 flex justify-between items-center">
          <Link
            href="/docs"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Knowledge Base
          </Link>
          <p className="text-[10px] text-slate-400 font-medium">
            © {new Date().getFullYear()} Uprise Digital. Client Guide.
          </p>
        </div>
      </div>

      {/* Right Table of Contents (TOC) Sidebar */}
      {toc.length > 0 && (
        <aside className="w-52 sticky top-20 hidden lg:block shrink-0 pl-2">
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              On this page
            </h4>
            <ul className="space-y-2 border-l border-slate-200 pl-3.5">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors py-0.5 line-clamp-2"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
