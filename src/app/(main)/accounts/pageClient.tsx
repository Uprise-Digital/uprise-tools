// app/accounts/pageClient.tsx
"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { syncAdAccountsAction } from "@/actions/ads.actions";
import { getAgencyPortfolioMetricsAction } from "@/actions/agency.actions";
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

// Define the type based on your Drizzle schema return type
type AccountWithSchedules = {
  id: number;
  googleAccountId: string;
  name: string;
  currencyCode: string | null;
  isActive: boolean;
  googleStatus: string;
  reportSchedules: any[];
};

interface AccountsClientPageProps {
  accounts: AccountWithSchedules[];
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
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // 3. Search and Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [googleStatusFilter, setGoogleStatusFilter] = useState<string>("all");

  // 4. Sort State
  const [sortColumn, setSortColumn] = useState<string>("spend"); // default sort by highest spend
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // 5. Pagination State
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

  // Calculate Dynamic Churn Risk (reused from overview ledger page)
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

  // Load Performance Metrics Client-Side
  useEffect(() => {
    let isMounted = true;
    setLoadingMetrics(true);
    getAgencyPortfolioMetricsAction(startDate, endDate)
      .then((res) => {
        if (isMounted && res.success) {
          setPortfolio(res.data);
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

  // Combine DB accounts with local API performance metrics
  const combinedAccounts = accounts.map((dbAcc) => {
    const metrics = portfolio?.accountBreakdown?.find(
      (m: any) => m.googleAccountId === dbAcc.googleAccountId,
    );

    const spend = metrics ? Number(metrics.spend || 0) : 0;
    const conversions = metrics ? Number(metrics.conversions || 0) : 0;
    const cpa = metrics ? Number(metrics.cpa || 0) : 0;
    const ctr = metrics ? Number(metrics.ctr || 0) : 0;
    const cpc = metrics ? Number(metrics.cpc || 0) : 0;

    const blendedCpa = portfolio?.agencyTotals?.cpa || 0;
    const risk = getChurnRisk(
      { spend, conversions, cpa, ctr, cpc },
      blendedCpa,
    );

    return {
      ...dbAcc,
      spend,
      conversions,
      cpa,
      ctr,
      cpc,
      churnRisk: risk,
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
      case "googleAccountId":
        aVal = a.googleAccountId;
        bVal = b.googleAccountId;
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
        aVal = a.id;
        bVal = b.id;
    }

    if (aVal === bVal) return 0;
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  // Perform Client-Side Filtering
  const filteredAccounts = sortedAccounts.filter((acc) => {
    const matchesSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.googleAccountId.includes(search);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && acc.isActive) ||
      (statusFilter === "inactive" && !acc.isActive);

    const matchesRisk =
      riskFilter === "all" ||
      acc.churnRisk.label.toLowerCase() === riskFilter.toLowerCase();

    const matchesGoogleStatus =
      googleStatusFilter === "all" ||
      acc.googleStatus.toLowerCase() === googleStatusFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesRisk && matchesGoogleStatus;
  });

  const totalPages = Math.ceil(filteredAccounts.length / limit);
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * limit,
    page * limit,
  );

  useEffect(() => {
    setPage(1);
  }, []);

  const exportClientsToCsv = () => {
    const headers = [
      "Account Name",
      "Google ID",
      "Churn Risk",
      "Spend",
      "Conversions",
      "Blended CPA",
      "CTR",
      "CPC",
      "Status",
      "Google Ads Status",
    ];
    const rows = filteredAccounts.map((acc) => [
      acc.name,
      acc.googleAccountId,
      acc.churnRisk.label,
      fCur(acc.spend),
      fNum(acc.conversions),
      fCur(acc.cpa),
      fPct(acc.ctr),
      fCur(acc.cpc),
      acc.isActive ? "Active" : "Inactive",
      acc.googleStatus,
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

  const handleRowClick = (accountId: number) => {
    router.push(`/accounts/${accountId}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Accounts</h1>
          <p className="text-muted-foreground">
            Manage synced client accounts from Uprise MCC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={exportClientsToCsv}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5 border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <SyncButton action={syncAdAccountsAction} />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-100 bg-slate-50/50 py-4 gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">
              Connected Clients
            </CardTitle>
            <CardDescription className="text-xs">
              Accounts currently being monitored for alerts and reports.
            </CardDescription>
          </div>
        </CardHeader>

        {/* SHADCN-STYLE FILTER BAR */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/30 p-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search clients or Google ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 text-xs h-9 bg-white border-slate-200"
            />
          </div>

          {/* Date Picker (just like overview page) */}
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
          <div className="w-[140px]">
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
          <div className="w-[150px]">
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

          {/* Clear Filters Button */}
          {(search ||
            statusFilter !== "all" ||
            riskFilter !== "all" ||
            googleStatusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setRiskFilter("all");
                setGoogleStatusFilter("all");
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
                <TableHead className="font-bold pl-6">
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
                    Blended CPA {renderSortIndicator("cpa")}
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
                      <span>Loading account performance ledger...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((acc) => (
                  <TableRow
                    key={acc.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(acc.id)}
                  >
                    {/* CLIENT ACCOUNT */}
                    <TableCell className="font-semibold text-slate-900 pl-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span
                            title={
                              acc.googleStatus === "ENABLED"
                                ? "Google Ads: Active"
                                : acc.googleStatus === "CANCELED"
                                  ? "Google Ads: Cancelled"
                                  : acc.googleStatus === "SUSPENDED"
                                    ? "Google Ads: Suspended"
                                    : acc.googleStatus === "DELINKED"
                                      ? "Google Ads: Delinked / Archived"
                                      : `Google Ads: ${acc.googleStatus}`
                            }
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 cursor-help ${
                              acc.googleStatus === "ENABLED"
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
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 pl-4 mt-0.5">
                          {acc.googleAccountId}
                        </span>
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
                        variant={acc.isActive ? "default" : "secondary"}
                        className="rounded-md text-[10px] px-2 py-0.5 font-bold"
                      >
                        {acc.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell className="text-right pr-6 py-4">
                      {/* stopPropagation prevents row click from navigating to dashboard */}
                      <div
                        className="flex justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ReportAutomationTrigger
                          adAccount={{
                            id: acc.id,
                            googleAccountId: acc.googleAccountId,
                            name: acc.name,
                          }}
                          initialRules={acc.reportSchedules || []}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
