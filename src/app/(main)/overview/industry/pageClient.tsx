"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Edit2,
  ExternalLink,
  Eye,
  FolderTree,
  GraduationCap,
  HardHat,
  HeartPulse,
  Home,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShoppingBag,
  Sparkles,
  SunMedium,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Utensils,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import {
  autoClassifyAccountIndustriesAction,
  getIndustryPortfolioMetricsAction,
  type IndustryGroupMetric,
  type IndustryPortfolioData,
  type AccountIndustryMetric,
  updateAccountIndustryAction,
} from "@/actions/industry-analytics.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAllIndustries,
  getIndustryMeta,
  type IndustryKey,
  INDUSTRY_KEYS,
} from "@/lib/industry-config";
import { cn } from "@/lib/utils";

export function IndustryIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  switch (name) {
    case "SunMedium":
      return <SunMedium className={className} />;
    case "Wrench":
      return <Wrench className={className} />;
    case "Scale":
      return <Scale className={className} />;
    case "HeartPulse":
      return <HeartPulse className={className} />;
    case "HardHat":
      return <HardHat className={className} />;
    case "ShoppingBag":
      return <ShoppingBag className={className} />;
    case "Briefcase":
      return <Briefcase className={className} />;
    case "Car":
      return <Car className={className} />;
    case "Home":
      return <Home className={className} />;
    case "GraduationCap":
      return <GraduationCap className={className} />;
    case "Utensils":
      return <Utensils className={className} />;
    default:
      return <FolderTree className={className} />;
  }
}

