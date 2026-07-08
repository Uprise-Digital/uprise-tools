"use client";

import {
  AlertTriangle,
  BarChart2,
  ChevronRight,
  Clock,
  Database,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getOrGenerateAiInsightsAction } from "@/actions/ai.actions";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CampaignVector {
  campaign_name: string;
  contribution_weight: string;
  efficiency_score: "Under" | "Over" | "Balanced" | string;
}

interface StrategicMove {
  priority: "High" | "Medium" | "Low";
  action: string;
  expected_impact: string;
}

interface Insights {
  executive_summary: string;
  diagnostic_intelligence: {
    cpa_dynamics: {
      primary_driver: string;
      variance_pct: string;
      causal_analysis: string;
    };
    campaign_performance_vectors: CampaignVector[];
  };
  predictive_forecasting: {
    pacing_metrics: {
      projected_spend: string;
      projected_conversions: string;
      pacing_delta: string;
    };
    budget_health: string;
  };
  prescriptive_optimization: {
    strategic_moves: StrategicMove[];
    top_action_item: string;
    technical_reasoning: string;
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-3">
      {children}
    </p>
  );
}

function EfficiencyBadge({ score }: { score: string }) {
  const normalized = score.toLowerCase();
  const isOver = normalized.includes("over");
  const isUnder = normalized.includes("under");

  if (isOver)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <TrendingUp className="h-2.5 w-2.5" /> Over
      </span>
    );
  if (isUnder)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
        <TrendingDown className="h-2.5 w-2.5" /> Under
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <Minus className="h-2.5 w-2.5" /> Balanced
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = priority.toLowerCase();
  if (p === "high")
    return (
      <span className="text-[10px] font-bold tracking-wide uppercase text-red-500">
        High
      </span>
    );
  if (p === "medium")
    return (
      <span className="text-[10px] font-bold tracking-wide uppercase text-amber-500">
        Med
      </span>
    );
  return (
    <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400">
      Low
    </span>
  );
}

// Formatter for relative time
const formatTimeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
};

