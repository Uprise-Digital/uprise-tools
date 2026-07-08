"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  LineChart,
  Loader2,
  Mail,
  MousePointerClick,
  Percent,
  Save,
  Search,
  Settings as SettingsIcon,
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

  const fCur = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.currencyCode || "AUD",
    }).format(Number.isNaN(v) ? 0 : v);
  const fNum = (v: number) =>
    new Intl.NumberFormat("en-US").format(Number.isNaN(v) ? 0 : v);
  const fPct = (v: number) => `${(Number.isNaN(v) ? 0 : v).toFixed(2)}%`;

  return (
    <div className="space-y-6 p-4 mt-0 pt-0 max-w-400 mx-auto">
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
                            placeholder={`${resolvedDefaults.criticalSpendThreshold.toFixed(2)} (Global Default)`}
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
                            placeholder={`${resolvedDefaults.criticalConversionsThreshold} (Global Default)`}
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
                            placeholder={`${resolvedDefaults.ctrHighThreshold}% (Global Default)`}
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
                            placeholder={`${resolvedDefaults.ctrHighSpendThreshold.toFixed(2)} (Global Default)`}
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
                            placeholder={`${resolvedDefaults.cpcHighThreshold.toFixed(2)} (Global Default)`}
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
                            placeholder={`${resolvedDefaults.anomalySpendChangeThreshold}% (Global Default)`}
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
                            placeholder={`${resolvedDefaults.anomalyConversionsChangeThreshold}% (Global Default)`}
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
          { title: "Cost", dataKey: "spend", color: "#3b82f6", format: fCur },
          { title: "CPC", dataKey: "cpc", color: "#8b5cf6", format: fCur },
          { title: "CTR", dataKey: "ctr", color: "#10b981", format: fPct },
        ].map((chart) => (
          <Card key={chart.title} className="mt-0 pt-0 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold">{chart.title}</CardTitle>
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
    </div>
  );
}
