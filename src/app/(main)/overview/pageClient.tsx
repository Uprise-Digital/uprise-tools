"use client";

import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  CloudDownload,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  getAgencyPortfolioMetricsAction,
  getOrGenerateAgencyAiInsightsAction,
  syncAgencyPortfolioAction,
} from "@/actions/agency.actions";
import { sendMorningBriefingAction } from "@/actions/briefing.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AgencyReportsClient() {
  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0],
  );

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

  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(10);

  const router = useRouter();

  useEffect(() => {
    setLedgerPage(1);
  }, [ledgerSearch, hideInactive]);

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

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  // 2. Fetch or Generate AI Insights
  const fetchGodModeAi = async (forceRefresh: boolean, isMounted = true) => {
    if (forceRefresh) setIsAiRefreshing(true);
    else setIsAiLoading(true);

    try {
      const res = await getOrGenerateAgencyAiInsightsAction(
        startDate,
        endDate,
        portfolio,
        forceRefresh,
      );
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

  // Send Briefing Action
  const [isSendingBriefing, setIsSendingBriefing] = useState(false);
  const handleSendMorningBriefing = async () => {
    setIsSendingBriefing(true);
    const toastId = toast.loading("Generating and sending Morning Briefing...");
    try {
      const res = await sendMorningBriefingAction();
      if (res.success) {
        toast.success(res.message || "Morning Briefing sent successfully!", {
          id: toastId,
        });
      } else {
        toast.error(res.error || "Failed to send Morning Briefing.", {
          id: toastId,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsSendingBriefing(false);
    }
  };

  // Formatters
  const fCur = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AUD",
    }).format(isNaN(v) ? 0 : v);
  const fNum = (v: number) =>
    new Intl.NumberFormat("en-US").format(isNaN(v) ? 0 : v);
  const fPct = (v: number) => `${(isNaN(v) ? 0 : v).toFixed(2)}%`;

  const formatTimeAgo = (date: Date) => {
    const mins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  // Calculate Dynamic Churn Risk
  const getChurnRisk = (acc: any, blendedCpa: number) => {
    if (acc.spend === 0)
      return {
        label: "Inactive",
        classes: "bg-slate-100 text-slate-500 border-slate-200",
      };

    if (
      (acc.spend > 100 && acc.conversions === 0) ||
      acc.cpa > blendedCpa * 3
    ) {
      return {
        label: "High Risk",
        classes: "bg-red-50 text-red-700 border-red-200 font-bold",
      };
    }

    if (acc.cpa > blendedCpa * 1.5 || (acc.ctr < 3 && acc.conversions < 5)) {
      return {
        label: "Medium",
        classes: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    return {
      label: "Healthy",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  };

  if (loadingData && !portfolio) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }



  // Filtered Accounts
  const visibleAccounts =
    portfolio?.accountBreakdown?.filter((acc: any) =>
      hideInactive ? acc.spend > 0 : true,
    ) || [];

  const searchedAccounts = visibleAccounts.filter((acc: any) => {
    return (
      acc.name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      acc.googleAccountId.includes(ledgerSearch)
    );
  });

  const totalPages = Math.ceil(searchedAccounts.length / ledgerLimit);
  const paginatedAccounts = searchedAccounts.slice(
    (ledgerPage - 1) * ledgerLimit,
    ledgerPage * ledgerLimit,
  );

  const exportLedgerToCsv = () => {
    const headers = ["Account Name", "Google ID", "Churn Risk", "Spend", "Conversions", "CPA", "CTR", "CPC"];
    const rows = searchedAccounts.map((acc: any) => {
      const risk = getChurnRisk(acc, portfolio?.agencyTotals?.cpa || 0);
      return [
        acc.name,
        acc.googleAccountId,
        risk.label,
        acc.spend,
        acc.conversions,
        acc.cpa,
        acc.ctr,
        acc.cpc,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e: any[]) =>
          e
            .map((val: any) => {
              const textStr = String(val === null || val === undefined ? "" : val);
              return `"${textStr.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `portfolio_ledger_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Portfolio ledger exported successfully.");
  };

  // --- ON-THE-FLY ANALYST METRICS ---
  const totalSpend = portfolio?.agencyTotals?.spend || 0;
  const totalConv = portfolio?.agencyTotals?.conversions || 0;
  const whales = visibleAccounts.filter(
    (a: any) => a.spend > totalSpend * 0.25,
  );
  const whaleSpend = whales.reduce((sum: number, w: any) => sum + w.spend, 0);
  const whaleConv = whales.reduce(
    (sum: number, w: any) => sum + w.conversions,
    0,
  );

  const nonWhaleSpend = totalSpend - whaleSpend;
  const nonWhaleConv = totalConv - whaleConv;
  const nonWhaleCpa = nonWhaleConv > 0 ? nonWhaleSpend / nonWhaleConv : 0;
  const whaleSpendShare = totalSpend > 0 ? (whaleSpend / totalSpend) * 100 : 0;

  const handleRowClick = (accountId: number) => {
    router.push(`/accounts/${accountId}`);
  };


  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" /> Agency God View
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Macro portfolio performance and critical alerts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={handleSyncPortfolio}
            disabled={isSyncing || loadingData}
            variant="outline"
            className="w-full sm:w-auto bg-white"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />{" "}
                Syncing...
              </>
            ) : (
              <>
                <CloudDownload className="h-4 w-4 mr-2 text-blue-600" /> Sync
                Portfolio
              </>
            )}
          </Button>

          <Button
            onClick={handleSendMorningBriefing}
            disabled={isSendingBriefing || loadingData}
            variant="outline"
            className="w-full sm:w-auto bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {isSendingBriefing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />{" "}
                Sending...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-blue-600" /> Send
                Briefing
              </>
            )}
          </Button>

          <div className="flex items-center bg-white rounded-full border border-slate-200 shadow-sm px-4 py-1.5 gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none"
            />
            <span className="text-slate-300 font-light">—</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none h-8 w-[120px] p-0 text-sm focus-visible:ring-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* ── UPGRADED PORTFOLIO KPIS (6-Grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="m-0 p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                All Accounts
              </p>
              <p className="text-xl font-black text-slate-900">
                {portfolio?.agencyTotals?.activeAccountsCount || 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50">
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Blended Spend
              </p>
              <p className="text-xl font-black text-slate-900">
                {fCur(totalSpend)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Conv.
              </p>
              <p className="text-xl font-black text-slate-900">
                {fNum(totalConv)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50">
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-indigo-500">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Blended CPA
              </p>
              <p className="text-xl font-black text-slate-900">
                {fCur(portfolio?.agencyTotals?.cpa || 0)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100">
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-emerald-500 bg-emerald-50/30 relative overflow-hidden">
          <CardContent className="p-5 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Non-Whale CPA
              </p>
              <p className="text-xl font-black text-emerald-800">
                {fCur(nonWhaleCpa)}
              </p>
            </div>
          </CardContent>
          <Scale className="absolute -bottom-3 -right-2 w-16 h-16 text-emerald-100 opacity-60 z-0" />
        </Card>

        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-amber-500 bg-amber-50/30 relative overflow-hidden">
          <CardContent className="p-5 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Whale Spend
              </p>
              <p className="text-xl font-black text-amber-800">
                {fPct(whaleSpendShare)}
              </p>
            </div>
          </CardContent>
          <Activity className="absolute -bottom-3 -right-2 w-16 h-16 text-amber-100 opacity-60 z-0" />
        </Card>
      </div>

      {/* ── UPGRADED AI GOD MODE ENGINE ── */}
      <Card className="border-slate-300 shadow-md bg-slate-950 text-slate-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
        {isAiRefreshing && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        <CardHeader className="border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" /> Portfolio
            Intelligence Engine
          </CardTitle>

          <div className="flex items-center gap-3">
            {generatedAt && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
                <Clock className="h-3 w-3" /> Report from{" "}
                {formatTimeAgo(generatedAt)}
              </div>
            )}
            <Button
              onClick={() => fetchGodModeAi(true)}
              disabled={isAiLoading || isAiRefreshing || !portfolio}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-900/20"
            >
              {isAiRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Run Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isAiLoading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium">
                Scanning portfolio for churn risks, anomalies, and scaling
                opportunities...
              </p>
            </div>
          ) : insights ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
              {/* LEFT COLUMN: Strategic Narratives */}
              <div className="p-6 lg:col-span-1 space-y-6 bg-slate-950">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target className="h-3 w-3 text-blue-400" /> Macro Summary
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {insights?.macro_summary || "No summary available."}
                  </p>
                </div>
                <div className="h-px bg-slate-800 w-full" />
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Activity className="h-3 w-3 text-emerald-400" /> Blended
                    Efficiency
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-300">
                    {insights?.blended_efficiency ||
                      "No efficiency data available."}
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: Triage Queue & Growth */}
              <div className="lg:col-span-2 bg-slate-900/40 flex flex-col">
                {/* Triage Queue (Critical Fires) */}
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                      <Flame className="h-4 w-4" /> Critical Fires Queue
                    </h4>
                    <span className="bg-red-950/50 border border-red-900/50 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {insights?.critical_fires?.length || 0} Alerts
                    </span>
                  </div>

                  {!insights?.critical_fires ||
                  insights.critical_fires.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/50">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                      <p className="text-sm font-medium">
                        Portfolio is stable. No critical fires detected.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {insights.critical_fires.map((fire: any, i: number) => (
                        <div
                          key={i}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-red-900/50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <h5 className="font-bold text-base text-slate-100">
                              {fire?.account_name}
                            </h5>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                fire?.severity === "Critical"
                                  ? "bg-red-500 text-white"
                                  : "bg-orange-500/20 text-orange-400 border border-orange-500/20"
                              }`}
                            >
                              {fire?.severity}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-red-400" />{" "}
                                The Bleed
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed">
                                {fire?.the_problem}
                              </p>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-amber-400" />{" "}
                                Action Required
                              </div>
                              <p className="text-sm text-amber-100/70 leading-relaxed">
                                {fire?.recommended_action}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Growth Opportunities */}
                <div className="p-6 border-t border-slate-800 bg-slate-950/30">
                  <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Scale Opportunities
                  </h4>

                  {!insights?.growth_opportunities ||
                  insights.growth_opportunities.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No clear scaling opportunities identified in this window.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {insights.growth_opportunities.map(
                        (growth: any, i: number) => (
                          <div
                            key={i}
                            className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg p-4"
                          >
                            <h5 className="font-bold text-sm text-emerald-400 mb-1">
                              {growth?.account_name}
                            </h5>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {growth?.reasoning}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-slate-700" />
              Click 'Run Analysis' to process the portfolio and generate the
              intelligence report.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FULL PORTFOLIO LEDGER ── */}
      <Card className="pt-0 shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center py-4 gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800">
              Portfolio Ledger
            </CardTitle>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search account or Google ID..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="pl-8 text-xs h-8 bg-white"
              />
            </div>
            
            <Button
              onClick={exportLedgerToCsv}
              variant="outline"
              size="sm"
              className="text-xs h-8 flex items-center gap-1.5 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHideInactive(!hideInactive)}
              className="text-xs text-slate-500 hover:text-slate-900 h-8"
            >
              {hideInactive ? (
                <>
                  <Eye className="h-3 w-3 mr-1" /> Show All
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" /> Hide Inactive ($0)
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase hover:bg-transparent">
                <TableHead className="font-bold">Client Account</TableHead>
                <TableHead className="text-center font-bold w-[120px]">
                  Churn Risk
                </TableHead>
                <TableHead className="text-right font-bold">Spend</TableHead>
                <TableHead className="text-right font-bold">Conv.</TableHead>
                <TableHead className="text-right font-bold">
                  Blended CPA
                </TableHead>
                <TableHead className="text-right font-bold">CTR</TableHead>
                <TableHead className="text-right font-bold">CPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.map((acc: any) => {
                const risk = getChurnRisk(
                  acc,
                  portfolio?.agencyTotals?.cpa || 0,
                );

                return (
                  <TableRow
                      onClick={() => handleRowClick(acc.accountId)}
                    key={acc.accountId}
                    className="text-sm hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {acc.googleAccountId}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`px-2 py-1 text-[10px] rounded-full border uppercase tracking-wider ${risk.classes}`}
                      >
                        {risk.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fCur(acc.spend)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                      {fNum(acc.conversions)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          acc.cpa > portfolio?.agencyTotals?.cpa * 1.5
                            ? "text-red-600 font-bold bg-red-50 px-2 py-1 rounded"
                            : ""
                        }
                      >
                        {fCur(acc.cpa)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          acc.ctr > 0 && acc.ctr < 3
                            ? "text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded"
                            : "text-slate-500"
                        }
                      >
                        {fPct(acc.ctr)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-500">
                      {fCur(acc.cpc)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{searchedAccounts.length > 0 ? (ledgerPage - 1) * ledgerLimit + 1 : 0}</strong> to{" "}
            <strong className="text-slate-800">{Math.min(ledgerPage * ledgerLimit, searchedAccounts.length)}</strong> of{" "}
            <strong className="text-slate-800">{searchedAccounts.length}</strong> accounts
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 border rounded px-2 py-1 bg-white">
              <span className="text-[10px] text-slate-400">Rows:</span>
              <select
                value={ledgerLimit}
                onChange={(e) => setLedgerLimit(parseInt(e.target.value, 10))}
                className="bg-transparent border-none focus:outline-none text-[10px] font-semibold cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage(ledgerPage - 1)}
                  className="h-7 w-7 border-slate-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pNum = index + 1;
                  return (
                    <Button
                      key={pNum}
                      variant={ledgerPage === pNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLedgerPage(pNum)}
                      className="h-7 w-7 text-[10px] border-slate-200"
                    >
                      {pNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={ledgerPage >= totalPages}
                  onClick={() => setLedgerPage(ledgerPage + 1)}
                  className="h-7 w-7 border-slate-200"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
