"use client";

import {
  ArrowRight,
  BarChart3,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { marked, type Tokens } from "marked";
import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

interface AnalystMessageContentProps {
  content: string;
  isUser?: boolean;
  onQuickAction?: (actionText: string) => void;
}

interface KpiItem {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  caption?: string;
}

interface ChartItem {
  title?: string;
  data: { name: string; value: number; [key: string]: any }[];
  dataKey?: string;
  color?: string;
}

/**
 * Extracts custom visual blocks from markdown:
 * - ```kpis ... ```
 * - ```quick-actions ... ```
 * - ```chart ... ```
 */
function parseMessageBlocks(rawContent: string) {
  let text = rawContent;
  let kpis: KpiItem[] | null = null;
  let quickActions: string[] | null = null;
  let chartData: ChartItem | null = null;

  // Extract KPI block
  const kpiMatch = text.match(/```(?:json:)?kpis\s*([\s\S]*?)```/i);
  if (kpiMatch) {
    try {
      const parsed = JSON.parse(kpiMatch[1].trim());
      if (Array.isArray(parsed)) {
        kpis = parsed;
      }
    } catch {
      // Ignore parse failure
    }
    text = text.replace(kpiMatch[0], "").trim();
  }

  // Extract Quick Actions block
  const actionsMatch = text.match(
    /```(?:json:)?quick-actions\s*([\s\S]*?)```/i,
  );
  if (actionsMatch) {
    try {
      const parsed = JSON.parse(actionsMatch[1].trim());
      if (Array.isArray(parsed)) {
        quickActions = parsed
          .map((item) =>
            typeof item === "string" ? item : item.title || item.prompt || "",
          )
          .filter(Boolean);
      }
    } catch {
      // Ignore parse failure
    }
    text = text.replace(actionsMatch[0], "").trim();
  }

  // Extract Chart block
  const chartMatch = text.match(/```(?:json:)?chart\s*([\s\S]*?)```/i);
  if (chartMatch) {
    try {
      const parsed = JSON.parse(chartMatch[1].trim());
      if (parsed && Array.isArray(parsed.data)) {
        chartData = parsed;
      }
    } catch {
      // Ignore parse failure
    }
    text = text.replace(chartMatch[0], "").trim();
  }

  return { text, kpis, quickActions, chartData };
}

/**
 * Custom Marked Renderer configured for Gemini-inspired elegance:
 * - Beautiful card data tables with tabular figures and delta chips
 * - Elevated Key Insight callout cards
 * - Timeline steppers with connected vertical dotted lines
 */
function renderCustomMarkdown(src: string): string {
  // Use custom renderer rules
  marked.use({
    renderer: {
      table(this: any, token: Tokens.Table) {
        let headerHtml = "";
        for (const cell of token.header) {
          headerHtml += this.tablecell(cell);
        }
        const headerRow = this.tablerow({ text: headerHtml });

        let bodyHtml = "";
        for (const row of token.rows) {
          let rowHtml = "";
          for (const cell of row) {
            rowHtml += this.tablecell(cell);
          }
          bodyHtml += this.tablerow({ text: rowHtml });
        }

        return `
          <div class="my-5 rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead class="bg-slate-50/90 border-b border-slate-200/80">
                  ${headerRow}
                </thead>
                <tbody class="divide-y divide-slate-100/90 text-slate-700">
                  ${bodyHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      },
      tablerow(_token: Tokens.TableRow<string>) {
        return `<tr class="hover:bg-slate-50/50 transition-colors">${_token.text}</tr>`;
      },
      tablecell(this: any, token: Tokens.TableCell) {
        const content = this.parser.parseInline(token.tokens);
        const alignClass =
          token.align === "right"
            ? "text-right"
            : token.align === "center"
              ? "text-center"
              : "text-left";

        if (token.header) {
          return `
            <th class="py-3 px-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${alignClass}">
              ${content}
            </th>
          `;
        }

        let styledContent = content;
        const stripped = content.replace(/<[^>]+>/g, "").trim();
        const deltaMatch = stripped.match(
          /^([+-]?\d+(?:\.\d+)?%?(?:\s*pts)?)$/,
        );
        if (deltaMatch) {
          const valStr = deltaMatch[1];
          const isPositive = valStr.startsWith("+");
          const isNegative = valStr.startsWith("-");

          if (isPositive) {
            styledContent = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">${valStr}</span>`;
          } else if (isNegative) {
            styledContent = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">${valStr}</span>`;
          }
        } else if (/^\$[\d,]+(?:\.\d+)?$/.test(stripped)) {
          styledContent = `<span class="font-mono font-medium text-slate-900">${content}</span>`;
        }

        return `
          <td class="py-3 px-4 ${alignClass} font-normal">
            ${styledContent}
          </td>
        `;
      },
      blockquote(this: any, token: Tokens.Blockquote) {
        const content = this.parser.parse(token.tokens);
        const isKeyInsight = /Key\s+(?:Strategic\s+)?Insight/i.test(token.raw);

        if (isKeyInsight) {
          return `
            <div class="my-5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-white p-4.5 shadow-2xs">
              <div class="flex items-start gap-2.5">
                <div class="h-6 w-6 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-xs">💡</span>
                </div>
                <div class="text-xs text-slate-800 leading-relaxed font-normal [&>p]:m-0 [&>p>strong]:text-indigo-950 [&>p>strong]:font-bold">
                  ${content}
                </div>
              </div>
            </div>
          `;
        }

        return `
          <blockquote class="my-4 pl-4 border-l-2 border-indigo-400/80 text-slate-600 italic text-xs leading-relaxed">
            ${content}
          </blockquote>
        `;
      },
      heading(this: any, token: Tokens.Heading) {
        const content = this.parser.parseInline(token.tokens);
        if (token.depth === 1) {
          return `
            <div class="mt-8 mb-4 border-b border-slate-200/80 pb-3">
              <h1 class="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-indigo-600"></span>
                ${content}
              </h1>
            </div>
          `;
        }
        if (token.depth === 2) {
          return `
            <div class="mt-7 mb-3">
              <h2 class="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                ${content}
              </h2>
            </div>
          `;
        }
        if (token.depth === 3) {
          return `
            <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mt-5 mb-2">
              ${content}
            </h3>
          `;
        }
        return `<h4 class="text-xs font-semibold text-slate-800 mt-4 mb-1.5">${content}</h4>`;
      },
      list(this: any, token: Tokens.List) {
        if (token.ordered) {
          let itemsHtml = "";
          token.items.forEach((item, idx) => {
            const itemBody = this.parser.parse(item.tokens);
            itemsHtml += `
              <li class="relative pl-8 pb-4 last:pb-0 group">
                <div class="absolute left-0 top-0.5 h-5 w-5 rounded-full border border-slate-300 bg-white flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-2xs">
                  ${idx + 1}
                </div>
                <div class="absolute left-2.5 top-6 bottom-0 w-px border-l border-dashed border-slate-300 group-last:hidden"></div>
                <div class="text-xs text-slate-800 leading-relaxed [&>p]:m-0">
                  ${itemBody}
                </div>
              </li>
            `;
          });
          return `
            <ol class="my-4 list-none p-0">
              ${itemsHtml}
            </ol>
          `;
        }

        let itemsHtml = "";
        for (const item of token.items) {
          const itemBody = this.parser.parse(item.tokens);
          itemsHtml += `<li class="my-1">${itemBody}</li>`;
        }
        return `<ul class="my-3 pl-4 list-disc text-slate-700 space-y-1">${itemsHtml}</ul>`;
      },
    },
  });

  return marked.parse(src) as string;
}