// Formatter for short dates
const formatShortDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function AiInsights({
  adAccountId,
  googleAccountId,
  startDate,
  endDate,
}: {
  adAccountId: number;
  googleAccountId: string;
  startDate: string;
  endDate: string;
}) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // Split loading states so we don't clear the UI when just refreshing
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (
    forceRefresh: boolean,
    isMounted: boolean = true,
  ) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsInitialLoading(true);
    setError(null);

    try {
      const res = await getOrGenerateAiInsightsAction(
        adAccountId,
        googleAccountId,
        startDate,
        endDate,
        forceRefresh,
      );
      if (isMounted && res.success) {
        setInsights(res.data);
        setGeneratedAt(new Date(res.generatedAt));
      }
    } catch (e: any) {
      if (isMounted)
        setError(e.message ?? "Analysis failed. Please try again.");
    } finally {
      if (isMounted) {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // Auto-fetch cached report on mount/date change
  useEffect(() => {
    let isMounted = true;
    fetchData(false, isMounted);
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  // ── Empty / Initial Loading State ──
  if (isInitialLoading) {
    return (
      <div className="my-6 flex items-center justify-center gap-3 text-sm text-slate-500 py-12 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        Retrieving strategic analysis…
      </div>
    );
  }

  if (!insights && !isInitialLoading) {
    return (
      <div className="my-6 py-6 border-t border-slate-200">
        {error && (
          <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isRefreshing ? "Generating..." : "Generate AI Insights"}
        </button>
      </div>
    );
  }

  if (!insights) return null;

  const {
    diagnostic_intelligence,
    predictive_forecasting,
    prescriptive_optimization,
    executive_summary,
  } = insights;
  const { cpa_dynamics, campaign_performance_vectors } =
    diagnostic_intelligence || {};
  const { pacing_metrics, budget_health } = predictive_forecasting || {};
  const { strategic_moves, top_action_item, technical_reasoning } =
    prescriptive_optimization || {};

  return (
    <div className="my-8 space-y-3 font-sans">
      {/* ── Meta Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 px-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" /> Strategic
            Intelligence
          </h2>
          {/* Data Provenance */}
          <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-slate-500">
            <Database className="h-3 w-3" />
            Google Ads • {formatShortDate(startDate)} to{" "}
            {formatShortDate(endDate)}
          </div>
        </div>

        {generatedAt && (
          <div className="flex items-center gap-2">
            {/* Generation Time */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-md text-[10px] font-semibold text-slate-500">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(generatedAt)}
            </div>
            {/* Refresh IconButton */}
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="Regenerate Insights"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* ── Executive Summary ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative overflow-hidden">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10" />
        )}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
            <BarChart2 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">
              Executive Summary
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {executive_summary}
            </p>
          </div>
        </div>
      </div>

      {/* ── Row: Diagnostics + Campaigns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 rounded-xl" />
        )}

        {/* CPA Diagnostics */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 className="h-4 w-4 text-slate-400" />
            <SectionLabel>Diagnostics</SectionLabel>
          </div>

          {/* Highlight Callout Box (Fixes the massive bold text issue) */}
          <div className="mb-6 rounded-lg bg-indigo-50/50 border border-indigo-100 p-4">
            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded">
                CPA Variance Insight
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-800">
              {cpa_dynamics?.variance_pct}
            </p>
          </div>

          {/* Deep-Dive Analysis Section */}
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Primary Driver
              </h4>
              <p className="text-sm font-medium leading-relaxed text-slate-700">
                {cpa_dynamics?.primary_driver}
              </p>
            </div>

            <div className="h-px w-full bg-slate-100"></div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Causal Analysis
              </h4>
              <p className="text-sm leading-relaxed text-slate-500">
                {cpa_dynamics?.causal_analysis}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Vectors */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-slate-400" />
            <SectionLabel>Campaign Efficiency</SectionLabel>
          </div>

          <div className="space-y-2.5">
            {campaign_performance_vectors?.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {c.campaign_name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {c.contribution_weight} of spend
                  </p>
                </div>
                <EfficiencyBadge score={c.efficiency_score} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row: Forecasting + Action Plan ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 rounded-xl" />
        )}

        {/* Forecasting */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <SectionLabel>Predictive Forecast</SectionLabel>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Proj. Spend", value: pacing_metrics?.projected_spend },
              {
                label: "Proj. Conv.",
                value: pacing_metrics?.projected_conversions,
              },
              { label: "Pacing Δ", value: pacing_metrics?.pacing_delta },
            ].map((m, i) => (
              <div
                key={i}
                className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center overflow-hidden"
              >
                <p className="text-[10px] text-slate-400 mb-0.5 truncate">
                  {m.label}
                </p>
                <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-0.5">
              Budget Health
            </p>
            <p className="text-xs text-amber-800">{budget_health}</p>
          </div>
        </div>

        {/* Top Action */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-slate-400" />
            <SectionLabel>Priority Action</SectionLabel>
          </div>

          <div className="rounded-lg bg-slate-900 text-white px-4 py-3 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Top Action Item
            </p>
            <p className="text-xs leading-relaxed font-medium">
              {top_action_item}
            </p>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            {technical_reasoning}
          </p>
        </div>
      </div>

      {/* ── Strategic Moves ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm relative">
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 rounded-xl" />
        )}
        <div className="flex items-center gap-2 mb-4">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <SectionLabel>Strategic Moves</SectionLabel>
        </div>

        <div className="space-y-2">
          {strategic_moves?.map((move, i) => (
            <div
              key={i}
              className="flex gap-3 items-start rounded-lg hover:bg-slate-50 px-3 py-2.5 transition-colors -mx-3"
            >
              <div className="mt-0.5 w-8 shrink-0 text-right">
                <PriorityBadge priority={move.priority} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 leading-snug">
                  {move.action}
                </p>
                {move.expected_impact && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    ↗ {move.expected_impact}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
