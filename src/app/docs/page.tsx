import fs from "node:fs";
import path from "node:path";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Folder,
  ShieldAlert,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { type DocMetadata, parseMarkdown } from "@/lib/docs-parser";

interface DocItem {
  slug: string;
  category: string;
  metadata: DocMetadata;
}

export default async function DocsIndexPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const docsDir = path.join(process.cwd(), "src/content/docs");
  const categories = ["client-guides", "user-manual", "developer-docs"];
  const docsMap: Record<string, DocItem[]> = {};

  for (const cat of categories) {
    docsMap[cat] = [];
    const catDir = path.join(docsDir, cat);

    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        try {
          const filePath = path.join(catDir, file);
          const { metadata } = parseMarkdown(filePath);

          // Access Control: Non-public guides require an authenticated session
          if (metadata.audience !== "public" && !session) {
            continue; // Skip internal docs for unauthenticated visitors
          }

          docsMap[cat].push({
            slug: file.replace(".md", ""),
            category: cat,
            metadata,
          });
        } catch (err) {
          console.error(`Failed to parse doc file ${file} in ${cat}:`, err);
        }
      }
    }
  }

  const categoryTitles: Record<string, string> = {
    "client-guides": "Client Onboarding Guides",
    "user-manual": "Internal User Manuals",
    "developer-docs": "Developer Documentation",
  };

  return (
    <div className="space-y-10 w-full max-w-4xl">
      {/* Hero Welcome */}
      <div className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Uprise Tools Knowledge Base
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
          Everything you need to onboard clients, configure Google and Meta Ads integrations, and manage internal system tools. Select a category below or use the search bar above to get started.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {categories
          .filter((cat) => docsMap[cat] && docsMap[cat].length > 0)
          .map((cat) => (
            <div
              key={cat}
              className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 text-indigo-600 border-b border-slate-100 pb-3">
                <Folder className="h-5 w-5" />
                <h2 className="text-sm font-bold text-slate-900">
                  {categoryTitles[cat] || cat}
                </h2>
              </div>

              <ul className="space-y-3">
                {docsMap[cat].map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={`/docs/${doc.category}/${doc.slug}`}
                      className="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-slate-400 mt-0.5 group-hover:text-indigo-600 transition-colors shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                          {doc.metadata.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {doc.metadata.description}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      {!session && (
        <div className="flex items-center gap-3 p-5 bg-white border border-slate-200 rounded-3xl text-xs text-slate-500 shadow-sm max-w-2xl">
          <ShieldAlert className="h-5 w-5 text-indigo-600 shrink-0" />
          <p>
            Are you a member of Uprise Digital?{" "}
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
            >
              Log in
            </Link>{" "}
            to view internal user manuals, developer blueprints, and system
            operation logs.
          </p>
        </div>
      )}
    </div>
  );
}
