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

  const categoryTitles: Record<string, string> = {
    "client-guides": "Client Guides",
    "user-manual": "User Manuals",
    "developer-docs": "Developer Blueprints",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-3xl mx-auto space-y-8 relative">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 border-b border-slate-900 pb-4 mb-4">
          <Link
            href="/docs"
            className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" /> Docs
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-400">
            {categoryTitles[category] || category}
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-200 truncate max-w-[200px]">
            {metadata.title}
          </span>
        </div>

        {/* Dynamic Document Content */}
        <article className="prose prose-invert prose-indigo max-w-none">
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
        <div className="border-t border-slate-900 pt-6 mt-12 flex justify-between items-center">
          <Link
            href="/docs"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Knowledge Base
          </Link>
          <p className="text-[10px] text-slate-600 font-medium">
            © {new Date().getFullYear()} Uprise Digital. Internal Systems.
          </p>
        </div>
      </div>
    </div>
  );
}
