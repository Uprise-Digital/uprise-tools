// app/accounts/pageClient.tsx
"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { getAgencyPortfolioMetricsAction } from "@/actions/agency.actions";
import {
  getMetaAccountsPerformanceAction,
  syncMetaAdAccountsAction,
} from "@/actions/meta-settings.actions";
import { ReportAutomationTrigger } from "@/components/reportAutomationTrigger";
import { SyncButton } from "@/components/sync-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { UnifiedAccountRow } from "@/lib/account-unification";
import { getAllIndustries, getIndustryMeta } from "@/lib/industry-config";

interface AccountsClientPageProps {
  accounts: UnifiedAccountRow[];
}

export default function AccountsClientPage({
  accounts,
}: AccountsClientPageProps) {
  const router = useRouter();

  // 1. Date Range State (defaults to rolling 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  // 2. Performance Metrics State
  const [portfolio, setPortfolio] = useState<any>(null);
  const [metaMetricsMap, setMetaMetricsMap] = useState<Record<string, any>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // 3. Platform & Channel Drill-Down State
  const [platformFilter, setPlatformFilter] = useState<
    "all" | "google" | "meta"
  >("all");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // 4. Search and Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [googleStatusFilter, setGoogleStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");

  // 5. Sort State
  const [sortColumn, setSortColumn] = useState<string>("spend"); // default sort by highest spend
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 6. Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Safe formatting helpers
  const fCur = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return "A$0.00";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(num);
  };

  const fPct = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return "0.00%";
    return `${num.toFixed(2)}%`;
  };

  const fNum = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return "0";
    return new Intl.NumberFormat("en-AU").format(num);
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

  // Load Performance Metrics Client-Side (both Google Ads & Meta Ads)
  useEffect(() => {
    let isMounted = true;
    setLoadingMetrics(true);

    Promise.all([
      getAgencyPortfolioMetricsAction(startDate, endDate),
      getMetaAccountsPerformanceAction(startDate, endDate),
    ])
      .then(([googleRes, metaRes]) => {
        if (!isMounted) return;

        if (googleRes.success) {
          setPortfolio(googleRes.data);
        }

        if (metaRes.success && Array.isArray(metaRes.breakdown)) {
          const map: Record<string, any> = {};
          for (const m of metaRes.breakdown) {
            map[m.metaAccountId] = m;
          }
          setMetaMetricsMap(map);
        }
      })
      .catch((e) => {
        console.error("Failed to load portfolio metrics:", e);
      })
      .finally(() => {
        if (isMounted) setLoadingMetrics(false);
      });

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  // Combine unified accounts with performance metrics
  const combinedAccounts = accounts.map((acc) => {
    // Look up Google metrics if present
    const gMetrics = acc.googleAccountId
      ? portfolio?.accountBreakdown?.find(
          (m: any) => m.googleAccountId === acc.googleAccountId,
        )
      : null;

    const gSpend = gMetrics ? Number(gMetrics.spend || 0) : 0;
    const gConversions = gMetrics ? Number(gMetrics.conversions || 0) : 0;
    const gCpa = gMetrics ? Number(gMetrics.cpa || 0) : 0;
    const gCtr = gMetrics ? Number(gMetrics.ctr || 0) : 0;
    const gCpc = gMetrics ? Number(gMetrics.cpc || 0) : 0;
    const gClicks = gMetrics ? Number(gMetrics.clicks || 0) : 0;
    const gImpressions = gMetrics ? Number(gMetrics.impressions || 0) : 0;

    // Look up live Meta metrics if present
    const mMetrics = acc.metaAccountId
      ? metaMetricsMap[acc.metaAccountId]
      : null;

    const mSpend = mMetrics ? Number(mMetrics.spend || 0) : 0;
    const mConversions = mMetrics ? Number(mMetrics.conversions || 0) : 0;
    const mClicks = mMetrics ? Number(mMetrics.clicks || 0) : 0;
    const mImpressions = mMetrics ? Number(mMetrics.impressions || 0) : 0;
    const mCpa = mConversions > 0 ? mSpend / mConversions : 0;
    const mCtr = mImpressions > 0 ? (mClicks / mImpressions) * 100 : 0;
    const mCpc = mClicks > 0 ? mSpend / mClicks : 0;

    // Determine metrics based on active platformFilter
    let spend = 0;
    let conversions = 0;
    let clicks = 0;
    let impressions = 0;
    let cpa = 0;
    let ctr = 0;
    let cpc = 0;

    if (platformFilter === "google") {
      spend = gSpend;
      conversions = gConversions;
      clicks = gClicks;
      impressions = gImpressions;
      cpa = gCpa;
      ctr = gCtr;
      cpc = gCpc;
    } else if (platformFilter === "meta") {
      spend = mSpend;
      conversions = mConversions;
      clicks = mClicks;
      impressions = mImpressions;
      cpa = mCpa;
      ctr = mCtr;
      cpc = mCpc;
    } else {
      // Blended calculations
      spend = gSpend + mSpend;
      conversions = gConversions + mConversions;
      clicks = gClicks + mClicks;
      impressions = gImpressions + mImpressions;
      cpa = conversions > 0 ? spend / conversions : gSpend > 0 ? gCpa : mCpa;
      ctr =
        impressions > 0
          ? (clicks / impressions) * 100
          : gImpressions > 0
            ? gCtr
            : mCtr;
      cpc = clicks > 0 ? spend / clicks : gClicks > 0 ? gCpc : mCpc;
    }

    const baselineCpa = portfolio?.agencyTotals?.cpa || 0;
    const risk = getChurnRisk(
      { spend, conversions, cpa, ctr, cpc },
      baselineCpa,
    );

    return {
      ...acc,
      spend,
      conversions,
      cpa,
      ctr,
      cpc,
      churnRisk: risk,
      channelBreakdown: {
        google: acc.googleAccountId
          ? {
              spend: gSpend,
              conversions: gConversions,
              cpa: gCpa,
              ctr: gCtr,
              cpc: gCpc,
              clicks: gClicks,
              impressions: gImpressions,
            }
          : null,
        meta: acc.metaAccountId
          ? {
              spend: mSpend,
              conversions: mConversions,
              cpa: mCpa,
              ctr: mCtr,
              cpc: mCpc,
              clicks: mClicks,
              impressions: mImpressions,
            }
          : null,
      },
    };
  });

  // Sorting handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      const descDefaults = ["spend", "conversions", "cpa", "ctr", "cpc"];
      setSortDirection(descDefaults.includes(column) ? "desc" : "asc");
    }
  };

  // Perform Client-Side Sorting
  const sortedAccounts = [...combinedAccounts].sort((a: any, b: any) => {
    let aVal: any;
    let bVal: any;

    switch (sortColumn) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "churnRisk":
        aVal = a.churnRisk.label.toLowerCase();
        bVal = b.churnRisk.label.toLowerCase();
        break;
      case "spend":
        aVal = a.spend;
        bVal = b.spend;
        break;
      case "conversions":
        aVal = a.conversions;
        bVal = b.conversions;
        break;
      case "cpa":
        aVal = a.cpa;
        bVal = b.cpa;
        break;
      case "ctr":
        aVal = a.ctr;
        bVal = b.ctr;
        break;
      case "cpc":
        aVal = a.cpc;
        bVal = b.cpc;
        break;
      case "isActive":
        aVal = a.isActive ? 1 : 0;
        bVal = b.isActive ? 1 : 0;
        break;
      default:
        aVal = a.key;
        bVal = b.key;
    }

    if (aVal === bVal) return 0;
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  // Perform Client-Side Filtering
  const filteredAccounts = sortedAccounts.filter((acc) => {
    // 1. Platform Filter
    if (platformFilter === "google" && !acc.platforms.includes("google")) {
      return false;
    }
    if (platformFilter === "meta" && !acc.platforms.includes("meta")) {
      return false;
    }

    // 2. Search
    const matchesSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.googleAccountId?.includes(search) ||
      acc.metaAccountId?.includes(search);

    // 3. Status
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && acc.isActive) ||
      (statusFilter === "inactive" && !acc.isActive);

    // 4. Churn Risk
    const matchesRisk =
      riskFilter === "all" ||
      acc.churnRisk.label.toLowerCase() === riskFilter.toLowerCase();

    // 5. Google Ads Status
    const matchesGoogleStatus =
      googleStatusFilter === "all" ||
      (acc.googleStatus &&
        acc.googleStatus.toLowerCase() === googleStatusFilter.toLowerCase());

    // 6. Industry
    const matchesIndustry =
      industryFilter === "all" || (acc.industry || "OTHER") === industryFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesRisk &&
      matchesGoogleStatus &&
      matchesIndustry
    );
  });

  const totalPages = Math.ceil(filteredAccounts.length / limit);
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * limit,
    page * limit,
  );

  useEffect(() => {
    setPage(1);
  }, []);

  const toggleRowExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const exportClientsToCsv = () => {
    const headers = [
      "Account Name",
      "Platforms",
      "Google ID",
      "Meta ID",
      "Churn Risk",
      "Spend",
      "Conversions",
      platformFilter === "google"
        ? "Google CPA"
        : platformFilter === "meta"
          ? "Meta CPA"
          : "Blended CPA",
      "CTR",
      "CPC",
      "Status",
      "Google Status",
    ];
    const rows = filteredAccounts.map((acc) => [
      acc.name,
      acc.platforms.join(" + "),
      acc.googleAccountId || "",
      acc.metaAccountId ? `act_${acc.metaAccountId}` : "",
      acc.churnRisk.label,
      fCur(acc.spend),
      fNum(acc.conversions),
      fCur(acc.cpa),
      fPct(acc.ctr),
      fCur(acc.cpc),
      acc.isActive ? "Active" : "Inactive",
      acc.googleStatus || "N/A",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) =>
          e
            .map((val) => {
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
      `connected_clients_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Clients ledger exported successfully.");
  };

  const handleRowClick = (acc: any) => {
    if (platformFilter === "meta") {
      if (acc.metaAccountId) {
        window.open(
          `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc.metaAccountId}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
      return;
    }

    if (platformFilter === "google") {
      if (acc.googleId) {
        router.push(`/accounts/${acc.googleId}`);
      }
      return;
    }

    // Default 'all' platform behavior
    if (acc.googleId) {
      router.push(`/accounts/${acc.googleId}`);
    } else if (acc.metaAccountId) {
      window.open(
        `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc.metaAccountId}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  // Sort indicator helper for column headers
  const renderSortIndicator = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-slate-900 font-bold" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-slate-900 font-bold" />
    );
  };

  return (
    <div className="space-y-6 mt-0 pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Unified cross-platform ledger across Google Ads and Meta Ads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={exportClientsToCsv}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-slate-200 h-9"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          {/* Sync Dropdown / Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <SyncButton action={syncAdAccountsAction} />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const res = await syncMetaAdAccountsAction();
                if (res.success) {
                  toast.success(
                    `Synced ${res.syncedAccountsCount ?? 0} Meta accounts`,
                  );
                } else {
                  toast.error("Meta sync failed");
                }
              }}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white h-8 px-2.5"
            >
              Sync Meta
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-100 bg-slate-50/50 py-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-800">
                Connected Clients
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[11px] font-semibold bg-white text-slate-600"
              >
                {filteredAccounts.length} Total
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {platformFilter === "google"
                ? "Google Ads performance and account health monitoring."
                : platformFilter === "meta"
                  ? "Meta Ads performance and account health monitoring."
                  : "Blended cross-platform performance and individual channel health monitoring."}
            </CardDescription>
          </div>

          {/* TOP PLATFORM TOGGLE TABS */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setPlatformFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                platformFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Platforms
            </button>
            <button
              type="button"
              onClick={() => {
                setPlatformFilter("google");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                platformFilter === "google"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Google Ads
            </button>
            <button
              type="button"
              onClick={() => {
                setPlatformFilter("meta");
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                platformFilter === "meta"
                  ? "bg-white text-sky-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Meta Ads
            </button>
          </div>
        </CardHeader>

        {/* SHADCN-STYLE FILTER BAR */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/30 p-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search clients, Google ID or act_... ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 text-xs h-9 bg-white border-slate-200"
            />
          </div>

          {/* Date Picker */}
          <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-none px-3 py-1.5 gap-2 h-9 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="border-none h-6 w-[100px] p-0 text-xs focus-visible:ring-0 shadow-none [color-scheme:light] bg-transparent"
            />
            <span className="text-slate-300 font-light">—</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="border-none h-6 w-[100px] p-0 text-xs focus-visible:ring-0 shadow-none [color-scheme:light] bg-transparent"
            />
          </div>

          {/* Status Filter Select */}
          <div className="w-[130px]">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Churn Risk Filter Select */}
          <div className="w-[140px]">
            <Select
              value={riskFilter}
              onValueChange={(val) => {
                setRiskFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                <SelectValue placeholder="Churn Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high risk">High Risk</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Google Ads Status Select */}
          <div className="w-[160px]">
            <Select
              value={googleStatusFilter}
              onValueChange={(val) => {
                setGoogleStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                <SelectValue placeholder="Google Ads Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Google Statuses</SelectItem>
                <SelectItem value="enabled">Active (ENABLED)</SelectItem>
                <SelectItem value="canceled">Cancelled</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="delinked">Delinked / Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Industry Filter Select */}
          <div className="w-[160px]">
            <Select
              value={industryFilter}
              onValueChange={(val) => {
                setIndustryFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent className="z-[110] bg-white">
                <SelectItem value="all">All Industries</SelectItem>
                {getAllIndustries().map((ind) => (
                  <SelectItem key={ind.key} value={ind.key} className="text-xs">
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {(search ||
            platformFilter !== "all" ||
            statusFilter !== "all" ||
            riskFilter !== "all" ||
            googleStatusFilter !== "all" ||
            industryFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setPlatformFilter("all");
                setStatusFilter("all");
                setRiskFilter("all");
                setGoogleStatusFilter("all");
                setIndustryFilter("all");
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-900 h-9 px-3"
            >
              Reset Filters
            </Button>
          )}
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-8 pl-4 pr-0" />
                <TableHead className="font-bold pl-2">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none"
                  >
                    Client Account {renderSortIndicator("name")}
                  </button>
                </TableHead>
                <TableHead className="font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort("churnRisk")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none"
                  >
                    Churn Risk {renderSortIndicator("churnRisk")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("spend")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none ml-auto"
                  >
                    Spend {renderSortIndicator("spend")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("conversions")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none ml-auto"
                  >
                    Conv. {renderSortIndicator("conversions")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("cpa")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none ml-auto"
                  >
                    {platformFilter === "google"
                      ? "Google CPA"
                      : platformFilter === "meta"
                        ? "Meta CPA"
                        : "Blended CPA"}{" "}
                    {renderSortIndicator("cpa")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("ctr")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none ml-auto"
                  >
                    CTR {renderSortIndicator("ctr")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("cpc")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none ml-auto"
                  >
                    CPC {renderSortIndicator("cpc")}
                  </button>
                </TableHead>
                <TableHead className="font-bold">
                  <button
                    type="button"
                    onClick={() => handleSort("isActive")}
                    className="flex items-center hover:text-slate-900 font-bold focus:outline-none"
                  >
                    Status {renderSortIndicator("isActive")}
                  </button>
                </TableHead>
                <TableHead className="text-right font-bold pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody
              className={
                loadingMetrics
                  ? "opacity-60 transition-opacity"
                  : "transition-opacity"
              }
            >
              {loadingMetrics && !portfolio ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-32 text-center text-xs text-slate-500 font-sans"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      <span>Loading unified cross-platform ledger...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((acc) => {
                  const isBlended =
                    platformFilter === "all" && acc.platforms.length > 1;
                  const isExpanded = isBlended && expandedKeys.has(acc.key);

                  return (
                    <>
                      <TableRow
                        key={acc.key}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                        onClick={() => handleRowClick(acc)}
                      >
                        {/* EXPAND TOGGLE (For Blended Multi-channel rows in All Platforms view) */}
                        <TableCell className="w-8 pl-4 pr-0 py-4">
                          {isBlended ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpanded(acc.key);
                              }}
                              className="p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors"
                              title="Toggle Channel Breakdown"
                            >
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isExpanded ? "transform rotate-180" : ""
                                }`}
                              />
                            </button>
                          ) : null}
                        </TableCell>

                        {/* CLIENT ACCOUNT */}
                        <TableCell className="font-semibold text-slate-900 pl-2 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {/* Status dot */}
                              <span
                                title={
                                  platformFilter === "meta"
                                    ? acc.metaAccountStatus === 1
                                      ? "Meta Ads: Active"
                                      : "Meta Ads: Inactive"
                                    : acc.googleStatus === "ENABLED"
                                      ? "Google Ads: Active"
                                      : acc.googleStatus === "CANCELED"
                                        ? "Google Ads: Cancelled"
                                        : acc.googleStatus === "SUSPENDED"
                                          ? "Google Ads: Suspended"
                                          : acc.googleStatus === "DELINKED"
                                            ? "Google Ads: Delinked / Archived"
                                            : acc.isActive
                                              ? "Active Account"
                                              : "Inactive Account"
                                }
                                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-help ${
                                  platformFilter === "meta"
                                    ? acc.metaAccountStatus === 1
                                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                                      : "bg-slate-400"
                                    : acc.googleStatus === "ENABLED" ||
                                        (!acc.googleStatus && acc.isActive)
                                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                                      : acc.googleStatus === "CANCELED" ||
                                          acc.googleStatus === "DELINKED"
                                        ? "bg-slate-400"
                                        : acc.googleStatus === "SUSPENDED"
                                          ? "bg-rose-500 shadow-sm shadow-rose-500/30"
                                          : "bg-amber-500"
                                }`}
                              />
                              <span className="text-sm font-semibold text-slate-900">
                                {acc.name}
                              </span>

                              {/* Multi-channel Blended badge (only in All Platforms view) */}
                              {isBlended && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                                  <Layers className="w-2.5 h-2.5" />
                                  Blended
                                </span>
                              )}
                            </div>

                            {/* IDs and Platform badges */}
                            <div className="flex flex-wrap items-center gap-2 pl-4.5 mt-1">
                              {/* Google Badge (hidden if filtered to Meta) */}
                              {platformFilter !== "meta" &&
                                acc.googleAccountId && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                                    <span className="font-semibold text-[9px]">
                                      G
                                    </span>
                                    {acc.googleAccountId}
                                  </span>
                                )}

                              {/* Meta Badge (hidden if filtered to Google) */}
                              {platformFilter !== "google" &&
                                acc.metaAccountId && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.2 rounded">
                                    <span className="font-semibold text-[9px]">
                                      Meta
                                    </span>
                                    act_{acc.metaAccountId}
                                  </span>
                                )}

                              {/* Industry Badge */}
                              {acc.industry && acc.industry !== "OTHER" && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                    getIndustryMeta(acc.industry).bgBadge
                                  } ${getIndustryMeta(acc.industry).textBadge} ${
                                    getIndustryMeta(acc.industry).borderBadge
                                  }`}
                                >
                                  {getIndustryMeta(acc.industry).shortLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* CHURN RISK */}
                        <TableCell className="py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${acc.churnRisk.classes}`}
                          >
                            {acc.churnRisk.label}
                          </span>
                        </TableCell>

                        {/* SPEND */}
                        <TableCell className="text-right font-mono text-sm text-slate-900 py-4">
                          {fCur(acc.spend)}
                        </TableCell>

                        {/* CONV */}
                        <TableCell className="text-right font-semibold text-slate-900 py-4">
                          <span
                            className={
                              acc.conversions > 0
                                ? "text-emerald-600 font-bold"
                                : "text-slate-400 font-light"
                            }
                          >
                            {fNum(acc.conversions)}
                          </span>
                        </TableCell>

                        {/* CPA */}
                        <TableCell className="text-right py-4">
                          {acc.spend > 0 && acc.conversions === 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[11px]">
                              No Conv.
                            </span>
                          ) : (
                            <span className="font-mono text-sm text-slate-900">
                              {fCur(acc.cpa)}
                            </span>
                          )}
                        </TableCell>

                        {/* CTR */}
                        <TableCell className="text-right font-mono text-sm text-slate-600 py-4">
                          {fPct(acc.ctr)}
                        </TableCell>

                        {/* CPC */}
                        <TableCell className="text-right font-mono text-sm text-slate-600 py-4">
                          {fCur(acc.cpc)}
                        </TableCell>

                        {/* STATUS */}
                        <TableCell className="py-4">
                          <Badge
                            variant={
                              platformFilter === "meta"
                                ? acc.metaAccountStatus === 1
                                  ? "default"
                                  : "secondary"
                                : acc.isActive
                                  ? "default"
                                  : "secondary"
                            }
                            className="rounded-md text-[10px] px-2 py-0.5 font-bold"
                          >
                            {platformFilter === "meta"
                              ? acc.metaAccountStatus === 1
                                ? "Active"
                                : "Inactive"
                              : acc.isActive
                                ? "Active"
                                : "Inactive"}
                          </Badge>
                        </TableCell>

                        {/* ACTIONS */}
                        <TableCell className="text-right pr-6 py-4">
                          <div
                            className="flex justify-end items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {platformFilter === "meta" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (acc.metaAccountId) {
                                    window.open(
                                      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc.metaAccountId}`,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }
                                }}
                                className="h-8 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 px-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Meta Ads
                              </Button>
                            ) : acc.googleId ? (
                              <ReportAutomationTrigger
                                adAccount={{
                                  id: acc.googleId,
                                  googleAccountId: acc.googleAccountId || "",
                                  name: acc.name,
                                }}
                                initialRules={acc.reportSchedules || []}
                                initialEmailLogs={acc.emailLogs || []}
                              />
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (acc.metaAccountId) {
                                    window.open(
                                      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc.metaAccountId}`,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }
                                }}
                                className="h-8 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 px-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Meta Ads
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* DRILL-DOWN SUB-ROWS (When Blended Account is Expanded in All Platforms view) */}
                      {isBlended && isExpanded && (
                        <>
                          {/* Google Channel Sub-Row */}
                          <TableRow className="bg-slate-50/60 border-l-2 border-blue-500 hover:bg-slate-100/60 text-xs">
                            <TableCell className="pl-4 pr-0 py-2.5" />
                            <TableCell className="pl-6 py-2.5 font-medium text-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="font-semibold text-blue-900">
                                  Google Ads
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  {acc.googleAccountId}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-slate-400 text-[11px]">
                              Channel
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-800 py-2.5">
                              {fCur(acc.channelBreakdown.google?.spend || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-800 py-2.5">
                              {fNum(
                                acc.channelBreakdown.google?.conversions || 0,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-800 py-2.5">
                              {fCur(acc.channelBreakdown.google?.cpa || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 py-2.5">
                              {fPct(acc.channelBreakdown.google?.ctr || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 py-2.5">
                              {fCur(acc.channelBreakdown.google?.cpc || 0)}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-[10px] text-slate-500 font-medium">
                                {acc.googleStatus || "ENABLED"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  router.push(`/accounts/${acc.googleId}`)
                                }
                                className="h-6 text-[11px] text-blue-600 hover:text-blue-800 px-2"
                              >
                                View Google
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Meta Channel Sub-Row */}
                          <TableRow className="bg-slate-50/60 border-l-2 border-sky-500 hover:bg-slate-100/60 text-xs">
                            <TableCell className="pl-4 pr-0 py-2.5" />
                            <TableCell className="pl-6 py-2.5 font-medium text-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sky-500" />
                                <span className="font-semibold text-sky-900">
                                  Meta Ads
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  act_{acc.metaAccountId}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-slate-400 text-[11px]">
                              Channel
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-800 py-2.5">
                              {fCur(acc.channelBreakdown.meta?.spend || 0)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-800 py-2.5">
                              {fNum(
                                acc.channelBreakdown.meta?.conversions || 0,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-800 py-2.5">
                              {fCur(acc.channelBreakdown.meta?.cpa || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 py-2.5">
                              {fPct(acc.channelBreakdown.meta?.ctr || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 py-2.5">
                              {fCur(acc.channelBreakdown.meta?.cpc || 0)}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-[10px] text-slate-500 font-medium">
                                {acc.metaAccountStatus === 1
                                  ? "ACTIVE"
                                  : "INACTIVE"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (acc.metaAccountId) {
                                    window.open(
                                      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acc.metaAccountId}`,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }
                                }}
                                className="h-6 text-[11px] text-sky-600 hover:text-sky-800 px-2 flex items-center gap-1 ml-auto"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Meta Ads
                              </Button>
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </>
                  );
                })
              )}

              {!loadingMetrics && paginatedAccounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-xs text-slate-500 font-sans"
                  >
                    No matching accounts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* PAGINATION CONTROLS */}
        <div className="border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Showing{" "}
            <strong className="text-slate-800">
              {filteredAccounts.length > 0 ? (page - 1) * limit + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong className="text-slate-800">
              {Math.min(page * limit, filteredAccounts.length)}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-800">
              {filteredAccounts.length}
            </strong>{" "}
            accounts
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 border rounded px-2 py-1 bg-white">
              <span className="text-[10px] text-slate-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
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
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-7 w-7 border-slate-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pNum = index + 1;
                  return (
                    <Button
                      key={pNum}
                      variant={page === pNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pNum)}
                      className="h-7 w-7 text-[10px] border-slate-200"
                    >
                      {pNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
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