export default function IndustryAnalyticsClient() {
  const router = useRouter();

  // Date ranges
  const today = new Date();
  const localTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const localMonthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [startDate, setStartDate] = useState(localMonthStartStr);
  const [endDate, setEndDate] = useState(localTodayStr);

  // Data states
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IndustryPortfolioData | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  // Selected vertical for deep dive
  const [selectedVertical, setSelectedVertical] = useState<IndustryKey | "ALL">(
    "ALL",
  );

  // Search & edit state for accounts table
  const [accountSearch, setAccountSearch] = useState("");
  const [editingAccount, setEditingAccount] =
    useState<AccountIndustryMetric | null>(null);
  const [editIndustry, setEditIndustry] = useState<IndustryKey>("OTHER");
  const [editSubNiche, setEditSubNiche] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Formatters
  const fCur = (v: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(isNaN(v) ? 0 : v);
  const fNum = (v: number) =>
    new Intl.NumberFormat("en-AU").format(isNaN(v) ? 0 : v);
  const fPct = (v: number) => `${(isNaN(v) ? 0 : v).toFixed(1)}%`;

  // Fetch portfolio data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIndustryPortfolioMetricsAction(startDate, endDate);
      if (res.success && res.data) {
        setData(res.data);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load industry metrics.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // AI Auto-Classification Handler
  const handleAutoClassify = async (forceAll: boolean = false) => {
    setIsClassifying(true);
    const toastId = toast.loading(
      forceAll
        ? "Re-classifying all accounts using AI..."
        : "Classifying unassigned accounts with AI...",
    );
    try {
      const res = await autoClassifyAccountIndustriesAction(forceAll);
      if (res.success) {
        toast.success(res.message || "Accounts classified successfully!", {
          id: toastId,
        });
        await fetchData();
      } else {
        toast.error(res.error || "Failed to classify accounts.", {
          id: toastId,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsClassifying(false);
    }
  };

  // Manual Account Edit Handler
  const handleSaveAccountIndustry = async () => {
    if (!editingAccount) return;
    setIsSavingEdit(true);
    try {
      const res = await updateAccountIndustryAction(
        editingAccount.accountId,
        editIndustry,
        editSubNiche,
      );
      if (res.success) {
        toast.success(`Updated ${editingAccount.name} industry.`);
        setEditingAccount(null);
        await fetchData();
      } else {
        toast.error(res.error || "Failed to update industry.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save changes.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Derived KPIs
  const topSpendingGroup = useMemo(() => {
    if (!data?.industryGroups?.length) return null;
    return [...data.industryGroups].sort((a, b) => b.spend - a.spend)[0];
  }, [data]);

  const bestEfficiencyGroup = useMemo(() => {
    if (!data?.industryGroups?.length) return null;
    const activeWithConv = data.industryGroups.filter(
      (g) => g.conversions >= 3 && g.blendedCpa > 0,
    );
    if (activeWithConv.length === 0) return null;
    return [...activeWithConv].sort((a, b) => a.blendedCpa - b.blendedCpa)[0];
  }, [data]);

  // Donut chart dataset
  const pieData = useMemo(() => {
    if (!data?.industryGroups) return [];
    return data.industryGroups
      .filter((g) => g.spend > 0)
      .map((g) => ({
        name: g.shortLabel,
        value: g.spend,
        color: g.color,
        key: g.industry,
      }));
  }, [data]);

  // Selected vertical deep dive group
  const activeSelectedGroup = useMemo(() => {
    if (selectedVertical === "ALL" || !data?.industryGroups) return null;
    return (
      data.industryGroups.find((g) => g.industry === selectedVertical) || null
    );
  }, [data, selectedVertical]);

  // Filtered accounts for management table
  const filteredAccounts = useMemo(() => {
    if (!data?.allAccounts) return [];
    return data.allAccounts.filter((acc) => {
      const matchesSearch =
        !accountSearch ||
        acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
        acc.googleAccountId.includes(accountSearch) ||
        (acc.subNiche &&
          acc.subNiche.toLowerCase().includes(accountSearch.toLowerCase()));
      const matchesVertical =
        selectedVertical === "ALL" || acc.industry === selectedVertical;
      return matchesSearch && matchesVertical;
    });
  }, [data, accountSearch, selectedVertical]);

  if (loading && !data) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium text-slate-500">
          Calculating industry portfolio benchmarks...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* ── 1. HEADER & CONTROLS ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
              Overview / Analytics
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Building2 className="h-7 w-7 text-indigo-600" /> Industry &
            Vertical Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cross-client macro benchmarks, vertical market share, and
            intra-industry peer efficiency rankings.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={() => handleAutoClassify(false)}
            disabled={isClassifying || loading}
            variant="outline"
            className="w-full sm:w-auto bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm"
          >
            {isClassifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-indigo-600" />
                Classifying...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-indigo-600" />{" "}
                Auto-Classify with AI
              </>
            )}
          </Button>

          <Button
            onClick={fetchData}
            disabled={loading}
            variant="outline"
            size="icon"
            className="hidden sm:flex bg-white shrink-0 text-slate-600 hover:text-slate-900"
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                loading && "animate-spin text-indigo-600",
              )}
            />
          </Button>

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate: s, endDate: e }) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
        </div>
      </div>

      {/* ── 2. MACRO KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Verticals */}
        <Card className="py-0 m-0 shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Active Sectors
              </p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-slate-900">
                  {data?.agencyTotals?.activeIndustriesCount || 0}
                </p>
                <span className="text-xs text-slate-400 font-semibold">
                  / {INDUSTRY_KEYS.length} Total
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
              <Layers className="h-4 w-4 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Top Spending Industry */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 truncate">
                Top Spend Sector
              </p>
              <p className="text-base font-black text-slate-900 truncate">
                {topSpendingGroup ? topSpendingGroup.shortLabel : "N/A"}
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                {topSpendingGroup ? fCur(topSpendingGroup.spend) : "$0.00"} (
                {topSpendingGroup ? fPct(topSpendingGroup.spendSharePct) : "0%"}
                )
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Best Efficiency (Lowest CPA) */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-emerald-500 bg-emerald-50/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 truncate">
                Lowest CPA Sector
              </p>
              <p className="text-base font-black text-emerald-900 truncate">
                {bestEfficiencyGroup ? bestEfficiencyGroup.shortLabel : "N/A"}
              </p>
              <p className="text-[11px] font-bold text-emerald-700">
                {bestEfficiencyGroup
                  ? `${fCur(bestEfficiencyGroup.blendedCpa)} avg CPA`
                  : "N/A"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100 shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Blended Agency CPA */}
        <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-2 border-l-amber-500 bg-amber-50/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Blended Agency CPA
              </p>
              <p className="text-xl font-black text-amber-900">
                {fCur(data?.agencyTotals?.blendedCpa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">
                {fNum(data?.agencyTotals?.totalConversions || 0)} Total Leads
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100 shrink-0">
              <Target className="h-4 w-4 text-amber-700" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. SECTOR BREAKDOWN & MARKET SHARE ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-indigo-500" /> Vertical Benchmarks
          & Market Share
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Donut Chart: Spend Distribution */}
          <Card className="border-slate-200 shadow-sm bg-white lg:col-span-1 flex flex-col justify-between">
            <CardHeader className="py-3.5 px-5 border-b border-slate-100 bg-slate-50/30">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>Spend Share by Sector</span>
                <span className="text-xs font-bold text-slate-400">
                  {fCur(data?.agencyTotals?.totalSpend || 0)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-6 flex-1 flex flex-col items-center justify-center">
              {pieData.length > 0 ? (
                <div className="w-full h-64 flex flex-col items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0];
                            const total = data?.agencyTotals?.totalSpend || 1;
                            const pct = (
                              (Number(p.value) / total) *
                              100
                            ).toFixed(1);
                            return (
                              <div className="bg-white p-2.5 border border-slate-200 shadow-lg rounded-lg text-xs">
                                <p className="font-bold text-slate-900">
                                  {p.name}
                                </p>
                                <p className="text-slate-600 mt-0.5">
                                  Spend:{" "}
                                  <span className="font-bold text-slate-900">
                                    {fCur(Number(p.value))}
                                  </span>{" "}
                                  ({pct}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-w-[280px]">
                    {pieData.map((entry) => (
                      <button
                        key={entry.key}
                        onClick={() =>
                          setSelectedVertical(entry.key as IndustryKey)
                        }
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                          selectedVertical === entry.key
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate max-w-[90px]">
                          {entry.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 py-12">
                  No active spend found for selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benchmarks Comparison Table */}
          <Card className="border-slate-200 shadow-sm bg-white lg:col-span-2 flex flex-col justify-between">
            <CardHeader className="py-3.5 px-5 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" /> Sector
                  Benchmark Scorecard
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-400 mt-0.5">
                  Click any sector row to drill into its peer accounts
                  leaderboard
                </CardDescription>
              </div>
              {selectedVertical !== "ALL" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedVertical("ALL")}
                  className="text-xs text-indigo-600 hover:text-indigo-700 h-7 px-2.5 font-bold"
                >
                  Clear Filter (Show All)
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 pl-5">
                      Sector
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-center">
                      Accounts
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right">
                      Spend
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right">
                      Leads
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right">
                      Blended CPA
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right">
                      Avg CPC
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right">
                      Conv. Rate
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-2.5 text-right pr-5">
                      Share
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.industryGroups
                    ?.filter((g) => g.accountsCount > 0)
                    .map((group) => {
                      const isSelected = selectedVertical === group.industry;
                      return (
                        <TableRow
                          key={group.industry}
                          onClick={() =>
                            setSelectedVertical(
                              isSelected ? "ALL" : group.industry,
                            )
                          }
                          className={cn(
                            "cursor-pointer transition-colors border-b border-slate-100",
                            isSelected
                              ? "bg-indigo-50/70 hover:bg-indigo-50 font-semibold"
                              : "hover:bg-slate-50/80",
                          )}
                        >
                          <TableCell className="py-3 pl-5">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "p-1.5 rounded-lg border shrink-0",
                                  group.bgBadge,
                                  group.textBadge,
                                  group.borderBadge,
                                )}
                              >
                                <IndustryIcon
                                  name={group.iconName}
                                  className="h-3.5 w-3.5"
                                />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 leading-tight">
                                  {group.label}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                  {group.subNiches.slice(0, 3).join(", ")}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center text-xs font-bold text-slate-700">
                            {group.activeAccountsCount}
                            <span className="text-slate-400 font-normal">
                              /{group.accountsCount}
                            </span>
                          </TableCell>

                          <TableCell className="text-right text-xs font-bold text-slate-900">
                            {fCur(group.spend)}
                          </TableCell>

                          <TableCell className="text-right text-xs font-bold text-slate-800">
                            {fNum(group.conversions)}
                          </TableCell>

                          <TableCell className="text-right text-xs font-extrabold text-indigo-700">
                            {group.conversions > 0
                              ? fCur(group.blendedCpa)
                              : "—"}
                          </TableCell>

                          <TableCell className="text-right text-xs text-slate-600 font-medium">
                            {group.clicks > 0 ? fCur(group.blendedCpc) : "—"}
                          </TableCell>

                          <TableCell className="text-right text-xs text-slate-600 font-medium">
                            {group.clicks > 0
                              ? fPct(group.blendedConvRate)
                              : "—"}
                          </TableCell>

                          <TableCell className="text-right text-xs font-bold text-slate-500 pr-5">
                            {fPct(group.spendSharePct)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                  {(!data?.industryGroups ||
                    data.industryGroups.filter((g) => g.accountsCount > 0)
                      .length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-xs text-slate-400"
                      >
                        No accounts assigned yet. Click "Auto-Classify with AI"
                        above to automatically tag accounts.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 4. PEER BENCHMARK LEADERBOARD (APEX VS. LAGGING) ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" /> Intra-Industry
              Peer Rankings & Efficiency
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedVertical === "ALL"
                ? "Showing all accounts across every industry. Select a vertical above to focus on a peer group."
                : `Focusing on ${activeSelectedGroup?.label || selectedVertical} accounts compared against the sector average.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filter accounts / sub-niches..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="text-xs pl-8 h-8 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Selected Sector Focus Banner */}
        {activeSelectedGroup && (
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl border bg-white/10 text-white border-white/20 shrink-0",
                )}
              >
                <IndustryIcon
                  name={activeSelectedGroup.iconName}
                  className="h-5 w-5"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white">
                    {activeSelectedGroup.label}
                  </h4>
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-[10px]">
                    {activeSelectedGroup.accountsCount} Accounts
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeSelectedGroup.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Sector Benchmark CPA
                </p>
                <p className="text-lg font-black text-indigo-400">
                  {fCur(activeSelectedGroup.blendedCpa)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Avg CPC
                </p>
                <p className="text-lg font-black text-slate-200">
                  {fCur(activeSelectedGroup.blendedCpc)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Avg Conv Rate
                </p>
                <p className="text-lg font-black text-emerald-400">
                  {fPct(activeSelectedGroup.blendedConvRate)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Peer Leaderboard Table */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 pl-5">
                    Account
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3">
                    Industry / Sub-Niche
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-center">
                    Peer Status
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-right">
                    Spend
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-right">
                    Leads
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-right">
                    Actual CPA
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-right">
                    Target CPA
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-right">
                    vs Sector Avg
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 py-3 text-center pr-5">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((acc) => {
                  const meta = getIndustryMeta(acc.industry);

                  return (
                    <TableRow
                      key={acc.accountId}
                      className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                    >
                      {/* Account Name */}
                      <TableCell className="py-3 pl-5">
                        <div>
                          <Link
                            href={`/accounts/${acc.accountId}`}
                            className="text-xs font-bold text-slate-900 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                          >
                            <span>{acc.name}</span>
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                          </Link>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {acc.googleAccountId}
                          </p>
                        </div>
                      </TableCell>

                      {/* Industry & Sub-niche */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                              meta.bgBadge,
                              meta.textBadge,
                              meta.borderBadge,
                            )}
                          >
                            <IndustryIcon
                              name={meta.iconName}
                              className="w-3 h-3"
                            />
                            {meta.shortLabel}
                          </span>
                          {acc.subNiche && (
                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {acc.subNiche}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Peer Efficiency Status */}
                      <TableCell className="text-center py-3">
                        {acc.efficiencyStatus === "APEX" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-extrabold">
                            <Sparkles className="w-3 h-3 mr-1 text-emerald-600" />
                            Apex Performer
                          </Badge>
                        )}
                        {acc.efficiencyStatus === "HEALTHY" && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold">
                            Healthy Peer
                          </Badge>
                        )}
                        {acc.efficiencyStatus === "LAGGING" && (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-extrabold">
                            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                            Underperforming
                          </Badge>
                        )}
                        {acc.efficiencyStatus === "INACTIVE" && (
                          <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      {/* Spend */}
                      <TableCell className="text-right text-xs font-bold text-slate-900 py-3">
                        {fCur(acc.spend)}
                      </TableCell>

                      {/* Leads */}
                      <TableCell className="text-right text-xs font-bold text-slate-800 py-3">
                        {fNum(acc.conversions)}
                      </TableCell>

                      {/* Actual CPA */}
                      <TableCell className="text-right text-xs font-extrabold text-slate-900 py-3">
                        {acc.conversions > 0 ? fCur(acc.cpa) : "—"}
                      </TableCell>

                      {/* Target CPA */}
                      <TableCell className="text-right text-xs font-medium text-slate-500 py-3">
                        {acc.targetCpa > 0 ? fCur(acc.targetCpa) : "Not set"}
                      </TableCell>

                      {/* vs Sector Delta */}
                      <TableCell className="text-right text-xs font-bold py-3">
                        {acc.spend > 0 &&
                        acc.cpa > 0 &&
                        acc.cpaDeltaVsSector !== 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5",
                              acc.cpaDeltaVsSector < 0
                                ? "text-emerald-600"
                                : "text-rose-600",
                            )}
                          >
                            {acc.cpaDeltaVsSector < 0 ? (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            {Math.abs(acc.cpaDeltaVsSector).toFixed(1)}%{" "}
                            {acc.cpaDeltaVsSector < 0 ? "cheaper" : "higher"}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center py-3 pr-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingAccount(acc);
                              setEditIndustry(acc.industry);
                              setEditSubNiche(acc.subNiche || "");
                            }}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Industry Tag"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View Account Details"
                          >
                            <Link href={`/accounts/${acc.accountId}`}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredAccounts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-10 text-xs text-slate-400"
                    >
                      No accounts match the current filter criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. EDIT INDUSTRY DIALOG ── */}
      <Dialog
        open={Boolean(editingAccount)}
        onOpenChange={(open) => !open && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Assign Industry / Vertical
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set the canonical industry cohort and sub-niche for{" "}
              <span className="font-bold text-slate-800">
                {editingAccount?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Canonical Industry
              </Label>
              <Select
                value={editIndustry}
                onValueChange={(val) => setEditIndustry(val as IndustryKey)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent className="z-[110] bg-white">
                  {getAllIndustries().map((ind) => (
                    <SelectItem
                      key={ind.key}
                      value={ind.key}
                      className="text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <IndustryIcon
                          name={ind.iconName}
                          className="w-3.5 h-3.5 text-indigo-600"
                        />
                        <span>{ind.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Sub-Niche / Speciality
              </Label>
              <Input
                placeholder="e.g. Emergency Plumbing, Family Law, Cosmetic Dental"
                value={editSubNiche}
                onChange={(e) => setEditSubNiche(e.target.value)}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-400">
                Suggestions:{" "}
                {getIndustryMeta(editIndustry).subNiches.join(", ")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingAccount(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAccountIndustry}
              disabled={isSavingEdit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Assignment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
