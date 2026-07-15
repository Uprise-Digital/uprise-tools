"use client";

interface EmailPreviewProps {
  subject: string;
  body: string;
}

export function EmailPreview({ subject, body }: EmailPreviewProps) {
  const variables: Record<string, string> = {
    primary_contact_name: "Seyone",
    client_name: "Uprise Digital Agency",
    drive_link:
      '<a href="#" class="text-indigo-600 hover:text-indigo-800 underline font-semibold transition-colors">Media Assets (Images and Videos)</a>',
    notion_link:
      '<a href="#" class="text-indigo-600 hover:text-indigo-800 underline font-semibold transition-colors">Uprise Client Dashboard</a>',
    signal_link:
      '<a href="#" class="text-indigo-600 hover:text-indigo-800 underline font-semibold transition-colors">Uprise Onboarding Chat</a>',
  };

  let parsed = body;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    parsed = parsed.replace(regex, val);
  }

  // Parse lines starting with "1. ", "2. " etc. as left-bordered steps
  const lines = parsed.split("\n");
  let insideStep = false;
  const renderedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Support horizontal rules to explicitly break out of step styling
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      if (insideStep) {
        renderedLines.push("</div>");
        insideStep = false;
      }
      renderedLines.push('<hr class="border-t border-slate-200 my-4" />');
      continue;
    }

    // Detect typical email sign-off and footer transition phrases to break out of lists
    const isSignOff = trimmed.match(
      /^(best|thanks|thank you|sincerely|regards|kind regards|warmly|yours|feel free|don't hesitate|if you have|contact us)/i,
    );
    if (isSignOff && insideStep) {
      renderedLines.push("</div>");
      insideStep = false;
    }

    const stepMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (stepMatch) {
      if (insideStep) {
        renderedLines.push("</div>");
      }
      insideStep = true;
      renderedLines.push(
        `<div class="border-l-4 border-indigo-600 bg-slate-50/50 p-4 rounded-r-xl my-4 space-y-1.5"><p class="text-xs font-bold text-slate-800">${stepMatch[1]}. ${stepMatch[2]}</p>`,
      );
    } else if (line.trim() === "" && insideStep) {
      // blank line
    } else {
      if (insideStep) {
        // Parse simple markdown links in step details
        const processedLine = line.replace(
          /\[(.*?)\]\((.*?)\)/g,
          '<a href="$2" class="text-indigo-600 hover:text-indigo-800 underline font-semibold">$1</a>',
        );
        renderedLines.push(
          `<p class="text-[11px] text-slate-500 leading-normal">${processedLine}</p>`,
        );
      } else {
        // Standard markdown headers/paragraphs
        if (line.startsWith("# ")) {
          renderedLines.push(
            `<h1 class="text-sm font-black text-slate-900 mb-2 uppercase tracking-wide">${line.substring(2)}</h1>`,
          );
        } else if (line.trim() !== "") {
          const processedLine = line.replace(
            /\[(.*?)\]\((.*?)\)/g,
            '<a href="$2" class="text-indigo-600 hover:text-indigo-800 underline font-semibold">$1</a>',
          );
          renderedLines.push(
            `<p class="text-xs text-slate-650 leading-relaxed mb-3">${processedLine}</p>`,
          );
        }
      }
    }
  }
  if (insideStep) {
    renderedLines.push("</div>");
  }

  const finalHtml = renderedLines.join("\n");

  return (
    <div className="border border-slate-200 rounded-2xl shadow-sm bg-white overflow-hidden flex flex-col h-full min-h-[380px]">
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 select-none ml-2">
            Dynamic Template Preview
          </span>
        </div>
        <div className="flex items-center gap-1 bg-slate-200/50 px-2 py-0.5 rounded text-[9px] font-bold text-slate-500 select-none">
          Live
        </div>
      </div>
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/20">
        <div className="flex items-start gap-1.5 text-xs">
          <span className="font-bold text-slate-400 shrink-0 select-none">
            Subject:
          </span>
          <span className="text-slate-700 font-semibold">
            {subject || "Welcome to Uprise Digital - Let's get started!"}
          </span>
        </div>
      </div>
      <div className="p-6 overflow-y-auto flex-1 font-sans max-h-[380px] scrollbar-thin">
        <div
          className="prose-sm leading-relaxed text-slate-600"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering parsed markdown blocks
          dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
      </div>
    </div>
  );
}
