"use client";

import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudDownload,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { toast } from "sonner";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

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
  const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const localMonthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [startDate, setStartDate] = useState(localMonthStartStr);
  const [endDate, setEndDate] = useState(localTodayStr);

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
  const [expandedFires, setExpandedFires] = useState<Record<number, boolean>>({
    0: true,
  });

  useEffect(() => {
    setLedgerPage(1);
  }, []);

  // 1. Fetch Base Data
  const fetchPortfolioData = useCallback(
    async (isMounted = true) => {
      setLoadingData(true);
      try {
        const res = await getAgencyPortfolioMetricsAction(startDate, endDate);
        if (isMounted && res.success) {
          setPortfolio(res.data);
          return res.data;
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
      return null;
    },
    [startDate, endDate],
  );

  // 2. Fetch or Generate AI Insights
  const fetchGodModeAi = useCallback(
    async (forceRefresh: boolean, portfolioToUse: any, isMounted = true) => {
      if (forceRefresh) setIsAiRefreshing(true);
      else setIsAiLoading(true);

      try {
        const res = await getOrGenerateAgencyAiInsightsAction(
          startDate,
          endDate,
          portfolioToUse,
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
    },
    [startDate, endDate],
  );

  // Run this when dates change
  useEffect(() => {
    let isMounted = true;
    setInsights(null); // Clear UI while fetching
    setGeneratedAt(null);

    fetchPortfolioData(isMounted).then((freshPortfolio) => {
      if (isMounted) {
        fetchGodModeAi(false, freshPortfolio, isMounted);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchGodModeAi, fetchPortfolioData]);

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
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
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
    const headers = [
      "Account Name",
      "Google ID",
      "Churn Risk",
      "Spend",
      "Conversions",
      "CPA",
      "CTR",
      "CPC",
    ];
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
              const textStr = String(
                val === null || val === undefined ? "" : val,
              );
              return `"${textStr.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `portfolio_ledger_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
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

  const renderActionLinks = (fire: any) => {
    const matchedAcc = portfolio?.accountBreakdown?.find(
      (acc: any) =>
        acc.name.toLowerCase() === fire?.account_name?.toLowerCase() ||
        fire?.account_name?.toLowerCase().includes(acc.name.toLowerCase()) ||
        acc.name.toLowerCase().includes(fire?.account_name?.toLowerCase()),
    );

    if (!matchedAcc) return null;

    const probAndAction =
      `${fire?.the_problem || ""} ${fire?.recommended_action || ""}`.toLowerCase();
    const isKeywordIssue =
      /keyword|search[- ]term|search[- ]query|broad[- ]match|negative/i.test(
        probAndAction,
      );
    const isCopyIssue =
      /copy|headline|description|pinned|ad[- ]text|creative|cta/i.test(
        probAndAction,
      );

    return (
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 mt-3">
        {isKeywordIssue && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/accounts/${matchedAcc.accountId}/negatives`);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Manage Negative Keywords
          </Button>
        )}
        {isCopyIssue && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/ad-audit?accountId=${matchedAcc.accountId}`);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Optimize Ad Copy
          </Button>
        )}
        {!isKeywordIssue && !isCopyIssue && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/accounts/${matchedAcc.accountId}`);
            }}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs px-3.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            View Account Details
          </Button>
        )}
      </div>
    );
  };

  const getWeekendReferenceAreas = (dailyTotals: any[]) => {
    if (!dailyTotals || dailyTotals.length === 0) return [];

    const areas: Array<{ x1: string; x2: string; id: string }> = [];
    let currentWeekend: { x1: string; x2: string } | null = null;

    dailyTotals.forEach((d) => {
      const dateObj = new Date(`${d.date}T00:00:00`);
      const day = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = day === 0 || day === 6;

      if (isWeekend) {
        if (!currentWeekend) {
          currentWeekend = { x1: d.date, x2: d.date };
        } else {
          currentWeekend.x2 = d.date;
        }
      } else {
        if (currentWeekend) {
          areas.push({
            x1: currentWeekend.x1,
            x2: currentWeekend.x2,
            id: `${currentWeekend.x1}-${currentWeekend.x2}`,
          });
          currentWeekend = null;
        }
      }
    });

    const finalCw = currentWeekend as { x1: string; x2: string } | null;
    if (finalCw) {
      areas.push({
        x1: finalCw.x1,
        x2: finalCw.x2,
        id: `${finalCw.x1}-${finalCw.x2}`,
      });
    }

    return areas;
  };

  const weekendAreas = getWeekendReferenceAreas(portfolio?.dailyTotals || []);

  // --- CHART DATASETS & CONFIGS ---

  // 1. Daily CPA Trend Data
  const dailyTotalsWithCpa = portfolio?.dailyTotals?.map((item: any) => ({
    ...item,
    cpa: item.conversions > 0 ? Number((item.spend / item.conversions).toFixed(2)) : 0,
  })) || [];

  // 2. Account Spend Share Data (Pie Chart: Top 5 + Other)
  const spendData = portfolio?.accountBreakdown
    ?.filter((acc: any) => acc.spend > 0)
    ?.sort((a: any, b: any) => b.spend - a.spend) || [];

  const topSpends = spendData.slice(0, 5);
  const otherSpendsSum = spendData.slice(5).reduce((sum: number, a: any) => sum + a.spend, 0);
  const pieData = [
    ...topSpends.map((a: any) => ({ name: a.name, value: a.spend })),
    ...(otherSpendsSum > 0 ? [{ name: "Other Accounts", value: otherSpendsSum }] : [])
  ];
  const PIE_COLORS = ["#4f46e5", "#7c3aed", "#9333ea", "#c084fc", "#e879f9", "#94a3b8"];

  // 3. Account Conversions Data (Horizontal Bar: Top 8)
  const barData = portfolio?.accountBreakdown
    ?.filter((acc: any) => acc.conversions > 0)
    ?.sort((a: any, b: any) => b.conversions - a.conversions)
    ?.slice(0, 8)
    ?.map((a: any) => ({ name: a.name, conversions: a.conversions })) || [];

  // 4. Spend vs CPA Scatter Data (Bubble sized by conversions, colored by risk)
  const scatterData = portfolio?.accountBreakdown?.map((acc: any) => {
    const risk = getChurnRisk(acc, portfolio?.agencyTotals?.cpa || 0);
    return {
      name: acc.name,
      spend: acc.spend,
      cpa: acc.cpa,
      conversions: acc.conversions,
      riskLevel: risk.label,
      color: risk.label === "High Risk" ? "#ef4444" : risk.label === "Medium" ? "#f59e0b" : "#10b981",
    };
  }) || [];

  // 5. Risk-Weighted Spend Data
  const riskTiers = { Healthy: 0, Medium: 0, High: 0 };
  portfolio?.accountBreakdown?.forEach((acc: any) => {
    const risk = getChurnRisk(acc, portfolio?.agencyTotals?.cpa || 0);
    if (risk.label === "High Risk") riskTiers.High += acc.spend;
    else if (risk.label === "Medium") riskTiers.Medium += acc.spend;
    else riskTiers.Healthy += acc.spend;
  });
  const totalActiveSpend = riskTiers.Healthy + riskTiers.Medium + riskTiers.High;
  const riskSpendData = [
    { name: "Healthy", spend: riskTiers.Healthy, pct: totalActiveSpend > 0 ? (riskTiers.Healthy / totalActiveSpend) * 100 : 0, color: "#10b981" },
    { name: "Medium Risk", spend: riskTiers.Medium, pct: totalActiveSpend > 0 ? (riskTiers.Medium / totalActiveSpend) * 100 : 0, color: "#f59e0b" },
    { name: "High Risk", spend: riskTiers.High, pct: totalActiveSpend > 0 ? (riskTiers.High / totalActiveSpend) * 100 : 0, color: "#ef4444" },
  ];

  // 6. CTR vs CPC Scatter Data
  const ctrCpcData = portfolio?.accountBreakdown
    ?.filter((acc: any) => acc.ctr > 0 && acc.cpc > 0)
    ?.map((acc: any) => {
      const risk = getChurnRisk(acc, portfolio?.agencyTotals?.cpa || 0);
      return {
        name: acc.name,
        ctr: acc.ctr,
        cpc: acc.cpc,
        riskLevel: risk.label,
        color: risk.label === "High Risk" ? "#ef4444" : risk.label === "Medium" ? "#f59e0b" : "#10b981",
      };
    }) || [];

  // --- SHADCN CHART CONFIGS ---
  const dualAxisChartConfig = {
    spend: { label: "Spend", color: "#4f46e5" },
    conversions: { label: "Conversions", color: "#10b981" },
  } satisfies ChartConfig;

  const cpaChartConfig = {
    cpa: { label: "CPA", color: "#f59e0b" },
  } satisfies ChartConfig;

  const pieChartConfig = {
    spend: { label: "Spend" },
  } satisfies ChartConfig;

  const conversionsChartConfig = {
    conversions: { label: "Conversions", color: "#10b981" },
  } satisfies ChartConfig;

  const scatterChartConfig = {
    accounts: { label: "Accounts" },
  } satisfies ChartConfig;

  const riskSpendChartConfig = {
    spend: { label: "Spend" },
  } satisfies ChartConfig;

  const ctrCpcChartConfig = {
    accounts: { label: "Accounts" },
  } satisfies ChartConfig;

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-md rounded-md space-y-1 text-xs">
          <p className="font-bold text-slate-900">{data.name}</p>
          <div className="space-y-0.5 text-slate-500">
            <p>Spend: <span className="font-semibold text-slate-800">{fCur(data.spend)}</span></p>
            <p>CPA: <span className="font-semibold text-slate-800">{fCur(data.cpa)}</span></p>
            <p>Conversions: <span className="font-semibold text-slate-800">{fNum(data.conversions)}</span></p>
            <p>Risk: <span className="font-semibold" style={{ color: data.color }}>{data.riskLevel}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomCtrCpcTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-md rounded-md space-y-1 text-xs">
          <p className="font-bold text-slate-900">{data.name}</p>
          <div className="space-y-0.5 text-slate-500">
            <p>CTR: <span className="font-semibold text-slate-800">{fPct(data.ctr)}</span></p>
            <p>CPC: <span className="font-semibold text-slate-800">{fCur(data.cpc)}</span></p>
            <p>Risk: <span className="font-semibold" style={{ color: data.color }}>{data.riskLevel}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

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

      {/* ── CONDENSED 6-GRID KPIS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: All Accounts */}
        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                All Accounts
              </p>
              <p className="text-lg font-black text-slate-900">
                {portfolio?.agencyTotals?.activeAccountsCount || 0}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 shrink-0">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Blended Spend */}
        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Blended Spend
              </p>
              <p className="text-lg font-black text-slate-900">
                {fCur(totalSpend)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 shrink-0">
              <DollarSign className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Conversions */}
        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Total Conv.
              </p>
              <p className="text-lg font-black text-slate-900">
                {fNum(totalConv)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 shrink-0">
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Blended CPA */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-indigo-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Blended CPA
              </p>
              <p className="text-lg font-black text-slate-900">
                {fCur(portfolio?.agencyTotals?.cpa || 0)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 shrink-0">
              <Activity className="h-3.5 w-3.5 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Non-Whale CPA */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-emerald-500 bg-emerald-50/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                Non-Whale CPA
              </p>
              <p className="text-lg font-black text-emerald-800">
                {fCur(nonWhaleCpa)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 shrink-0">
              <Scale className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Whale Spend Share */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-amber-500 bg-amber-50/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                Whale Spend
              </p>
              <p className="text-lg font-black text-amber-800">
                {fPct(whaleSpendShare)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 shrink-0">
              <Activity className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 1: DAILY PORTFOLIO TRENDS ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Daily Portfolio Trends
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spend vs. Conversions (Dual-Axis Overlay) */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-indigo-500" /> Spend vs. Conversions
              </CardTitle>
              <div className="flex items-center gap-3 text-[11px] md:text-xs">
                <span className="flex items-center gap-1 font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4f46e5] inline-block" /> Spend: {fCur(totalSpend)}
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" /> Conversions: {fNum(totalConv)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {portfolio?.dailyTotals && portfolio.dailyTotals.length > 0 ? (
                <ChartContainer config={dualAxisChartConfig} className="w-full h-full">
                  <ComposedChart data={portfolio.dailyTotals}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    {weekendAreas.map((area) => (
                      <ReferenceArea
                        key={area.id}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#f1f5f9"
                        fillOpacity={0.6}
                        ifOverflow="extendDomain"
                      />
                    ))}
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `$${v}`} stroke="#4f46e5" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(d) => `Date: ${d}`}
                        />
                      }
                    />
                    <Area yAxisId="left" type="monotone" name="spend" dataKey="spend" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#spendGrad)" />
                    <Line yAxisId="right" type="monotone" name="conversions" dataKey="conversions" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No daily metrics found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily CPA Trend */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-500" /> Daily CPA Trend
              </CardTitle>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Blended: {fCur(portfolio?.agencyTotals?.cpa || 0)}
              </span>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {dailyTotalsWithCpa.length > 0 ? (
                <ChartContainer config={cpaChartConfig} className="w-full h-full">
                  <LineChart data={dailyTotalsWithCpa}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    {weekendAreas.map((area) => (
                      <ReferenceArea
                        key={area.id}
                        x1={area.x1}
                        x2={area.x2}
                        fill="#f1f5f9"
                        fillOpacity={0.6}
                        ifOverflow="extendDomain"
                      />
                    ))}
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${v}`} stroke="#f59e0b" fontSize={10} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(d) => `Date: ${d}`}
                          formatter={(value) => [fCur(Number(value)), "CPA"]}
                        />
                      }
                    />
                    <Line type="monotone" name="cpa" dataKey="cpa" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No daily metrics found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 2: PORTFOLIO SHARE & BREAKDOWNS ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5" /> Portfolio Share & Breakdowns
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Spend Share (Pie Chart) */}
          <Card className="border-slate-200 shadow-sm bg-white lg:col-span-1">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-indigo-500" /> Account Spend Share
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {pieData.length > 0 ? (
                <ChartContainer config={pieChartConfig} className="w-full h-full aspect-auto min-h-[240px] flex items-center justify-center">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            const total = pieData.reduce((sum, item) => sum + item.value, 0);
                            const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : "0.0";
                            return [`${fCur(Number(value))} (${pct}%)`, name];
                          }}
                        />
                      }
                    />
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No active spend found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Conversions (Bar Chart) */}
          <Card className="border-slate-200 shadow-sm bg-white lg:col-span-2">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-500" /> Top Accounts by Conversions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {barData.length > 0 ? (
                <ChartContainer config={conversionsChartConfig} className="w-full h-full">
                  <BarChart layout="vertical" data={barData} margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(tick) => (tick.length > 18 ? `${tick.slice(0, 15)}...` : tick)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => [fNum(Number(value)), "Conversions"]}
                        />
                      }
                    />
                    <Bar dataKey="conversions" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No active conversions found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── SECTION 3: RISK & EFFICIENCY DIAGNOSTICS ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Risk & Engagement Diagnostics
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spend vs. CPA Scatter (Bubble) */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> Spend vs. CPA Risk Map
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {scatterData.length > 0 ? (
                <ChartContainer config={scatterChartConfig} className="w-full h-full">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="spend" name="Spend" tickFormatter={(v) => `$${v}`} stroke="#94a3b8" fontSize={9} />
                    <YAxis type="number" dataKey="cpa" name="CPA" tickFormatter={(v) => `$${v}`} stroke="#94a3b8" fontSize={9} />
                    <ZAxis type="number" dataKey="conversions" range={[50, 400]} name="Conversions" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={<CustomScatterTooltip />}
                    />
                    <Scatter name="Accounts" data={scatterData}>
                      {scatterData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          fillOpacity={0.6}
                          stroke={entry.color}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No active accounts found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk-Weighted Spend (Bar) */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-500" /> Churn Risk Spend Share
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {totalActiveSpend > 0 ? (
                <ChartContainer config={riskSpendChartConfig} className="w-full h-full">
                  <BarChart data={riskSpendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${v}`} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, props: any) => [
                            `${fCur(Number(value))} (${props.payload.pct.toFixed(1)}%)`,
                            "Spend"
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="spend" radius={[4, 4, 0, 0]} barSize={40}>
                      {riskSpendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No active spend found
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTR vs CPC Scatter */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 border-b border-slate-100 bg-slate-50/30">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> CTR vs. CPC Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-72">
              {ctrCpcData.length > 0 ? (
                <ChartContainer config={ctrCpcChartConfig} className="w-full h-full">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" dataKey="ctr" name="CTR" tickFormatter={(v) => `${v}%`} stroke="#94a3b8" fontSize={9} />
                    <YAxis type="number" dataKey="cpc" name="CPC" tickFormatter={(v) => `$${v}`} stroke="#94a3b8" fontSize={9} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={<CustomCtrCpcTooltip />}
                    />
                    <Scatter name="Accounts" data={ctrCpcData}>
                      {ctrCpcData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          fillOpacity={0.6}
                          stroke={entry.color}
                          strokeWidth={1.5}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No active accounts found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── PORTFOLIO INTELLIGENCE ENGINE (LIGHT MODE) ── */}
      <Card className="border-slate-200 shadow-sm bg-white text-slate-900 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
        {isAiRefreshing && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}

        <CardHeader className="border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between py-4 bg-slate-50/50 gap-3">
          <CardTitle className="text-lg flex items-center gap-2 font-bold text-slate-800">
            <Sparkles className="h-5 w-5 text-indigo-500" /> Portfolio
            Intelligence Engine
          </CardTitle>

          <div className="flex items-center gap-3">
            {generatedAt && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                <Clock className="h-3 w-3 text-slate-400" /> Report from{" "}
                {formatTimeAgo(generatedAt)}
              </div>
            )}
            <Button
              onClick={() => fetchGodModeAi(true, portfolio)}
              disabled={isAiLoading || isAiRefreshing || !portfolio}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
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
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">
                Scanning portfolio for churn risks, anomalies, and scaling
                opportunities...
              </p>
            </div>
          ) : insights ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-150">
              {/* LEFT COLUMN: Strategic Narratives */}
              <div className="p-6 lg:col-span-1 space-y-6 bg-white">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-indigo-500" /> Macro
                    Summary
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-700 font-medium">
                    {insights?.macro_summary || "No summary available."}
                  </p>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-emerald-500" />{" "}
                    Blended Efficiency
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-700 font-medium">
                    {insights?.blended_efficiency ||
                      "No efficiency data available."}
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: Triage Queue & Growth */}
              <div className="lg:col-span-2 bg-slate-50/20 flex flex-col">
                {/* Triage Queue (Critical Fires as Collapsibles) */}
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Flame className="h-4 w-4 text-red-500" /> Critical Fires
                      Queue
                    </h4>
                    <span className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {insights?.critical_fires?.length || 0} Alerts
                    </span>
                  </div>

                  {!insights?.critical_fires ||
                  insights.critical_fires.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-sm font-medium">
                        Portfolio is stable. No critical fires detected.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights.critical_fires.map((fire: any, i: number) => {
                        const isExpanded = !!expandedFires[i];
                        return (
                          <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-200"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedFires((prev) => ({
                                  ...prev,
                                  [i]: !prev[i],
                                }));
                              }}
                              className="w-full flex justify-between items-center px-5 py-4 hover:bg-slate-50/60 cursor-pointer text-left focus:outline-none"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`transition-transform duration-200 transform ${isExpanded ? "rotate-90" : ""}`}
                                >
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                </span>
                                <span className="font-bold text-base text-slate-900">
                                  {fire?.account_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] tracking-wider uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                                    fire?.severity === "Critical"
                                      ? "bg-red-100 text-red-700 border border-red-200"
                                      : "bg-orange-100 text-orange-700 border border-orange-200"
                                  }`}
                                >
                                  {fire?.severity}
                                </span>
                              </div>
                            </button>

                            <div
                              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                isExpanded
                                  ? "max-h-[800px] border-t border-slate-100"
                                  : "max-h-0"
                              }`}
                            >
                              <div className="p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />{" "}
                                      The Bleed
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                      {fire?.the_problem}
                                    </p>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />{" "}
                                      Action Required
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                      {fire?.recommended_action}
                                    </p>
                                  </div>
                                </div>
                                {renderActionLinks(fire)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Growth Opportunities */}
                <div className="p-6 border-t border-slate-150 bg-slate-50/40">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> Scale
                    Opportunities
                  </h4>

                  {!insights?.growth_opportunities ||
                  insights.growth_opportunities.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No clear scaling opportunities identified in this window.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {insights.growth_opportunities.map(
                        (growth: any, i: number) => (
                          <div
                            key={i}
                            className="bg-white border border-slate-200 shadow-sm rounded-lg p-4"
                          >
                            <h5 className="font-bold text-sm text-emerald-600 mb-1">
                              {growth?.account_name}
                            </h5>
                            <p className="text-xs text-slate-600 leading-relaxed">
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
            <div className="p-12 text-center text-slate-400 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-slate-350" />
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
                      <div className="flex items-center gap-2">
                        <span
                          title={
                            acc.googleStatus === "ENABLED"
                              ? "Status: Active"
                              : acc.googleStatus === "CANCELED"
                                ? "Status: Cancelled"
                                : acc.googleStatus === "SUSPENDED"
                                  ? "Status: Suspended"
                                  : `Status: ${acc.googleStatus}`
                          }
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-help ${
                            acc.googleStatus === "ENABLED"
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                              : acc.googleStatus === "CANCELED"
                                ? "bg-slate-400"
                                : acc.googleStatus === "SUSPENDED"
                                  ? "bg-rose-500 shadow-sm shadow-rose-500/30"
                                  : "bg-amber-500"
                          }`}
                        />
                        <span className="font-semibold text-slate-900">
                          {acc.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 pl-4.5">
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
            Showing{" "}
            <strong className="text-slate-800">
              {searchedAccounts.length > 0
                ? (ledgerPage - 1) * ledgerLimit + 1
                : 0}
            </strong>{" "}
            to{" "}
            <strong className="text-slate-800">
              {Math.min(ledgerPage * ledgerLimit, searchedAccounts.length)}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-800">
              {searchedAccounts.length}
            </strong>{" "}
            accounts
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
