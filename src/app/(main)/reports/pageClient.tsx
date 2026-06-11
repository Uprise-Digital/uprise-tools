"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Activity,
    Calendar,
    Clock,
    CloudDownload,
    DollarSign,
    Loader2,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingUp,
    Users,
    EyeOff,
    Eye
} from "lucide-react";
import {
    getAgencyPortfolioMetricsAction, getOrGenerateAgencyAiInsightsAction,
    syncAgencyPortfolioAction
} from "@/actions/agency.actions";

export default function AgencyReportsClient() {
    const today = new Date();
    const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]);

    const [loadingData, setLoadingData] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // UI States
    const [hideInactive, setHideInactive] = useState(true);

    // AI States
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAiRefreshing, setIsAiRefreshing] = useState(false);

    const [portfolio, setPortfolio] = useState<any>(null);
    const [insights, setInsights] = useState<any>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

    // 1. Fetch Base Data
    const fetchPortfolioData = async (isMounted = true) => {
        setLoadingData(true);
        try {
            const res = await getAgencyPortfolioMetricsAction(startDate, endDate);
            if (isMounted && res.success) {
                setPortfolio(res.data);
            }
        } finally {
            if (isMounted) setLoadingData(false);
        }
    };

    // Run this when dates change
    useEffect(() => {
        let isMounted = true;
        setInsights(null); // Clear UI while fetching
        setGeneratedAt(null);

        fetchPortfolioData(isMounted).then(() => {
            if (isMounted) {
                fetchGodModeAi(false, isMounted);
            }
        });

        return () => { isMounted = false; };
    }, [startDate, endDate]);

    // 2. Fetch or Generate AI Insights
    const fetchGodModeAi = async (forceRefresh: boolean, isMounted = true) => {
        if (forceRefresh) setIsAiRefreshing(true);
        else setIsAiLoading(true);

        try {
            const res = await getOrGenerateAgencyAiInsightsAction(startDate, endDate, portfolio, forceRefresh);
            if (isMounted && res.success) {
                setInsights(res.data);
                setGeneratedAt(new Date(res.generatedAt));
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (isMounted) {
                setIsAiLoading(false);
                setIsAiRefreshing(false);
            }
        }
    };

    // Sync Portfolio Action
    const handleSyncPortfolio = async () => {
        setIsSyncing(true);
        try {
            const res = await syncAgencyPortfolioAction(startDate, endDate);
            if (res.success) {
                await fetchPortfolioData(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Formatters
    const fCur = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD' }).format(isNaN(v) ? 0 : v);
    const fNum = (v: number) => new Intl.NumberFormat('en-US').format(isNaN(v) ? 0 : v);
    const fPct = (v: number) => `${(isNaN(v) ? 0 : v).toFixed(2)}%`;

    const formatTimeAgo = (date: Date) => {
        const mins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} min ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    // Calculate Dynamic Churn Risk
    const getChurnRisk = (acc: any, blendedCpa: number) => {
        if (acc.spend === 0) return { label: "Inactive", classes: "bg-slate-100 text-slate-500 border-slate-200" };

        // High Risk: Spending over $100 with zero conversions, OR CPA is astronomically high (>3x average)
        if ((acc.spend > 100 && acc.conversions === 0) || (acc.cpa > blendedCpa * 3)) {
            return { label: "High Risk", classes: "bg-red-50 text-red-700 border-red-200 font-bold" };
        }

        // Medium Risk: CPA is somewhat high (>1.5x average), OR CTR is terrible but they still have a few conversions
        if (acc.cpa > blendedCpa * 1.5 || (acc.ctr < 3 && acc.conversions < 5)) {
            return { label: "Medium", classes: "bg-amber-50 text-amber-700 border-amber-200" };
        }

        // Low Risk: Healthy account
        return { label: "Healthy", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    };

    if (loadingData && !portfolio) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500"/></div>;
    }

    // Filtered Accounts
    const visibleAccounts = portfolio?.accountBreakdown.filter((acc: any) =>
        hideInactive ? acc.spend > 0 : true
    ) || [];

    return (
        <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="h-7 w-7 text-blue-600"/> Agency God View
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Macro portfolio performance and critical alerts.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Button onClick={handleSyncPortfolio} disabled={isSyncing || loadingData} variant="outline" className="w-full sm:w-auto bg-white">
                        {isSyncing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600"/> Syncing...</> : <><CloudDownload className="h-4 w-4 mr-2 text-blue-600"/> Sync Portfolio</>}
                    </Button>

                    <div className="flex items-center bg-white rounded-full border border-slate-200 shadow-sm px-4 py-1.5 gap-2">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0"/>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none"/>
                        <span className="text-slate-300 font-light">—</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none"/>
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
                            <div className={`p-3 rounded-xl ${kpi.bg}`}><kpi.icon className={`h-5 w-5 ${kpi.color}`}/></div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── AI GOD MODE ENGINE ── */}
            <Card className="border-slate-300 shadow-md bg-slate-950 text-slate-100 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"/>
                {isAiRefreshing && <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] z-10 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500"/></div>}

                <CardHeader className="border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-400"/> Portfolio Intelligence Engine
                    </CardTitle>

                    <div className="flex items-center gap-3">
                        {generatedAt && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
                                <Clock className="h-3 w-3"/> Report from {formatTimeAgo(generatedAt)}
                            </div>
                        )}
                        <Button
                            onClick={() => fetchGodModeAi(true)}
                            disabled={isAiLoading || isAiRefreshing || !portfolio}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                        >
                            {isAiRefreshing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Analyzing...</> : <><RefreshCw className="h-4 w-4 mr-2"/> Run Analysis</>}
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isAiLoading ? (
                        <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500"/>
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

                            {/* Critical Fires & Growth */}
                            <div className="lg:col-span-2 bg-slate-900/50 flex flex-col">
                                <div className="p-6">
                                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4"/> Critical Fires (Immediate Action Required)
                                    </h4>

                                    {!insights.critical_fires || insights.critical_fires.length === 0 ? (
                                        <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4 text-emerald-400 text-sm flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4"/> All active accounts are operating within acceptable parameters. No critical churn risks detected.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {insights.critical_fires.map((fire: any, i: number) => (
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

                                {/* Growth Opportunities */}
                                <div className="p-6 border-t border-slate-800 flex-1">
                                    <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" /> Growth Opportunities (Scale Budget)
                                    </h4>

                                    {!insights.growth_opportunities || insights.growth_opportunities.length === 0 ? (
                                        <p className="text-sm text-slate-400">No clear scaling opportunities identified in the current data window.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {insights.growth_opportunities.map((growth: any, i: number) => (
                                                <div key={i} className="bg-emerald-950/20 border border-emerald-900/50 rounded-lg p-4">
                                                    <h5 className="font-bold text-emerald-400 mb-2">{growth.account_name}</h5>
                                                    <p className="text-sm text-slate-300"><strong className="text-slate-100">Why scale:</strong> {growth.reasoning}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            Click 'Run Analysis' to process the portfolio and generate the intelligence report.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── FULL PORTFOLIO LEDGER ── */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center py-4">
                    <CardTitle className="text-base font-bold text-slate-800">Portfolio Ledger</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHideInactive(!hideInactive)}
                        className="text-xs text-slate-500 hover:text-slate-900"
                    >
                        {hideInactive ? <><Eye className="h-3 w-3 mr-1"/> Show All</> : <><EyeOff className="h-3 w-3 mr-1"/> Hide Inactive ($0)</>}
                    </Button>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs uppercase hover:bg-transparent">
                                <TableHead className="font-bold">Client Account</TableHead>
                                <TableHead className="text-center font-bold w-[120px]">Churn Risk</TableHead>
                                <TableHead className="text-right font-bold">Spend</TableHead>
                                <TableHead className="text-right font-bold">Conv.</TableHead>
                                <TableHead className="text-right font-bold">Blended CPA</TableHead>
                                <TableHead className="text-right font-bold">CTR</TableHead>
                                <TableHead className="text-right font-bold">CPC</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleAccounts.map((acc: any) => {
                                const risk = getChurnRisk(acc, portfolio?.agencyTotals.cpa || 0);

                                return (
                                    <TableRow key={acc.accountId} className="text-sm hover:bg-slate-50 cursor-pointer transition-colors">
                                        <TableCell>
                                            <div className="font-semibold text-slate-900">{acc.name}</div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{acc.googleAccountId}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`px-2 py-1 text-[10px] rounded-full border uppercase tracking-wider ${risk.classes}`}>
                                                {risk.label}
                                            </span>
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
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}