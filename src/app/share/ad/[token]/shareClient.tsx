"use client";

import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  Loader2,
  Lock,
  MousePointerClick,
  Percent,
  Search,
  Target,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  getPublicShareDashboardDataAction,
  verifySharePinAction,
} from "@/actions/share-dashboard.actions";
import { GoogleLogo, MetaLogo } from "@/components/icons/platform-logos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PublicClientDashboardProps {
  token: string;
  initialData: any;
  requiresPin?: boolean;
}

const THEME_STYLES: Record<
  string,
  {
    primary: string;
    stroke: string;
    fill: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  violet: {
    primary: "text-violet-600",
    stroke: "#7c3aed",
    fill: "rgba(124, 58, 237, 0.12)",
    badgeBg: "bg-violet-50 dark:bg-violet-950/40",
    badgeText: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
  },
  ocean: {
    primary: "text-blue-600",
    stroke: "#2563eb",
    fill: "rgba(37, 99, 235, 0.12)",
    badgeBg: "bg-blue-50 dark:bg-blue-950/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  emerald: {
    primary: "text-emerald-600",
    stroke: "#059669",
    fill: "rgba(5, 150, 105, 0.12)",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  amber: {
    primary: "text-amber-600",
    stroke: "#d97706",
    fill: "rgba(217, 119, 6, 0.12)",
    badgeBg: "bg-amber-50 dark:bg-amber-950/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  rose: {
    primary: "text-rose-600",
    stroke: "#e11d48",
    fill: "rgba(225, 29, 72, 0.12)",
    badgeBg: "bg-rose-50 dark:bg-rose-950/40",
    badgeText: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
  slate: {
    primary: "text-slate-700 dark:text-slate-300",
    stroke: "#475569",
    fill: "rgba(71, 85, 105, 0.12)",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-800 dark:text-slate-200",
    border: "border-slate-300 dark:border-slate-700",
  },
};

export function PublicClientDashboard({
  token,
  initialData,
  requiresPin: initialRequiresPin = false,
}: PublicClientDashboardProps) {
  // PIN lock state
  const [isLocked, setIsLocked] = useState(initialRequiresPin);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Main data state
  const [data, setData] = useState<any>(initialData || null);
  const [isLoading, setIsLoading] = useState(false);

  const themeKey = data?.themeColor || "violet";
  const theme = THEME_STYLES[themeKey] || THEME_STYLES.violet;

  // Channel selection
  const allowed = data?.allowedChannels || "all";
  const hasGoogle = Boolean(data?.hasGoogle);
  const hasMeta = Boolean(data?.hasMeta);

  const initialChannel =
    allowed === "google"
      ? "google"
      : allowed === "meta"
        ? "meta"
        : hasGoogle && hasMeta
          ? "blended"
          : hasMeta
            ? "meta"
            : "google";

  const [selectedChannel, setSelectedChannel] = useState<
    "blended" | "google" | "meta"
  >(initialChannel);

  // Date range state
  const today = new Date();
  const [startDate, setStartDate] = useState(
    data?.dateRange?.startDate ||
      new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    data?.dateRange?.endDate ||
      new Date(today.getFullYear(), today.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0],
  );

  // Campaign table state
  const [campaignSearch, setCampaignSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<
    "all" | "google" | "meta"
  >("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Handle PIN verification
  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setIsVerifyingPin(true);
    setPinError(null);

    try {
      const res = await verifySharePinAction(token, pinInput.trim());
      if (res.success && res.valid) {
        setIsLocked(false);
        // Load data with verified PIN
        setIsLoading(true);
        const dataRes = await getPublicShareDashboardDataAction(
          token,
          pinInput.trim(),
          startDate,
          endDate,
        );
        if (dataRes.success && dataRes.data) {
          setData(dataRes.data);
        } else {
          setPinError(dataRes.error || "Failed to load dashboard data.");
        }
        setIsLoading(false);
      } else {
        setPinError("Invalid PIN code. Please try again.");
      }
    } catch {
      setPinError("An error occurred verifying PIN.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Reload data when date range changes
  const handleDateChange = async (range: {
    startDate: string;
    endDate: string;
  }) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setIsLoading(true);
    try {
      const res = await getPublicShareDashboardDataAction(
        token,
        pinInput.trim() || undefined,
        range.startDate,
        range.endDate,
      );
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error("Failed to load metrics for selected dates.");
      }
    } catch {
      toast.error("An error occurred loading metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate Active Totals
  const activeTotals = useMemo(() => {
    const gTotals = data?.googleData?.totals || {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      convRate: 0,
    };
    const mTotals = data?.metaData?.totals || {
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      convRate: 0,
    };

    if (selectedChannel === "google") return gTotals;
    if (selectedChannel === "meta") return mTotals;

    const totalSpend = (gTotals.spend || 0) + (mTotals.spend || 0);
    const totalClicks = (gTotals.clicks || 0) + (mTotals.clicks || 0);
    const totalImpressions =
      (gTotals.impressions || 0) + (mTotals.impressions || 0);
    const totalConversions =
      (gTotals.conversions || 0) + (mTotals.conversions || 0);

    return {
      spend: totalSpend,
      clicks: totalClicks,
      impressions: totalImpressions,
      conversions: totalConversions,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      convRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      googleSpend: gTotals.spend || 0,
      metaSpend: mTotals.spend || 0,
      googleConversions: gTotals.conversions || 0,
      metaConversions: mTotals.conversions || 0,
      googleClicks: gTotals.clicks || 0,
      metaClicks: mTotals.clicks || 0,
      googleImpressions: gTotals.impressions || 0,
      metaImpressions: mTotals.impressions || 0,
    };
  }, [selectedChannel, data?.googleData?.totals, data?.metaData?.totals]);

  // Calculate Time Series
  const activeTimeSeries = useMemo(() => {
    if (selectedChannel === "google") return data?.googleData?.timeSeries || [];
    if (selectedChannel === "meta") return data?.metaData?.timeSeries || [];

    const dateMap = new Map<string, any>();
    for (const d of data?.googleData?.timeSeries || []) {
      dateMap.set(d.date, {
        date: d.date,
        spend: d.spend || 0,
        clicks: d.clicks || 0,
        impressions: d.impressions || 0,
        conversions: d.conversions || 0,
        cpc: d.clicks > 0 ? (d.spend || 0) / d.clicks : 0,
        ctr: d.impressions > 0 ? ((d.clicks || 0) / d.impressions) * 100 : 0,
      });
    }

    for (const d of data?.metaData?.timeSeries || []) {
      const existing = dateMap.get(d.date);
      if (existing) {
        existing.spend += d.spend || 0;
        existing.clicks += d.clicks || 0;
        existing.impressions += d.impressions || 0;
        existing.conversions += d.conversions || 0;
        existing.cpc =
          existing.clicks > 0 ? existing.spend / existing.clicks : 0;
        existing.ctr =
          existing.impressions > 0
            ? (existing.clicks / existing.impressions) * 100
            : 0;
      } else {
        dateMap.set(d.date, {
          date: d.date,
          spend: d.spend || 0,
          clicks: d.clicks || 0,
          impressions: d.impressions || 0,
          conversions: d.conversions || 0,
          cpc: d.clicks > 0 ? (d.spend || 0) / d.clicks : 0,
          ctr: d.impressions > 0 ? ((d.clicks || 0) / d.impressions) * 100 : 0,
        });
      }
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [
    selectedChannel,
    data?.googleData?.timeSeries,
    data?.metaData?.timeSeries,
  ]);

  // Combined Campaigns
  const allCampaigns = useMemo(() => {
    const gList = (data?.googleData?.campaigns || []).map((c: any) => ({
      ...c,
      platform: "google" as const,
    }));
    const mList = (data?.metaData?.campaigns || []).map((c: any) => ({
      ...c,
      platform: "meta" as const,
    }));

    let list: any[] = [];
    if (selectedChannel === "google") list = gList;
    else if (selectedChannel === "meta") list = mList;
    else
      list = [...gList, ...mList].sort(
        (a, b) => (b.spend || 0) - (a.spend || 0),
      );

    if (platformFilter !== "all") {
      list = list.filter((c) => c.platform === platformFilter);
    }
    return list;
  }, [
    selectedChannel,
    platformFilter,
    data?.googleData?.campaigns,
    data?.metaData?.campaigns,
  ]);

  // Filtered Campaigns
  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) =>
      (c.campaignName || "")
        .toLowerCase()
        .includes(campaignSearch.toLowerCase()),
    );
  }, [allCampaigns, campaignSearch]);

  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = filteredCampaigns.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [campaignSearch, platformFilter, selectedChannel]);

  // Formatting helpers
  const fCur = (val: any) => {
    const num = Number(val);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data?.currencyCode || "AUD",
    }).format(isNaN(num) ? 0 : num);
  };
  const fNum = (val: any) => {
    const num = Number(val);
    return new Intl.NumberFormat("en-US").format(isNaN(num) ? 0 : num);
  };
  const fPct = (val: any) => {
    const num = Number(val);
    return `${(isNaN(num) ? 0 : num).toFixed(2)}%`;
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredCampaigns.length === 0) {
      toast.error("No campaigns available to export.");
      return;
    }

    const headers = [
      "Campaign Name",
      "Platform",
      "Cost",
      "Clicks",
      "Impressions",
      "CTR (%)",
      "Avg CPC",
      "Conversions",
      "Cost / Conv (CPA)",
      "Conv Rate (%)",
    ];

    const rows = filteredCampaigns.map((c) => [
      `"${(c.campaignName || "").replace(/"/g, '""')}"`,
      c.platform === "meta" ? "Meta Ads" : "Google Ads",
      Number(c.spend || 0).toFixed(2),
      c.clicks || 0,
      c.impressions || 0,
      Number(c.ctr || 0).toFixed(2),
      Number(c.cpc || 0).toFixed(2),
      c.conversions || 0,
      Number(c.cpa || 0).toFixed(2),
      Number(c.convRate || 0).toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${(data?.clientName || "campaigns").replace(/\s+/g, "_")}_campaign_report.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded successfully!");
  };

  // Visible charts configuration
  const visibleCharts: string[] = data?.visibleCharts || [
    "spend",
    "cpc",
    "ctr",
    "conversions",
  ];

  // 1. PIN Lock Screen
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-between p-6">
        <div className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
              <Image
                src="/up_logo_black.png"
                alt="Uprise Digital Logo"
                width={26}
                height={26}
                className="object-contain dark:hidden"
              />
              <Image
                src="/up_logo_white.png"
                alt="Uprise Digital Logo"
                width={26}
                height={26}
                className="object-contain hidden dark:block"
              />
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">
              Uprise Digital
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Protected Report
          </span>
        </div>

        <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center space-y-6 my-12">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Protected Dashboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please enter the access PIN code provided by your account manager.
            </p>
          </div>

          <form onSubmit={handleUnlockPin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter PIN"
                maxLength={10}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="text-center font-mono tracking-widest text-lg h-11"
              />
              {pinError && (
                <p className="text-xs text-rose-600 font-medium">{pinError}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isVerifyingPin || !pinInput.trim()}
              className="w-full"
            >
              {isVerifyingPin ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Unlock Dashboard
            </Button>
          </form>
        </div>

        <div className="text-center text-xs text-slate-400 pb-4">
          © {new Date().getFullYear()} Uprise Digital. Real-time Marketing
          Intelligence.
        </div>
      </div>
    );
  }

  // 2. Standalone Client Dashboard
  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col justify-between">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Client Name */}
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
              <Image
                src="/up_logo_black.png"
                alt="Uprise Digital Logo"
                width={26}
                height={26}
                className="object-contain dark:hidden"
              />
              <Image
                src="/up_logo_white.png"
                alt="Uprise Digital Logo"
                width={26}
                height={26}
                className="object-contain hidden dark:block"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-500 dark:text-slate-400">
                  Uprise Digital
                </span>
                <span className="text-slate-300 dark:text-slate-700">×</span>
                <h1 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  {data?.clientName || "Client"}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {hasGoogle && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                    <GoogleLogo className="w-3 h-3" />
                    Google Ads Connected
                  </span>
                )}
                {hasMeta && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/40">
                    <MetaLogo className="w-3 h-3" />
                    Meta Ads Connected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Channel switcher + Date Range */}
          <div className="flex flex-wrap items-center gap-2.5">
            {allowed === "all" && hasGoogle && hasMeta && (
              <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedChannel("blended")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    selectedChannel === "blended"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  Blended
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChannel("google")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                    selectedChannel === "google"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <GoogleLogo className="w-3.5 h-3.5" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChannel("meta")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
                    selectedChannel === "meta"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <MetaLogo className="w-3.5 h-3.5" />
                  Meta
                </button>
              </div>
            )}

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateChange}
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1 w-full">
        {/* Loading Overlay Bar */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs text-xs text-muted-foreground animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Updating metrics for selected dates...
          </div>
        )}

        {/* 8 Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Spend */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cost
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div
                className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis"
                title={fCur(activeTotals.spend)}
              >
                {fCur(activeTotals.spend)}
              </div>
              {selectedChannel === "blended" && hasGoogle && hasMeta && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    G: {fCur(activeTotals.googleSpend)}
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    M: {fCur(activeTotals.metaSpend)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clicks */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Clicks
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <MousePointerClick className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {fNum(activeTotals.clicks)}
              </div>
              {selectedChannel === "blended" && hasGoogle && hasMeta && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    G: {fNum(activeTotals.googleClicks)}
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    M: {fNum(activeTotals.metaClicks)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impressions */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Impressions
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <Eye className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {fNum(activeTotals.impressions)}
              </div>
              {selectedChannel === "blended" && hasGoogle && hasMeta && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    G: {fNum(activeTotals.googleImpressions)}
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    M: {fNum(activeTotals.metaImpressions)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTR */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                CTR
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <Percent className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {fPct(activeTotals.ctr)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate whitespace-nowrap">
                Click-Through Rate
              </p>
            </CardContent>
          </Card>

          {/* Conversions */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Conversions
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <Target className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {fNum(activeTotals.conversions)}
              </div>
              {selectedChannel === "blended" && hasGoogle && hasMeta && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    G: {fNum(activeTotals.googleConversions)}
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    M: {fNum(activeTotals.metaConversions)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost / Conv (CPA) */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Cost / Conv
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div
                className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis"
                title={fCur(activeTotals.cpa)}
              >
                {fCur(activeTotals.cpa)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate whitespace-nowrap">
                Acquisition Cost
              </p>
            </CardContent>
          </Card>

          {/* Conv Rate */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Conv Rate
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <Percent className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                {fPct(activeTotals.convRate)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate whitespace-nowrap">
                Conversion Ratio
              </p>
            </CardContent>
          </Card>

          {/* Avg CPC */}
          <Card className="gap-0 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-3 sm:p-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Avg CPC
              </CardTitle>
              <div
                className={`w-7 h-7 rounded-lg ${theme.badgeBg} ${theme.primary} flex items-center justify-center`}
              >
                <DollarSign className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
              <div
                className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis"
                title={fCur(activeTotals.cpc)}
              >
                {fCur(activeTotals.cpc)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 truncate whitespace-nowrap">
                Cost Per Click
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Trend Charts Grid */}
        {visibleCharts.length > 0 && (
          <div
            className={`grid grid-cols-1 ${
              visibleCharts.length >= 2 ? "md:grid-cols-2 lg:grid-cols-3" : ""
            } gap-4`}
          >
            {/* Cost Chart */}
            {visibleCharts.includes("spend") && (
              <Card className="rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Cost Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={activeTimeSeries}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="chartSpendGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={theme.stroke}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor={theme.stroke}
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => `$${val}`}
                        />
                        <RechartsTooltip
                          formatter={(val: any) => [fCur(val), "Cost"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="spend"
                          stroke={theme.stroke}
                          strokeWidth={2}
                          fill="url(#chartSpendGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversions Chart */}
            {visibleCharts.includes("conversions") && (
              <Card className="rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Conversions Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={activeTimeSeries}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="chartConvGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                        />
                        <RechartsTooltip
                          formatter={(val: any) => [fNum(val), "Conversions"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="conversions"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#chartConvGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Avg CPC Chart */}
            {visibleCharts.includes("cpc") && (
              <Card className="rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Avg CPC Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={activeTimeSeries}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="chartCpcGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#6366f1"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#6366f1"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => `$${Number(val).toFixed(2)}`}
                        />
                        <RechartsTooltip
                          formatter={(val: any) => [fCur(val), "Avg CPC"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="cpc"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#chartCpcGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CTR Chart */}
            {visibleCharts.includes("ctr") && (
              <Card className="rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    CTR Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={activeTimeSeries}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="chartCtrGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f59e0b"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f59e0b"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                        />
                        <RechartsTooltip
                          formatter={(val: any) => [fPct(val), "CTR"]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="ctr"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#chartCtrGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Campaign Breakdown Table */}
        <Card className="rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">
                  Campaign Breakdown
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {filteredCampaigns.length}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {selectedChannel === "blended" && hasGoogle && hasMeta && (
                  <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setPlatformFilter("all")}
                      className={`px-2.5 py-1 rounded font-medium ${
                        platformFilter === "all"
                          ? "bg-white dark:bg-slate-900 shadow-xs text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatformFilter("google")}
                      className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 ${
                        platformFilter === "google"
                          ? "bg-white dark:bg-slate-900 shadow-xs text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <GoogleLogo className="w-3 h-3" />
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatformFilter("meta")}
                      className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 ${
                        platformFilter === "meta"
                          ? "bg-white dark:bg-slate-900 shadow-xs text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MetaLogo className="w-3 h-3" />
                      Meta
                    </button>
                  </div>
                )}

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search campaigns..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="h-8 pl-8 text-xs w-[180px] sm:w-[220px]"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-50/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <TableHead className="font-semibold pl-5">
                      Campaign
                    </TableHead>
                    <TableHead className="font-semibold text-center w-[90px]">
                      Platform
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Cost
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Clicks
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Impr.
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      CTR
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      CPC
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Conv.
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      CPA
                    </TableHead>
                    <TableHead className="font-semibold text-right pr-5">
                      Conv. Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="h-28 text-center text-xs text-muted-foreground"
                      >
                        No campaigns found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCampaigns.map((c, i) => (
                      <TableRow
                        key={c.campaignId || i}
                        className="text-xs hover:bg-muted/30"
                      >
                        <TableCell className="font-medium max-w-[280px] truncate pl-5">
                          {c.campaignName}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.platform === "meta" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-normal border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              Meta
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-normal border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Google
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fCur(c.spend)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fNum(c.clicks)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fNum(c.impressions)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fPct(c.ctr)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fCur(c.cpc)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fNum(c.conversions)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fCur(c.cpa)}
                        </TableCell>
                        <TableCell className="text-right pr-5">
                          {fPct(c.convRate)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
                <span>
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, filteredCampaigns.length)} of{" "}
                  {filteredCampaigns.length} campaigns
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 px-2 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="px-2 text-xs font-medium">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 px-2 text-xs"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Standalone Clean Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Powered by Uprise Digital
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span>Real-time Marketing Intelligence</span>
          </div>
          <div>
            © {new Date().getFullYear()} Uprise Digital. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
