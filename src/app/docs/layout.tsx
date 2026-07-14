import fs from "node:fs";
import path from "node:path";
import { BookOpen, Folder, FileText, ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { parseMarkdown } from "@/lib/docs-parser";
import { DocsSearch, type SearchableDoc } from "@/components/docs-search";

interface DocsLayoutProps {
  children: React.ReactNode;
}

export default async function DocsLayout({ children }: DocsLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const docsDir = path.join(process.cwd(), "src/content/docs");
  const categories = ["client-guides", "user-manual", "developer-docs"];
  
  const searchDocs: SearchableDoc[] = [];
  const sidebarTree: Record<string, { title: string; category: string; slug: string }[]> = {};

  for (const cat of categories) {
    sidebarTree[cat] = [];
    const catDir = path.join(docsDir, cat);
    
    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        try {
          const filePath = path.join(catDir, file);
          const { metadata, contentHtml } = parseMarkdown(filePath);

          // Access Control: Non-public guides require an authenticated session
          if (metadata.audience !== "public" && !session) {
            continue; // Skip internal docs for unauthenticated visitors
          }

          const slug = file.replace(".md", "");

          // Populate Sidebar tree
          sidebarTree[cat].push({
            title: metadata.title,
            category: cat,
            slug,
          });

          // Populate Search list (strip HTML for plain text searching)
          const plainText = contentHtml.replace(/<[^>]*>/g, " ");
          searchDocs.push({
            title: metadata.title,
            description: metadata.description || "",
            category: cat,
            slug,
            plainText,
          });
        } catch (err) {
          console.error(`Failed to parse doc in layout:`, err);
        }
      }
    }
  }

  const categoryTitles: Record<string, string> = {
    "client-guides": "Client Guides",
    "user-manual": "User Manuals",
    "developer-docs": "Developer Manuals",
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col font-sans">
      {/* 1. Top Navbar */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-40 h-14 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="flex items-center gap-2 text-slate-900 font-bold hover:opacity-80 transition-opacity"
          >
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-sm tracking-tight">Uprise Docs</span>
          </Link>
        </div>

        {/* Search input placeholder */}
        <div className="flex-1 max-w-sm mx-4">
          <DocsSearch docs={searchDocs} />
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href="/overview"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Log In
            </Link>
          )}
        </div>
      </header>

      {/* 2. Main flex body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white p-6 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto hidden md:block shrink-0">
          <nav className="space-y-6">
            {categories
              .filter((cat) => sidebarTree[cat] && sidebarTree[cat].length > 0)
              .map((cat) => (
                <div key={cat} className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                    <Folder className="h-3.5 w-3.5" />
                    <span>{categoryTitles[cat] || cat}</span>
                  </div>
                  <ul className="space-y-1">
                    {sidebarTree[cat].map((doc) => (
                      <li key={`${doc.category}-${doc.slug}`}>
                        <Link
                          href={`/docs/${doc.category}/${doc.slug}`}
                          className="group flex items-start gap-2 p-2 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-300 mt-0.5 group-hover:text-indigo-500 transition-colors shrink-0" />
                          <span className="line-clamp-2">{doc.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </nav>
        </aside>

        {/* Children details (centered panel) */}
        <main className="flex-1 py-8 px-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
