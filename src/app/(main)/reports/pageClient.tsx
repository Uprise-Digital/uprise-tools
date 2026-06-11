"use client";

import { useState, useEffect } from "react";
import { getAgencyPortfolioMetricsAction, syncAgencyPortfolioAction } from "@/actions/agency.actions";
import { generateAgencyAiInsightsAction } from "@/actions/ai.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Calendar, DollarSign, Target, Activity,
    TrendingUp, ShieldAlert, Sparkles, Loader2, Users, RefreshCw, CloudDownload
} from "lucide-react";

export default function AgencyReportsClient() {
    const today = new Date();
    const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);

    const [loadingData, setLoadingData] = useState(true);
    const [loadingAi, setLoadingAi] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false); // NEW STATE

    const [portfolio, setPortfolio] = useState<any>(null);
    const [insights, setInsights] = useState<any>(null);

    // Fetch Base Data
    const fetchPortfolioData = async (isMounted = true) => {
        setLoadingData(true);
        setInsights(null); // Clear AI on date change
        try {
            const res = await getAgencyPortfolioMetricsAction(startDate, endDate);
            if (isMounted && res.success) {
                setPortfolio(res.data);
            }
        } finally {
            if (isMounted) setLoadingData(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchPortfolioData(isMounted);
        return () => { isMounted = false; };
    }, [startDate, endDate]);

    // NEW: Sync Portfolio Action
    const handleSyncPortfolio = async () => {
        setIsSyncing(true);
        try {
            const res = await syncAgencyPortfolioAction(startDate, endDate);
            if (res.success) {
                // If sync succeeds, immediately re-fetch the portfolio data to update the UI
                await fetchPortfolioData(true);
            } else {
                console.error("Sync failed:", res.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Run AI Analysis
    const runGodModeAi = async () => {
        if (!portfolio) return;
        setLoadingAi(true);
        try {
            const res = await generateAgencyAiInsightsAction(portfolio);
            setInsights(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAi(false);
        }
    };

    const fCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD' }).format(isNaN(v) ? 0 : v);
    const fNum = (v: number) => new Intl.NumberFormat('en-US').format(isNaN(v) ? 0 : v);
    const fPct = (v: number) => `${(isNaN(v) ? 0 : v).toFixed(2)}%`;

    if (loadingData && !portfolio) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="h-7 w-7 text-blue-600" /> Agency God View
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Macro portfolio performance and critical alerts.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* NEW SYNC BUTTON */}
                    <Button
                        onClick={handleSyncPortfolio}
                        disabled={isSyncing || loadingData}
                        variant="outline"
                        className="w-full sm:w-auto bg-white hover:bg-slate-50 border-slate-200 shadow-sm text-slate-700"
                    >
                        {isSyncing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" /> Syncing Ads...</>
                        ) : (
                            <><CloudDownload className="h-4 w-4 mr-2 text-blue-600" /> Sync Portfolio</>
                        )}
                    </Button>

                    <div className="flex items-center bg-white rounded-full border border-slate-200 shadow-sm px-4 py-1.5 gap-2 w-full sm:w-auto">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none" />
                        <span className="text-slate-300 font-light">—</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none" />
                    </div>
                </div>
            </div>

            {/* ── PORTFOLIO KPIS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Active Accounts", val: portfolio?.agencyTotals.activeAccountsCount, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Blended Spend", val: fCur(portfolio?.agencyTotals.spend), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Total Conversions", val: fNum(portfolio?.agencyTotals.conversions), icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Blended CPA", val: fCur(portfolio?.agencyTotals.cpa), icon: Activity, color: "text-rose-600", bg: "bg-rose-50" },
                ].map((kpi, i) => (
                    <Card key={i} className="shadow-sm border-slate-200">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
                                <p className="text-2xl font-bold text-slate-900">{kpi.val}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${kpi.bg}`}>
                                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── AI GOD MODE ENGINE ── */}
            <Card className="border-slate-300 shadow-md bg-slate-950 text-slate-100 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-400" /> Portfolio Intelligence Engine
                    </CardTitle>
                    {!insights && !loadingAi && (
                        <Button onClick={runGodModeAi} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                            Run Portfolio Analysis
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    {loadingAi ? (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            <p className="text-sm">Scanning entire portfolio for churn risks and performance fires...</p>
                        </div>
                    ) : insights ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                            {/* Macro & Growth */}
                            <div className="p-6 lg:col-span-1 space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Macro Summary</h4>
                                    <p className="text-sm leading-relaxed text-slate-300">{insights.macro_summary}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Blended Efficiency</h4>
                                    <p className="text-sm leading-relaxed text-slate-300">{insights.blended_efficiency}</p>
                                </div>
                            </div>

                            {/* Critical Fires ("What's fucking up") */}
                            <div className="p-6 lg:col-span-2 bg-slate-900/50">
                                <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4" /> Critical Fires (Immediate Action Required)
                                </h4>

                                {insights.critical_fires?.length === 0 ? (
                                    <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4 text-emerald-400 text-sm flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" /> All accounts are actively spending and operating within acceptable parameters. No critical churn risks detected.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {insights.critical_fires?.map((fire: any, i: number) => (
                                            <div key={i} className="bg-red-950/20 border border-red-900/50 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-bold text-red-400">{fire.account_name}</h5>
                                                    <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded uppercase font-bold">{fire.severity}</span>
                                                </div>
                                                <p className="text-sm text-slate-300 mb-2"><strong className="text-slate-100">Issue:</strong> {fire.the_problem}</p>
                                                <p className="text-sm text-amber-200/80"><strong className="text-amber-400">Fix:</strong> {fire.recommended_action}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            Click 'Run Portfolio Analysis' to identify retention risks and actionable fires.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── FULL PORTFOLIO LEDGER ── */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center py-4">
                    <CardTitle className="text-base font-bold text-slate-800">Portfolio Ledger</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs uppercase hover:bg-transparent">
                                <TableHead className="font-bold">Client Account</TableHead>
                                <TableHead className="text-right font-bold">Spend</TableHead>
                                <TableHead className="text-right font-bold">Conv.</TableHead>
                                <TableHead className="text-right font-bold">Blended CPA</TableHead>
                                <TableHead className="text-right font-bold">CTR</TableHead>
                                <TableHead className="text-right font-bold">CPC</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {portfolio?.accountBreakdown.map((acc: any) => (
                                <TableRow key={acc.accountId} className="text-sm hover:bg-slate-50 cursor-pointer transition-colors">
                                    <TableCell>
                                        <div className="font-semibold text-slate-900">{acc.name}</div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{acc.googleAccountId}</div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{fCur(acc.spend)}</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-emerald-600">{fNum(acc.conversions)}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        <span className={acc.cpa > (portfolio.agencyTotals.cpa * 1.5) ? "text-red-600 font-bold bg-red-50 px-2 py-1 rounded" : ""}>
                                            {fCur(acc.cpa)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <span className={acc.ctr > 0 && acc.ctr < 3 ? "text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded" : "text-slate-500"}>
                                            {fPct(acc.ctr)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-slate-500">{fCur(acc.cpc)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}