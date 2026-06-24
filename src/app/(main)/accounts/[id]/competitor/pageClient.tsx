"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    CrosshairIcon as Crosshairs,
    Loader2,
    ShieldAlert,
    Swords,
    TrendingDown,
    Copy,
    CheckCircle2,
    Globe,
    Sparkles
} from "lucide-react";
import { generateThreatMatrixAction, getAutoTargetAction } from "@/actions/threat-matrix.actions";

export default function CompetitorClient({ account }: { account: any }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDetectingTarget, setIsDetectingTarget] = useState(true);
    const [report, setReport] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Auto-detect the highest-spending search term on load
    useEffect(() => {
        let isMounted = true;

        async function autoDetectTarget() {
            setIsDetectingTarget(true);
            try {
                const res = await getAutoTargetAction(account.googleAccountId, account.name);
                if (isMounted && res.success && res.data) {
                    setSearchTerm(res.data);
                }
            } catch (e) {
                console.error("Auto-detect failed", e);
            } finally {
                if (isMounted) setIsDetectingTarget(false);
            }
        }

        autoDetectTarget();

        return () => { isMounted = false; };
    }, [account]);

    const handleRunAudit = async () => {
        if (!searchTerm) return;

        setIsLoading(true);
        setError(null);
        setReport(null);

        try {
            const res = await generateThreatMatrixAction(account.id, searchTerm);

            if (res.success) {
                setReport(res.data);
            } else {
                setError(res.error || "Failed to generate Threat Matrix.");
            }
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyScript = () => {
        if (report?.analysis?.client_action_plan) {
            navigator.clipboard.writeText(report.analysis.client_action_plan);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-8 p-4 md:p-8 max-w-[1200px] mx-auto">
            {/* ── HEADER & CONTROLS ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-sm text-slate-500 font-medium">
                        <Globe className="h-4 w-4" /> {account.name}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Crosshairs className="h-7 w-7 text-red-600"/> Uprise Threat Matrix
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Automated SERP scraping and direct response competitor analysis.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-1 w-full md:w-auto">
                    {isDetectingTarget && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-500 flex items-center gap-1 ml-2">
                            <Loader2 className="h-3 w-3 animate-spin" /> AI locating target keyword...
                        </span>
                    )}
                    {!isDetectingTarget && searchTerm && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 flex items-center gap-1 ml-2">
                            <Sparkles className="h-3 w-3" /> Highest spend keyword detected
                        </span>
                    )}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
                        <Input
                            placeholder="e.g. emergency plumber melbourne"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isDetectingTarget || isLoading}
                            className="border-none shadow-none focus-visible:ring-0 min-w-[250px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onKeyDown={(e) => e.key === 'Enter' && handleRunAudit()}
                        />
                        <Button
                            onClick={handleRunAudit}
                            disabled={isLoading || isDetectingTarget || !searchTerm}
                            className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                        >
                            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Auditing...</> : "Run Audit"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── ERROR STATE ── */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* ── LOADING STATE ── */}
            {isLoading && (
                <Card className="border-slate-200 shadow-sm overflow-hidden relative min-h-[400px] flex flex-col items-center justify-center text-slate-500">
                    <Crosshairs className="h-12 w-12 text-red-500 animate-pulse mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Executing Threat Matrix</h3>
                    <div className="space-y-1 text-sm text-center">
                        <p className="animate-fade-in-up delay-100">1. Locating client URL in database...</p>
                        <p className="animate-fade-in-up delay-300">2. Querying live Google SERP for top competitors...</p>
                        <p className="animate-fade-in-up delay-500">3. Bypassing bot protection and scraping landing pages...</p>
                        <p className="animate-fade-in-up delay-700">4. Processing Markdown with Gemini 1.5 Flash...</p>
                    </div>
                </Card>
            )}

            {/* ── REPORT VIEW ── */}
            {report && !isLoading && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* SCORING & ACTION PLAN ROW */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Scoring Card */}
                        <Card className="lg:col-span-1 bg-slate-900 text-white border-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                    <Swords className="h-4 w-4" /> Power Ranking
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Our Client Score</p>
                                    <div className="flex items-end gap-2">
                                        <span className={`text-4xl font-black ${report.analysis.competitor_scoring.client_score_out_of_10 < 6 ? 'text-red-500' : 'text-amber-500'}`}>
                                            {report.analysis.competitor_scoring.client_score_out_of_10}
                                        </span>
                                        <span className="text-lg text-slate-500 font-bold pb-1">/ 10</span>
                                    </div>
                                </div>
                                <div className="border-t border-slate-800 pt-4">
                                    <p className="text-xs text-slate-400 mb-1">Market Leader: <span className="text-emerald-400 font-medium">{report.analysis.competitor_scoring.market_leader_name}</span></p>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-emerald-500">
                                            {report.analysis.competitor_scoring.market_leader_score}
                                        </span>
                                        <span className="text-sm text-slate-500 font-bold pb-1">/ 10</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Action Plan Card */}
                        <Card className="lg:col-span-2 border-emerald-200 bg-emerald-50/50">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm text-emerald-700 uppercase tracking-wider font-bold">
                                    Client Action Script
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyScript}
                                    className="h-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
                                >
                                    {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                    {copied ? "Copied" : "Copy for Email"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-white p-4 rounded-md border border-emerald-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap shadow-sm">
                                    {report.analysis.client_action_plan}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* MARKET GAPS LIST */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <TrendingDown className="h-5 w-5 text-red-500" /> Identified Conversion Gaps
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {report.analysis.market_gaps.map((gap: any, i: number) => (
                                    <div key={i} className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="md:col-span-3">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">{gap.category}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                gap.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                    gap.severity === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-100 text-blue-700'
                                            }`}>
                                                {gap.severity} RISK
                                            </span>
                                        </div>

                                        <div className="md:col-span-4 space-y-1">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Our Client</p>
                                            <p className="text-sm text-slate-700">{gap.client_current}</p>
                                        </div>

                                        <div className="md:col-span-5 space-y-1">
                                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Winning Competitor Strategy</p>
                                            <p className="text-sm text-slate-900 font-medium">{gap.competitor_winning_strategy}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* TARGETS SCRAPED */}
                    <div className="text-xs text-slate-400 pt-4 flex flex-col gap-1">
                        <p className="font-bold">Intelligence Sources:</p>
                        <p>Client: {report.clientUrl}</p>
                        {report.competitorUrls.map((url: string, i: number) => (
                            <p key={i}>Target {i + 1}: {url}</p>
                        ))}
                    </div>

                </div>
            )}
        </div>
    );
}