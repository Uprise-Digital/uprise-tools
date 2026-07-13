"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  Info,
  LineChart,
  Loader2,
  Mail,
  MousePointerClick,
  Percent,
  Save,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  auditConversionTrackingAction,
  getImpressionShareReportAction,
} from "@/actions/agency.actions";
import { getDashboardMetricsAction } from "@/actions/dashboard.actions";
import { saveAccountTriageSettingsAction } from "@/actions/triage-settings.actions";
import { AiInsights } from "@/components/ai-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientDashboardProps {
  account: {
    id: number;
    googleAccountId: string;
    name: string;
    currencyCode: string | null;
    includeInBriefing: boolean;
    isActive: boolean;
    googleStatus: string;
    syncStatus: string | null;
    syncError: string | null;
  };
  orgDefaults: {
    criticalSpendThreshold: number;
    criticalConversionsThreshold: number;
    ctrHighThreshold: number;
    ctrHighSpendThreshold: number;
    cpcHighThreshold: number;
    anomalySpendChangeThreshold: number;
    anomalyConversionsChangeThreshold: number;
  } | null;
  initialSettings: {
    id?: number | null;
    adAccountId?: number;
    criticalSpendThreshold: number | null;
    criticalConversionsThreshold: number | null;
    ctrHighThreshold: number | null;
    ctrHighSpendThreshold: number | null;
    cpcHighThreshold: number | null;
    anomalySpendChangeThreshold: number | null;
    anomalyConversionsChangeThreshold: number | null;
  } | null;
}

const DEFAULT_THRESHOLDS = {
  criticalSpendThreshold: 70.0,
  criticalConversionsThreshold: 0,
  ctrHighThreshold: 7.0,
  ctrHighSpendThreshold: 50.0,
  cpcHighThreshold: 30.0,
  anomalySpendChangeThreshold: -30.0,
  anomalyConversionsChangeThreshold: -25.0,
};