export function AnalystMessageContent({
  content,
  isUser,
  onQuickAction,
}: AnalystMessageContentProps) {
  if (isUser) {
    return (
      <p className="whitespace-pre-wrap font-medium text-xs leading-relaxed">
        {content}
      </p>
    );
  }

  const { text, kpis, quickActions, chartData } = useMemo(
    () => parseMessageBlocks(content),
    [content],
  );
  const htmlContent = useMemo(() => renderCustomMarkdown(text), [text]);

  return (
    <div className="space-y-4">
      {/* 1. KPI Summary Cards Grid (Gemini Style) */}
      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
          {kpis.map((kpi, idx) => {
            const isUp =
              kpi.trend === "up" || kpi.delta?.startsWith("+");
            const isDown =
              kpi.trend === "down" || kpi.delta?.startsWith("-");

            return (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                  {kpi.label}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-extrabold text-slate-900 tracking-tight font-mono">
                    {kpi.value}
                  </span>
                  {kpi.delta && (
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded font-mono",
                        isUp &&
                          "bg-emerald-50 text-emerald-700 border border-emerald-200/50",
                        isDown &&
                          "bg-blue-50 text-blue-700 border border-blue-200/50",
                        !isUp && !isDown && "bg-slate-100 text-slate-600",
                      )}
                    >
                      {isUp && <TrendingUp className="h-2.5 w-2.5 mr-0.5" />}
                      {isDown && (
                        <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {kpi.delta}
                    </span>
                  )}
                </div>
                {kpi.caption && (
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {kpi.caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Graphical Chart Block (If provided by model) */}
      {chartData && (
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs my-3">
          {chartData.title && (
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900">
                {chartData.title}
              </h4>
            </div>
          )}
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "11px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar
                  dataKey={chartData.dataKey || "value"}
                  fill={chartData.color || "#4f46e5"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. Elegantly Parsed Markdown Body */}
      <div
        className="prose prose-xs max-w-none text-slate-800 prose-p:leading-relaxed prose-p:my-2.5 prose-strong:text-slate-900 prose-strong:font-bold prose-ul:my-2.5 prose-li:my-1 prose-hr:border-slate-200/80 prose-hr:my-6"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* 4. Interactive Quick-Action Suggestion Buttons (Gemini Style) */}
      {quickActions && quickActions.length > 0 && onQuickAction && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Suggested Next Steps:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onQuickAction(action)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 bg-slate-50 hover:bg-indigo-50/80 hover:text-indigo-700 border border-slate-200/80 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs group"
              >
                <span>{action}</span>
                <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
