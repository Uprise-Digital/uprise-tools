"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, Zap, BarChart2, Target, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { generateAiInsightsAction } from "@/actions/ai.actions";

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await generateAiInsightsAction(
                adAccountId,
                googleAccountId,
                startDate,
                endDate
            );
            setInsights(res);
        } catch (e: any) {
            setError(e.message ?? "Analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Empty state ──
    if (!insights && !loading) {
        return (
            <div className="my-6">
                {error && (
                    <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}
                <button
                    onClick={runAnalysis}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Analyze with AI
                </button>
            </div>
        );
    }

    // ── Loading state ──
    if (loading) {
        return (
            <div className="my-6 flex items-center gap-3 text-sm text-slate-500 py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running strategic analysis…
            </div>
        );
    }

    if (!insights) return null;

    const { diagnostic_intelligence, predictive_forecasting, prescriptive_optimization, executive_summary } = insights;
    const { cpa_dynamics, campaign_performance_vectors } = diagnostic_intelligence;
    const { pacing_metrics, budget_health } = predictive_forecasting;
    const { strategic_moves, top_action_item, technical_reasoning } = prescriptive_optimization;

    return (
        <div className="my-6 space-y-3 font-sans">

            {/* ── Executive Summary ── */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">
                            AI Strategy Brief
                        </p>
                        <p className="text-sm leading-relaxed text-slate-700">{executive_summary}</p>
                    </div>
                </div>
            </div>

            {/* ── Row: Diagnostics + Campaigns ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* CPA Diagnostics */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart2 className="h-4 w-4 text-slate-400" />
                        <SectionLabel>Diagnostics</SectionLabel>
                    </div>

                    {/* Variance pill */}
                    <div className="mb-4 inline-flex items-baseline gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <span className="text-xl font-bold text-slate-900">{cpa_dynamics.variance_pct}</span>
                        <span className="text-xs text-slate-500">CPA variance</span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 mb-1">{cpa_dynamics.primary_driver}</p>
                    <p className="text-xs leading-relaxed text-slate-500">{cpa_dynamics.causal_analysis}</p>
                </div>

                {/* Campaign Vectors */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="h-4 w-4 text-slate-400" />
                        <SectionLabel>Campaign Efficiency</SectionLabel>
                    </div>

                    <div className="space-y-2.5">
                        {campaign_performance_vectors.map((c, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate">{c.campaign_name}</p>
                                    <p className="text-[10px] text-slate-400">{c.contribution_weight} of spend</p>
                                </div>
                                <EfficiencyBadge score={c.efficiency_score} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Row: Forecasting + Action Plan ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* Forecasting */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                        <SectionLabel>Predictive Forecast</SectionLabel>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: "Proj. Spend", value: pacing_metrics.projected_spend },
                            { label: "Proj. Conv.", value: pacing_metrics.projected_conversions },
                            { label: "Pacing Δ", value: pacing_metrics.pacing_delta },
                        ].map((m, i) => (
                            <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                                <p className="text-[10px] text-slate-400 mb-0.5">{m.label}</p>
                                <p className="text-sm font-bold text-slate-900 leading-tight">{m.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-0.5">Budget Health</p>
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
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Top Action Item</p>
                        <p className="text-xs leading-relaxed font-medium">{top_action_item}</p>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed">{technical_reasoning}</p>
                </div>
            </div>

            {/* ── Strategic Moves ── */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <SectionLabel>Strategic Moves</SectionLabel>
                </div>

                <div className="space-y-2">
                    {strategic_moves.map((move, i) => (
                        <div key={i} className="flex gap-3 items-start rounded-lg hover:bg-slate-50 px-3 py-2.5 transition-colors -mx-3">
                            <div className="mt-0.5 w-8 shrink-0 text-right">
                                <PriorityBadge priority={move.priority} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-800 leading-snug">{move.action}</p>
                                {move.expected_impact && (
                                    <p className="text-[10px] text-emerald-600 mt-0.5">↗ {move.expected_impact}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
