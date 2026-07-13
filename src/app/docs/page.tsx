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
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto space-y-10 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                Uprise Tools Knowledge Base
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Help guides, onboarding steps, and system documentation.
              </p>
            </div>
          </div>
          {session ? (
            <Link
              href="/overview"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              Log In
            </Link>
          )}
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {categories
            .filter((cat) => docsMap[cat] && docsMap[cat].length > 0)
            .map((cat) => (
              <div
                key={cat}
                className="bg-slate-900/30 border border-slate-900 backdrop-blur-xl p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-850 pb-3">
                  <Folder className="h-5 w-5" />
                  <h2 className="text-lg font-bold text-slate-200">
                    {categoryTitles[cat] || cat}
                  </h2>
                </div>

                <ul className="space-y-3">
                  {docsMap[cat].map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        href={`/docs/${doc.category}/${doc.slug}`}
                        className="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-900/50 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-slate-500 mt-0.5 group-hover:text-indigo-400 transition-colors shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-300 group-hover:text-indigo-300 transition-colors">
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
          <div className="flex items-center gap-3 p-4 bg-slate-900/30 border border-slate-850/60 rounded-xl text-xs text-slate-400">
            <ShieldAlert className="h-5 w-5 text-indigo-400 shrink-0" />
            <p>
              Are you a member of Uprise Digital?{" "}
              <Link
                href="/login"
                className="text-indigo-400 hover:underline font-semibold"
              >
                Log in
              </Link>{" "}
              to view internal user manuals, developer blueprints, and system
              operation logs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