export default function ClientDashboard({
  account,
  orgDefaults,
  initialSettings,
}: ClientDashboardProps) {
  const router = useRouter();
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
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Configuration Sheet State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState({
    criticalSpendThreshold:
      initialSettings?.criticalSpendThreshold?.toString() ?? "",
    criticalConversionsThreshold:
      initialSettings?.criticalConversionsThreshold?.toString() ?? "",
    ctrHighThreshold: initialSettings?.ctrHighThreshold?.toString() ?? "",
    ctrHighSpendThreshold:
      initialSettings?.ctrHighSpendThreshold?.toString() ?? "",
    cpcHighThreshold: initialSettings?.cpcHighThreshold?.toString() ?? "",
    anomalySpendChangeThreshold:
      initialSettings?.anomalySpendChangeThreshold?.toString() ?? "",
    anomalyConversionsChangeThreshold:
      initialSettings?.anomalyConversionsChangeThreshold?.toString() ?? "",
    includeInBriefing: account.includeInBriefing,
  });

  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignLimit, setCampaignLimit] = useState(10);

  // Tabs state
  const [activeTab, setActiveTab] = useState<
    "performance" | "impression_share" | "conversion_health"
  >("performance");

  // Impression Share States
  const [isISLoading, setIsISLoading] = useState(false);
  const [isData, setIsData] = useState<any[] | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isSortBy, setIsSortBy] = useState<string>("campaignName");
  const [isSortDir, setIsSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: string) => {
    if (isSortBy === field) {
      setIsSortDir(isSortDir === "asc" ? "desc" : "asc");
    } else {
      setIsSortBy(field);
      setIsSortDir("desc");
    }
  };

  const formatPrecision = (val: any) => {
    if (val === undefined || val === null || val === "--" || val === "")
      return "--";
    const num = parseFloat(String(val));
    if (isNaN(num)) return String(val);
    const formatted = num.toPrecision(3);
    return String(Number(formatted));
  };

  const formatChannelType = (type: string) => {
    if (type === "PERFORMANCE_MAX") return "P_MAX";
    return type;
  };

  // Conversion Health States
  const [isConvLoading, setIsConvLoading] = useState(false);
  const [convData, setConvData] = useState<{
    hasSpendInLast14Days: boolean;
    actions: any[];
  } | null>(null);
  const [convError, setConvError] = useState<string | null>(null);

  // Fetch Impression Share on tab change or date change
  useEffect(() => {
    if (activeTab !== "impression_share" || !account.isActive) return;

    let isMounted = true;
    async function loadIS() {
      setIsISLoading(true);
      setIsError(null);
      try {
        const res = await getImpressionShareReportAction(
          account.id,
          startDate,
          endDate,
        );
        if (isMounted) {
          if (res.success && res.data) {
            setIsData(res.data);
          } else {
            setIsError(res.error || "Failed to load impression share report.");
          }
        }
      } catch (err: any) {
        if (isMounted)
          setIsError(err.message || "An unexpected error occurred.");
      } finally {
        if (isMounted) setIsISLoading(false);
      }
    }
    loadIS();
    return () => {
      isMounted = false;
    };
  }, [activeTab, account.id, startDate, endDate, account.isActive]);

  // Fetch Conversion tracking audit on tab change
  useEffect(() => {
    if (activeTab !== "conversion_health" || !account.isActive) return;

    let isMounted = true;
    async function loadConv() {
      setIsConvLoading(true);
      setConvError(null);
      try {
        const res = await auditConversionTrackingAction(account.id);
        if (isMounted) {
          if (res.success && res.data) {
            setConvData(res.data);
          } else {
            setConvError(
              res.error || "Failed to load conversion tracking audit.",
            );
          }
        }
      } catch (err: any) {
        if (isMounted)
          setConvError(err.message || "An unexpected error occurred.");
      } finally {
        if (isMounted) setIsConvLoading(false);
      }
    }
    loadConv();
    return () => {
      isMounted = false;
    };
  }, [activeTab, account.id, account.isActive]);

  // Filtered Campaigns
  const filteredCampaigns = (data?.campaigns || []).filter((c: any) => {
    return c.campaignName.toLowerCase().includes(campaignSearch.toLowerCase());
  });

  const totalCampaignPages = Math.ceil(
    filteredCampaigns.length / campaignLimit,
  );
  const paginatedCampaigns = filteredCampaigns.slice(
    (campaignPage - 1) * campaignLimit,
    campaignPage * campaignLimit,
  );

  useEffect(() => {
    setCampaignPage(1);
  }, []);

  const exportCampaignsToCsv = () => {
    const headers = [
      "Campaign Name",
      "Cost",
      "Clicks",
      "Impressions",
      "CTR",
      "CPC",
      "Conversions",
      "CPA",
      "Conv. Rate",
    ];
    const rows = filteredCampaigns.map((c: any) => [
      c.campaignName,
      c.spend,
      c.clicks,
      c.impressions,
      c.ctr,
      c.cpc,
      c.conversions,
      c.cpa,
      c.convRate,
    ]);

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
      `${account.name.replace(/\s+/g, "_")}_campaigns_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Campaign metrics exported successfully.");
  };

  const resolvedDefaults = orgDefaults || DEFAULT_THRESHOLDS;

  const handleInputChange = (field: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClearAll = () => {
    setFormState({
      criticalSpendThreshold: "",
      criticalConversionsThreshold: "",
      ctrHighThreshold: "",
      ctrHighSpendThreshold: "",
      cpcHighThreshold: "",
      anomalySpendChangeThreshold: "",
      anomalyConversionsChangeThreshold: "",
      includeInBriefing: true,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading("Saving client threshold overrides...");

    try {
      const res = await saveAccountTriageSettingsAction(account.id, {
        id: initialSettings?.id ?? null,
        criticalSpendThreshold:
          formState.criticalSpendThreshold === ""
            ? null
            : parseFloat(formState.criticalSpendThreshold),
        criticalConversionsThreshold:
          formState.criticalConversionsThreshold === ""
            ? null
            : parseInt(formState.criticalConversionsThreshold, 10),
        ctrHighThreshold:
          formState.ctrHighThreshold === ""
            ? null
            : parseFloat(formState.ctrHighThreshold),
        ctrHighSpendThreshold:
          formState.ctrHighSpendThreshold === ""
            ? null
            : parseFloat(formState.ctrHighSpendThreshold),
        cpcHighThreshold:
          formState.cpcHighThreshold === ""
            ? null
            : parseFloat(formState.cpcHighThreshold),
        anomalySpendChangeThreshold:
          formState.anomalySpendChangeThreshold === ""
            ? null
            : parseFloat(formState.anomalySpendChangeThreshold),
        anomalyConversionsChangeThreshold:
          formState.anomalyConversionsChangeThreshold === ""
            ? null
            : parseFloat(formState.anomalyConversionsChangeThreshold),
        includeInBriefing: formState.includeInBriefing,
      });

      if (res.success) {
        toast.success("Client overrides saved successfully!", { id: toastId });
        setIsConfigOpen(false);
        router.refresh();
      } else {
        throw new Error(res.error || "Failed to save overrides");
      }
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "An error occurred while saving.";
      toast.error(errMsg, {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    getDashboardMetricsAction(
      account.id,
      account.googleAccountId,
      startDate,
      endDate,
    )
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [account.id, account.googleAccountId, startDate, endDate]);

  const fCur = (v: any) => {
    const num = Number(v);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.currencyCode || "AUD",
    }).format(Number.isNaN(num) ? 0 : num);
  };
  const fNum = (v: any) => {
    const num = Number(v);
    return new Intl.NumberFormat("en-US").format(Number.isNaN(num) ? 0 : num);
  };
  const fPct = (v: any) => {
    const num = Number(v);
    return `${(Number.isNaN(num) ? 0 : num).toFixed(2)}%`;
  };
  const sortedData = [...(isData || [])].sort((a, b) => {
    let valA = a[isSortBy];
    let valB = b[isSortBy];

    if (isSortBy === "searchImpressionShare") {
      valA = a.parsedMetrics?.searchImpressionShare ?? 0;
      valB = b.parsedMetrics?.searchImpressionShare ?? 0;
    } else if (isSortBy === "searchBudgetLostImpressionShare") {
      valA = a.parsedMetrics?.searchBudgetLostImpressionShare ?? 0;
      valB = b.parsedMetrics?.searchBudgetLostImpressionShare ?? 0;
    } else if (isSortBy === "searchRankLostImpressionShare") {
      valA = a.parsedMetrics?.searchRankLostImpressionShare ?? 0;
      valB = b.parsedMetrics?.searchRankLostImpressionShare ?? 0;
    } else if (isSortBy === "searchTopImpressionShare") {
      valA = a.parsedMetrics?.searchTopImpressionShare ?? 0;
      valB = b.parsedMetrics?.searchTopImpressionShare ?? 0;
    }

    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();

    if (valA < valB) return isSortDir === "asc" ? -1 : 1;
    if (valA > valB) return isSortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 p-4 mt-0 pt-0 max-w-400 mx-auto">
      {!account.isActive && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Archived Account</p>
            <p className="text-amber-700 leading-relaxed">
              This account has been delinked from Google Ads or deactivated. Live syncing is suspended, and the dashboard is displaying the last cached historical data.
            </p>
            {account.syncError && (
              <p className="font-mono bg-amber-100/50 p-1.5 rounded mt-2 border border-amber-200/50 text-[10px]">
                Reason: {account.syncError}
              </p>
            )}
          </div>
        </div>
      )}

      {account.isActive && data?.syncFailed && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Sync Warning</p>
            <p className="text-rose-700 leading-relaxed">
              The latest sync with Google Ads failed. Displaying cached data.
            </p>
            {data.syncError && (
              <p className="font-mono bg-rose-100/50 p-1.5 rounded mt-2 border border-rose-200/50 text-[10px]">
                Error: {data.syncError}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/accounts")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{account.name}</h1>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-slate-200 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-200 flex items-center gap-1.5"
                onClick={() => router.push(`/accounts/${account.id}/negatives`)}
              >
                <Ban className="h-3.5 w-3.5 text-slate-500" />
                Negative Keywords
              </Button>
              <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full border-slate-200"
                  >
                    <SettingsIcon className="h-4 w-4 text-slate-500 hover:text-indigo-600" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="p-4 w-[500px] sm:max-w-[1000px] md:max-w-[1000px] overflow-y-auto bg-white">
                  <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2 text-slate-800">
                      <SettingsIcon className="w-5 h-5 text-indigo-500" />
                      Configure Rules: {account.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      Set custom thresholds for this client. Leave fields blank
                      to use organization-wide defaults.
                    </SheetDescription>
                  </SheetHeader>
                  <form onSubmit={handleSave} className="space-y-6">
                    {/* NOTIFICATION PREFERENCES */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <Mail className="w-3.5 h-3.5 text-indigo-500" />
                        Notification Preferences
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="includeInBriefing"
                              className="text-xs font-bold text-slate-800"
                            >
                              Include in Morning Briefing
                            </Label>
                            <p className="text-[10px] text-slate-400 max-w-[320px]">
                              When disabled, this client will be excluded from
                              the daily automated email briefing.
                            </p>
                          </div>
                          <input
                            id="includeInBriefing"
                            type="checkbox"
                            checked={formState.includeInBriefing}
                            onChange={(e) =>
                              handleInputChange(
                                "includeInBriefing",
                                e.target.checked,
                              )
                            }
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 shrink-0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CRITICAL ALERTS */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Critical Fire Triggers
                      </h3>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="criticalSpend" className="text-xs">
                            Critical Spend Limit (AUD $)
                          </Label>
                          <Input
                            id="criticalSpend"
                            type="number"
                            step="0.01"
                            placeholder={`${(Number(resolvedDefaults?.criticalSpendThreshold) || DEFAULT_THRESHOLDS.criticalSpendThreshold).toFixed(2)} (Global Default)`}
                            value={formState.criticalSpendThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "criticalSpendThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                          <p className="text-[10px] text-slate-400">
                            Trigger alert if an account spends more than this
                            with low conversions.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="criticalConversions"
                            className="text-xs"
                          >
                            Maximum Conversions Target
                          </Label>
                          <Input
                            id="criticalConversions"
                            type="number"
                            step="1"
                            placeholder={`${resolvedDefaults?.criticalConversionsThreshold ?? DEFAULT_THRESHOLDS.criticalConversionsThreshold} (Global Default)`}
                            value={formState.criticalConversionsThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "criticalConversionsThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                          <p className="text-[10px] text-slate-400">
                            The upper limit of conversions to classify as a
                            critical conversion leak.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* INDIVIDUAL PERFORMANCE ANOMALIES */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        Performance Anomalies
                      </h3>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="ctrHigh" className="text-xs">
                            CTR Anomaly Limit (%)
                          </Label>
                          <Input
                            id="ctrHigh"
                            type="number"
                            step="0.1"
                            placeholder={`${resolvedDefaults?.ctrHighThreshold ?? DEFAULT_THRESHOLDS.ctrHighThreshold}% (Global Default)`}
                            value={formState.ctrHighThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "ctrHighThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ctrHighSpend" className="text-xs">
                            Min Spend for CTR Anomaly (AUD $)
                          </Label>
                          <Input
                            id="ctrHighSpend"
                            type="number"
                            step="0.01"
                            placeholder={`${(Number(resolvedDefaults?.ctrHighSpendThreshold) || DEFAULT_THRESHOLDS.ctrHighSpendThreshold).toFixed(2)} (Global Default)`}
                            value={formState.ctrHighSpendThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "ctrHighSpendThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cpcHigh" className="text-xs">
                            Single Click High CPC (AUD $)
                          </Label>
                          <Input
                            id="cpcHigh"
                            type="number"
                            step="0.01"
                            placeholder={`${(Number(resolvedDefaults?.cpcHighThreshold) || DEFAULT_THRESHOLDS.cpcHighThreshold).toFixed(2)} (Global Default)`}
                            value={formState.cpcHighThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "cpcHighThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* HISTORICAL BASELINE DEVIATION */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        Baseline Variance Deviation (%)
                      </h3>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="anomalySpend" className="text-xs">
                            Spend Drop Threshold (%)
                          </Label>
                          <Input
                            id="anomalySpend"
                            type="number"
                            step="0.1"
                            placeholder={`${resolvedDefaults?.anomalySpendChangeThreshold ?? DEFAULT_THRESHOLDS.anomalySpendChangeThreshold}% (Global Default)`}
                            value={formState.anomalySpendChangeThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "anomalySpendChangeThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                          <p className="text-[10px] text-slate-400">
                            Trigger warning if spend drops by more than this
                            percent (e.g. -30.0).
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="anomalyConversions"
                            className="text-xs"
                          >
                            Conversions Drop Threshold (%)
                          </Label>
                          <Input
                            id="anomalyConversions"
                            type="number"
                            step="0.1"
                            placeholder={`${resolvedDefaults?.anomalyConversionsChangeThreshold ?? DEFAULT_THRESHOLDS.anomalyConversionsChangeThreshold}% (Global Default)`}
                            value={formState.anomalyConversionsChangeThreshold}
                            onChange={(e) =>
                              handleInputChange(
                                "anomalyConversionsChangeThreshold",
                                e.target.value,
                              )
                            }
                            className="text-xs"
                          />
                          <p className="text-[10px] text-slate-400">
                            Trigger warning if conversions drop by more than
                            this percent (e.g. -25.0).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearAll}
                        size="sm"
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Clear Overrides
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsConfigOpen(false)}
                          disabled={isSaving}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSaving}
                          className="text-xs flex items-center gap-1.5"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save Rules
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Need to modify organization-wide defaults?
                      </span>
                      <a
                        href="/settings"
                        className="text-indigo-600 font-medium hover:underline flex items-center gap-1"
                      >
                        Configure Org Defaults
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
            <p className="text-xs font-mono text-slate-500">
              ID: {account.googleAccountId}
            </p>
          </div>
        </div>

        {/* REFACTORED DATE CONTAINER */}
        <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-1.5 gap-2 w-full md:w-auto">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />

          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-none h-8 w-[110px] p-0 text-sm focus-visible:ring-0 shadow-none [color-scheme:light]"
          />

          <span className="text-slate-300 font-light">—</span>

          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border-none h-8 w-[110px] p-0 text-sm focus-visible:ring-0 shadow-none [color-scheme:light]"
          />
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold mb-4 shrink-0">
        {[
          { id: "performance", label: "Performance Dashboard" },
          { id: "impression_share", label: "Impression Share Audit" },
          { id: "conversion_health", label: "Conversion Tracking Health" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
            }}
            className={`pb-3 relative transition-all duration-200 font-sans cursor-pointer ${
              activeTab === tab.id
                ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "performance" && (
        <>
          {/* NEW: Insert the AI Insight Engine here */}
          <AiInsights
            adAccountId={account.id}
            googleAccountId={account.googleAccountId}
            startDate={startDate}
            endDate={endDate}
          />

          {/* KPI GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Cost",
                val: data?.totals.spend,
                icon: DollarSign,
                color: "text-blue-600",
                bg: "bg-blue-50",
                f: fCur,
              },
              {
                label: "Clicks",
                val: data?.totals.clicks,
                icon: MousePointerClick,
                color: "text-purple-600",
                bg: "bg-purple-50",
                f: fNum,
              },
              {
                label: "Impressions",
                val: data?.totals.impressions,
                icon: Eye,
                color: "text-amber-600",
                bg: "bg-amber-50",
                f: fNum,
              },
              {
                label: "CTR",
                val: data?.totals.ctr,
                icon: Percent,
                color: "text-indigo-600",
                bg: "bg-indigo-50",
                f: fPct,
              },
              {
                label: "Conversions",
                val: data?.totals.conversions,
                icon: Target,
                color: "text-emerald-600",
                bg: "bg-emerald-50",
                f: fNum,
              },
              {
                label: "Cost / Conv.",
                val: data?.totals.cpa,
                icon: Activity,
                color: "text-rose-600",
                bg: "bg-rose-50",
                f: fCur,
              },
              {
                label: "Conv. Rate",
                val: data?.totals.convRate,
                icon: LineChart,
                color: "text-teal-600",
                bg: "bg-teal-50",
                f: fPct,
              },
              {
                label: "Avg. CPC",
                val: data?.totals.cpc,
                icon: DollarSign,
                color: "text-slate-600",
                bg: "bg-slate-100",
                f: fCur,
              },
            ].map((kpi, i) => (
              <Card key={i} className="mt-0 pt-0 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                      {kpi.label}
                    </p>
                    <p className="text-xl font-bold">
                      {isLoading ? (
                        <Skeleton className="h-6 w-16" />
                      ) : (
                        kpi.f(kpi.val)
                      )}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* TRIPLE GRAPH GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                title: "Cost",
                dataKey: "spend",
                color: "#3b82f6",
                format: fCur,
              },
              { title: "CPC", dataKey: "cpc", color: "#8b5cf6", format: fCur },
              { title: "CTR", dataKey: "ctr", color: "#10b981", format: fPct },
            ].map((chart) => (
              <Card key={chart.title} className="mt-0 pt-0 shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-bold">
                    {chart.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-50">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        margin={{ top: 10, right: 10, left: -40, bottom: 0 }}
                        data={data?.timeSeries}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={10}
                          tickLine={false}
                          padding={{ left: 0, right: 0 }}
                          axisLine={false}
                          dy={10} // Adds space between the axis and the text
                          minTickGap={20} // Prevents labels from overlapping
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          }}
                        />
                        <YAxis
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          dy={10} // Adds space between the axis and the text
                          minTickGap={20} // Prevents labels from overlapping
                          domain={["auto", "auto"]}
                        />
                        <RechartsTooltip
                          formatter={(v: any) => [
                            chart.format(Number(v)),
                            chart.title,
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey={chart.dataKey}
                          stroke={chart.color}
                          fill={chart.color}
                          fillOpacity={0.1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FULL CAMPAIGN TABLE */}
          <Card className="shadow-sm overflow-hidden mt-0 pt-0">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center py-4 gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">
                  Campaign Breakdown
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search campaigns..."
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    className="pl-8 text-xs h-8 bg-white"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  onClick={exportCampaignsToCsv}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 flex items-center gap-1.5 border-slate-200"
                  disabled={isLoading || filteredCampaigns.length === 0}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-xs text-slate-500 font-sans"
                    >
                      Loading campaigns...
                    </TableCell>
                  </TableRow>
                ) : paginatedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-xs text-slate-500 font-sans"
                    >
                      No matching campaigns found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCampaigns.map((c: any, i: number) => (
                    <TableRow key={i} className="text-xs">
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {c.campaignName}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fCur(c.spend)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fNum(c.clicks)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fNum(c.impressions)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fPct(c.ctr)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fCur(c.cpc)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {fNum(c.conversions)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fCur(c.cpa)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fPct(c.convRate)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* PAGINATION CONTROLS */}
            {!isLoading && filteredCampaigns.length > 0 && (
              <div className="border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                <div>
                  Showing{" "}
                  <strong className="text-slate-800">
                    {(campaignPage - 1) * campaignLimit + 1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-slate-800">
                    {Math.min(
                      campaignPage * campaignLimit,
                      filteredCampaigns.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-800">
                    {filteredCampaigns.length}
                  </strong>{" "}
                  campaigns
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 border rounded px-2 py-1 bg-white">
                    <span className="text-[10px] text-slate-400">Rows:</span>
                    <select
                      value={campaignLimit}
                      onChange={(e) =>
                        setCampaignLimit(parseInt(e.target.value, 10))
                      }
                      className="bg-transparent border-none focus:outline-none text-[10px] font-semibold cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {totalCampaignPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={campaignPage <= 1}
                        onClick={() => setCampaignPage(campaignPage - 1)}
                        className="h-7 w-7 border-slate-200"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      {Array.from({ length: totalCampaignPages }).map(
                        (_, index) => {
                          const pNum = index + 1;
                          return (
                            <Button
                              key={pNum}
                              variant={
                                campaignPage === pNum ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCampaignPage(pNum)}
                              className="h-7 w-7 text-[10px] border-slate-200"
                            >
                              {pNum}
                            </Button>
                          );
                        },
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={campaignPage >= totalCampaignPages}
                        onClick={() => setCampaignPage(campaignPage + 1)}
                        className="h-7 w-7 border-slate-200"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === "impression_share" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" />
                Impression Share Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {isISLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-500">
                    Querying impression share reports...
                  </p>
                </div>
              ) : isError ? (
                <div className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-100 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
                  <p>{isError}</p>
                </div>
              ) : !isData || isData.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-12">
                  No campaign impression share data found.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* DIAGNOSTIC RECOMMENDATION PANEL */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Impression Share Recommendations
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-indigo-900/90 leading-relaxed">
                      <div className="bg-white rounded-lg p-3 border border-indigo-100/50 shadow-sm space-y-1">
                        <strong className="text-indigo-950 block">
                          Budget-Constrained Campaigns
                        </strong>
                        <p>
                          Increase daily budgets for these campaigns. They are
                          converting well but running out of budget early in the
                          day, causing you to leave high-intent searches on the
                          table.
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-indigo-100/50 shadow-sm space-y-1">
                        <strong className="text-indigo-950 block">
                          Rank-Constrained Campaigns
                        </strong>
                        <p>
                          Improve Quality Score, increase bid caps, or optimize
                          landing page copy. These campaigns have budget
                          available but are losing ad auctions due to bid levels
                          or ad relevance issues.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CAMPAIGN METRICS TABLE / LIST */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-b border-slate-200">
                          <TableHead className="w-[180px]">
                            <button
                              type="button"
                              onClick={() => handleSort("campaignName")}
                              className="flex items-center gap-1 hover:text-slate-900 font-extrabold cursor-pointer text-xs text-left"
                            >
                              Campaign
                              {isSortBy === "campaignName" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="w-[70px]">
                            <button
                              type="button"
                              onClick={() =>
                                handleSort("advertisingChannelType")
                              }
                              className="flex items-center gap-1 hover:text-slate-900 font-extrabold cursor-pointer text-xs text-left"
                            >
                              Type
                              {isSortBy === "advertisingChannelType" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="w-[160px] font-extrabold text-slate-800 text-xs text-left">
                            Auction Opportunity Breakdown (100%)
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleSort("searchImpressionShare")
                              }
                              className="flex items-center justify-end gap-1 hover:text-slate-900 font-extrabold cursor-pointer w-full text-xs text-right"
                            >
                              Search IS
                              {isSortBy === "searchImpressionShare" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleSort("searchBudgetLostImpressionShare")
                              }
                              className="flex items-center justify-end gap-1 hover:text-slate-900 font-extrabold cursor-pointer w-full text-xs text-right"
                            >
                              Lost (Budget)
                              {isSortBy ===
                              "searchBudgetLostImpressionShare" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleSort("searchRankLostImpressionShare")
                              }
                              className="flex items-center justify-end gap-1 hover:text-slate-900 font-extrabold cursor-pointer w-full text-xs text-right"
                            >
                              Lost (Rank)
                              {isSortBy === "searchRankLostImpressionShare" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleSort("searchTopImpressionShare")
                              }
                              className="flex items-center justify-end gap-1 hover:text-slate-900 font-extrabold cursor-pointer w-full text-xs text-right"
                            >
                              Top IS
                              {isSortBy === "searchTopImpressionShare" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                          <TableHead className="text-center">
                            <button
                              type="button"
                              onClick={() => handleSort("flag")}
                              className="flex items-center justify-center gap-1 hover:text-slate-900 font-extrabold cursor-pointer w-full text-xs text-center"
                            >
                              Status
                              {isSortBy === "flag" ? (
                                isSortDir === "asc" ? (
                                  "▲"
                                ) : (
                                  "▼"
                                )
                              ) : (
                                <span className="opacity-30 text-[9px]">▲</span>
                              )}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map((c, i) => (
                          <TableRow key={i} className="text-xs">
                            <TableCell className="font-semibold text-slate-800">
                              {c.campaignName}
                            </TableCell>
                            <TableCell className="text-slate-500 font-mono text-[10px]">
                              {formatChannelType(c.advertisingChannelType)}
                            </TableCell>
                            <TableCell>
                              {c.isPMax ? (
                                <span className="text-[10px] text-slate-400 italic">
                                  Not available for Performance Max
                                </span>
                              ) : (
                                <div className="space-y-1 py-0.5">
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                    <div
                                      style={{
                                        width: `${c.parsedMetrics.searchImpressionShare}%`,
                                      }}
                                      className="bg-emerald-500 h-full transition-all duration-300"
                                      title={`Search IS: ${formatPrecision(c.searchImpressionShare)}`}
                                    />
                                    <div
                                      style={{
                                        width: `${c.parsedMetrics.searchBudgetLostImpressionShare}%`,
                                      }}
                                      className="bg-amber-500 h-full transition-all duration-300"
                                      title={`Lost to Budget: ${formatPrecision(c.searchBudgetLostImpressionShare)}`}
                                    />
                                    <div
                                      style={{
                                        width: `${c.parsedMetrics.searchRankLostImpressionShare}%`,
                                      }}
                                      className="bg-rose-500 h-full transition-all duration-300"
                                      title={`Lost to Rank: ${formatPrecision(c.searchRankLostImpressionShare)}`}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] text-slate-400 font-semibold font-sans">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      IS:{" "}
                                      {formatPrecision(c.searchImpressionShare)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      Lost (Budget):{" "}
                                      {formatPrecision(
                                        c.searchBudgetLostImpressionShare,
                                      )}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                      Lost (Rank):{" "}
                                      {formatPrecision(
                                        c.searchRankLostImpressionShare,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600">
                              {formatPrecision(c.searchImpressionShare)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-600">
                              {formatPrecision(
                                c.searchBudgetLostImpressionShare,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-rose-600">
                              {formatPrecision(c.searchRankLostImpressionShare)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600">
                              {formatPrecision(c.searchTopImpressionShare)}
                            </TableCell>
                            <TableCell className="text-center">
                              {c.isPMax ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  PMAX
                                </span>
                              ) : c.flag === "budget-constrained" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  BUDGET LIMIT
                                </span>
                              ) : c.flag === "rank-constrained" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  RANK LIMIT
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  HEALTHY
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "conversion_health" && (
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" />
                Conversion Tracking Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {isConvLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  <p className="text-xs text-slate-500">
                    Auditing conversion tracking configurations...
                  </p>
                </div>
              ) : convError ? (
                <div className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-100 flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
                  <p>{convError}</p>
                </div>
              ) : !convData || convData.actions.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-12">
                  No conversion actions found.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* ACTIVE WARNINGS CARDS */}
                  {(() => {
                    const allFlags = convData.actions.flatMap((a) => a.flags);
                    if (allFlags.length === 0) {
                      return (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3 text-xs text-emerald-800">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <div>
                            <strong className="text-emerald-950 block">
                              All Conversion Tags Healthy
                            </strong>
                            No anomalies, double-counting, or tracking breaks
                            detected. Your automated bidding strategies are
                            optimizing against clean conversion data.
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
                        <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Tracking Diagnostics Alerts ({allFlags.length})
                        </h3>
                        <ul className="list-disc pl-5 text-xs text-rose-900/90 space-y-1.5">
                          {convData.actions
                            .filter((a) => a.flags.length > 0)
                            .map((a, i) => (
                              <li key={i}>
                                <strong className="text-rose-950">
                                  {a.name}
                                </strong>
                                : {a.flags.join(", ")}
                              </li>
                            ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* CONVERSION ACTIONS TABLE */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead>Conversion Action</TableHead>
                          <TableHead>Origin</TableHead>
                          <TableHead>Counting</TableHead>
                          <TableHead>Bidding Role</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">
                            Last Conversion
                          </TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {convData.actions.map((a, i) => {
                          const hasWarning = a.flags.length > 0;
                          return (
                            <TableRow
                              key={i}
                              className={`text-xs ${hasWarning ? "bg-rose-50/20" : ""}`}
                            >
                              <TableCell className="font-semibold text-slate-800 py-3">
                                <div className="space-y-0.5">
                                  <span>{a.name}</span>
                                  {hasWarning && (
                                    <div className="flex flex-col gap-1 mt-1">
                                      {a.flags.map(
                                        (flag: string, idx: number) => (
                                          <span
                                            key={idx}
                                            className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1 w-max"
                                          >
                                            {flag}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-500 font-mono text-[10px]">
                                {a.type}
                              </TableCell>
                              <TableCell className="text-slate-600 font-mono text-[10px]">
                                {a.countingType}
                              </TableCell>
                              <TableCell>
                                {a.primaryForGoal ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    PRIMARY
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    SECONDARY
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-500 font-mono text-[10px]">
                                {a.category}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-700 font-bold">
                                {a.daysSinceLastConversion === null ? (
                                  <span className="text-slate-400 italic">
                                    No conversions in &gt; 30d
                                  </span>
                                ) : a.daysSinceLastConversion === 0 ? (
                                  <span className="text-emerald-600 font-bold">
                                    Today
                                  </span>
                                ) : a.daysSinceLastConversion === 1 ? (
                                  <span className="text-slate-700">
                                    1 day ago
                                  </span>
                                ) : (
                                  <span className="text-slate-700">
                                    {a.daysSinceLastConversion} days ago
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {a.status === "ENABLED" ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ENABLED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    {a.status}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
