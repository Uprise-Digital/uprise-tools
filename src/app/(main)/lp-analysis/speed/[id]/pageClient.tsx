import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  ExternalLink,
  FileCode,
  Gauge,
  Globe,
  HelpCircle,
  ImageIcon,
  Info,
  Key,
  Laptop,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type LandingPageSpeedData,
  type PageSpeedAuditResultWithMeta,
  runLandingPageSpeedTestAction,
  toggleWeeklySpeedCheckAction,
  verifyGooglePageSpeedApiKeyAction,
} from "@/actions/lp-speed.actions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UserSpeedSettings {
  engine: "auto" | "google" | "edge";
  apiKey: string;
  networkProfile: "standard_4g" | "fast_4g" | "unthrottled";
  cpuThrottle: "4x" | "2x" | "1x";
  minScoreAlert: number;
  maxLcpAlert: number;
  maxTtfbAlert: number;
}

const DEFAULT_SPEED_SETTINGS: UserSpeedSettings = {
  engine: "auto",
  apiKey: "",
  networkProfile: "standard_4g",
  cpuThrottle: "4x",
  minScoreAlert: 80,
  maxLcpAlert: 2.5,
  maxTtfbAlert: 800,
};

interface SpeedTestingClientPageProps {
  initialData: LandingPageSpeedData;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getScoreColor(score: number): {
  text: string;
  bg: string;
  border: string;
  ring: string;
  label: string;
} {
  if (score >= 90) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      ring: "text-emerald-500",
      label: "Good",
    };
  }
  if (score >= 50) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      ring: "text-amber-500",
      label: "Needs Improvement",
    };
  }
  return {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    ring: "text-rose-500",
    label: "Poor",
  };
}

function getMetricStatus(
  metricName: "LCP" | "CLS" | "INP" | "FCP" | "TTFB" | "SpeedIndex",
  valMs?: number | null,
  clsScore?: number | null,
): { label: "Good" | "Needs Improvement" | "Poor"; color: string; bg: string } {
  if (metricName === "CLS") {
    const val = clsScore ?? 0;
    if (val <= 0.1)
      return {
        label: "Good",
        color: "text-emerald-700",
        bg: "bg-emerald-50 border-emerald-200",
      };
    if (val <= 0.25)
      return {
        label: "Needs Improvement",
        color: "text-amber-700",
        bg: "bg-amber-50 border-amber-200",
      };
    return {
      label: "Poor",
      color: "text-rose-700",
      bg: "bg-rose-50 border-rose-200",
    };
  }

  const ms = valMs ?? 0;

  switch (metricName) {
    case "LCP":
      if (ms <= 2500)
        return {
          label: "Good",
          color: "text-emerald-700",
          bg: "bg-emerald-50 border-emerald-200",
        };
      if (ms <= 4000)
        return {
          label: "Needs Improvement",
          color: "text-amber-700",
          bg: "bg-amber-50 border-amber-200",
        };
      return {
        label: "Poor",
        color: "text-rose-700",
        bg: "bg-rose-50 border-rose-200",
      };
    case "INP":
      if (ms <= 200)
        return {
          label: "Good",
          color: "text-emerald-700",
          bg: "bg-emerald-50 border-emerald-200",
        };
      if (ms <= 500)
        return {
          label: "Needs Improvement",
          color: "text-amber-700",
          bg: "bg-amber-50 border-amber-200",
        };
      return {
        label: "Poor",
        color: "text-rose-700",
        bg: "bg-rose-50 border-rose-200",
      };
    case "FCP":
      if (ms <= 1800)
        return {
          label: "Good",
          color: "text-emerald-700",
          bg: "bg-emerald-50 border-emerald-200",
        };
      if (ms <= 3000)
        return {
          label: "Needs Improvement",
          color: "text-amber-700",
          bg: "bg-amber-50 border-amber-200",
        };
      return {
        label: "Poor",
        color: "text-rose-700",
        bg: "bg-rose-50 border-rose-200",
      };
    case "TTFB":
      if (ms <= 800)
        return {
          label: "Good",
          color: "text-emerald-700",
          bg: "bg-emerald-50 border-emerald-200",
        };
      if (ms <= 1800)
        return {
          label: "Needs Improvement",
          color: "text-amber-700",
          bg: "bg-amber-50 border-amber-200",
        };
      return {
        label: "Poor",
        color: "text-rose-700",
        bg: "bg-rose-50 border-rose-200",
      };
    case "SpeedIndex":
      if (ms <= 3400)
        return {
          label: "Good",
          color: "text-emerald-700",
          bg: "bg-emerald-50 border-emerald-200",
        };
      if (ms <= 5800)
        return {
          label: "Needs Improvement",
          color: "text-amber-700",
          bg: "bg-amber-50 border-amber-200",
        };
      return {
        label: "Poor",
        color: "text-rose-700",
        bg: "bg-rose-50 border-rose-200",
      };
    default:
      return {
        label: "Good",
        color: "text-emerald-700",
        bg: "bg-emerald-50 border-emerald-200",
      };
  }
}

export default function SpeedTestingClientPage({
  initialData,
}: SpeedTestingClientPageProps) {
  const router = useRouter();
  const [data, setData] = useState<LandingPageSpeedData>(initialData);
  const [device, setDevice] = useState<"mobile" | "desktop">(
    initialData.latestTest?.device || "mobile",
  );
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [isTogglingWeekly, setIsTogglingWeekly] = useState(false);
  const [expandedOpportunityIds, setExpandedOpportunityIds] = useState<
    Record<string, boolean>
  >({});
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(
    initialData.latestTest?.id || null,
  );

  // User-configurable speed audit & methodology settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "methodology" | "engine" | "simulation" | "alerts"
  >("methodology");
  const [auditSettings, setAuditSettings] = useState<UserSpeedSettings>(
    DEFAULT_SPEED_SETTINGS,
  );
  const [tempSettings, setTempSettings] = useState<UserSpeedSettings>(
    DEFAULT_SPEED_SETTINGS,
  );
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyVerificationResult, setKeyVerificationResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // Load user settings from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("uprise_speed_audit_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setAuditSettings((prev) => ({ ...prev, ...parsed }));
        setTempSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleSaveSettings = () => {
    setAuditSettings(tempSettings);
    try {
      localStorage.setItem(
        "uprise_speed_audit_settings",
        JSON.stringify(tempSettings),
      );
      toast.success("Audit configuration and simulation settings saved!");
    } catch {
      toast.error("Failed to save settings to local storage.");
    }
    setIsSettingsOpen(false);
  };

  const handleVerifyApiKey = async () => {
    if (!tempSettings.apiKey.trim()) {
      toast.error("Please enter a Google PageSpeed API key first.");
      return;
    }
    try {
      setIsVerifyingKey(true);
      setKeyVerificationResult(null);
      const res = await verifyGooglePageSpeedApiKeyAction(tempSettings.apiKey);
      setKeyVerificationResult({
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        toast.success("Google PageSpeed API Key verified successfully!");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      setKeyVerificationResult({
        success: false,
        message: err.message || "Failed to verify API key.",
      });
      toast.error("Failed to verify API key.");
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const landingPage = data.landingPage;

  // Reactively switch between Mobile and Desktop views
  const handleDeviceChange = (newDevice: "mobile" | "desktop") => {
    setDevice(newDevice);
    const matching = data.history.find((h) => h.device === newDevice);
    if (matching) {
      setSelectedAuditId(matching.id);
    } else {
      setSelectedAuditId(null);
    }
  };

  // Select historical run from table
  const handleSelectHistory = (h: PageSpeedAuditResultWithMeta) => {
    setDevice(h.device);
    setSelectedAuditId(h.id);
  };

  // Determine active test matching the selected device
  const currentTest = React.useMemo(() => {
    if (selectedAuditId) {
      const found = data.history.find((h) => h.id === selectedAuditId);
      if (found && found.device === device) return found;
    }
    return data.history.find((h) => h.device === device) || null;
  }, [selectedAuditId, device, data.history]);

  // Toggle weekly automated check
  const handleToggleWeekly = async (checked: boolean) => {
    try {
      setIsTogglingWeekly(true);
      // Optimistic state
      setData((prev) => ({
        ...prev,
        landingPage: {
          ...prev.landingPage,
          weeklySpeedCheck: checked,
        },
      }));

      const res = await toggleWeeklySpeedCheckAction(landingPage.id, checked);
      if (!res.success) {
        // Revert
        setData((prev) => ({
          ...prev,
          landingPage: {
            ...prev.landingPage,
            weeklySpeedCheck: !checked,
          },
        }));
        toast.error(res.error || "Failed to update weekly check setting.");
      } else {
        toast.success(
          checked
            ? "Added to weekly automated check!"
            : "Removed from weekly automated check.",
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update weekly check.");
    } finally {
      setIsTogglingWeekly(false);
    }
  };

  // Run on-demand PageSpeed test with active configuration
  const handleRunSpeedTest = async () => {
    if (isRunningTest) return;
    try {
      setIsRunningTest(true);
      const engineLabel =
        auditSettings.engine === "google"
          ? "Google Cloud API"
          : auditSettings.engine === "edge"
            ? "Real-Time Edge Profiler"
            : "Auto Provider";

      toast.info(
        `Running speed audit (${device.toUpperCase()}) via ${engineLabel}...`,
      );

      const res = await runLandingPageSpeedTestAction(landingPage.id, device, {
        engine: auditSettings.engine,
        apiKey: auditSettings.apiKey,
        networkProfile: auditSettings.networkProfile,
        cpuThrottle: auditSettings.cpuThrottle,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Speed test failed. Please check your settings.");
        return;
      }

      const newTest = res.data;
      setData((prev) => ({
        ...prev,
        latestTest: newTest,
        history: [newTest, ...prev.history.filter((h) => h.id !== newTest.id)],
      }));
      setDevice(newTest.device);
      setSelectedAuditId(newTest.id);

      toast.success(
        `Audit completed! Score: ${newTest.performanceScore}/100 (${newTest.engineUsed || "Lighthouse Engine"})`,
      );
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsRunningTest(false);
    }
  };

  const toggleOpportunity = (id: string) => {
    setExpandedOpportunityIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scoreMeta = currentTest
    ? getScoreColor(currentTest.performanceScore)
    : null;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* TOP STICKY HEADER */}
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/lp-analysis?accountId=${landingPage.adAccountId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Landing Pages
            </Link>

            <div className="h-4 w-px bg-slate-200" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  {landingPage.campaignName}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold text-slate-600 bg-slate-50 border-slate-200"
                >
                  {landingPage.accountName}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <a
                  href={landingPage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
                >
                  {landingPage.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* ACTION BAR: WEEKLY TOGGLE & RUN TEST */}
          <div className="flex flex-wrap items-center gap-3">
            {/* WEEKLY CHECK TOGGLE CARD */}
            <div
              className={`flex items-center gap-3 px-3.5 py-1.5 rounded-lg border transition-all ${
                landingPage.weeklySpeedCheck
                  ? "bg-blue-50/80 border-blue-200/90 text-blue-950"
                  : "bg-slate-100/70 border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap
                  className={`h-4 w-4 ${
                    landingPage.weeklySpeedCheck
                      ? "text-blue-600 fill-blue-500"
                      : "text-slate-400"
                  }`}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-tight">
                    Add to weekly check
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium leading-none">
                    {landingPage.weeklySpeedCheck
                      ? "Weekly automated scan & alerts active"
                      : "Audit on-demand only"}
                  </span>
                </div>
              </div>
              <Switch
                checked={landingPage.weeklySpeedCheck}
                onCheckedChange={handleToggleWeekly}
                disabled={isTogglingWeekly}
                className="data-[state=checked]:bg-blue-600 ml-1"
              />
            </div>

            {/* DEVICE STRATEGY SELECTOR */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleDeviceChange("mobile")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  device === "mobile"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
              <button
                type="button"
                onClick={() => handleDeviceChange("desktop")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  device === "desktop"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Laptop className="h-3.5 w-3.5" /> Desktop
              </button>
            </div>

            {/* AUDIT SETTINGS & METHODOLOGY BUTTON */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTempSettings(auditSettings);
                setKeyVerificationResult(null);
                setIsSettingsOpen(true);
              }}
              className="h-9 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-xs gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
              Audit Settings & Methodology
            </Button>

            {/* RUN AUDIT BUTTON */}
            <Button
              onClick={handleRunSpeedTest}
              disabled={isRunningTest}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 shadow-xs px-4"
            >
              {isRunningTest ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Auditing Speed...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Run Speed Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT BODY */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!currentTest ? (
          /* EMPTY STATE FOR SELECTED DEVICE */
          <div className="space-y-8">
            <Card className="border-dashed border-2 border-slate-300 bg-white text-center py-16 px-6 gap-0 shadow-xs rounded-xl overflow-hidden">
              <CardContent className="max-w-md mx-auto space-y-4 p-0">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
                  {device === "mobile" ? (
                    <Smartphone className="h-7 w-7" />
                  ) : (
                    <Laptop className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    No {device === "mobile" ? "Mobile" : "Desktop"} Speed Test Run Yet
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Run a real-time {device} performance audit for{" "}
                    <strong>{landingPage.campaignName}</strong> to measure Core
                    Web Vitals on {device}.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleRunSpeedTest}
                    disabled={isRunningTest}
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md"
                  >
                    {isRunningTest ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Auditing ({device.toUpperCase()})...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Run {device === "mobile" ? "Mobile" : "Desktop"} Speed Test
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AUDIT HISTORY TABLE IF OTHER RUNS EXIST */}
            {data.history.length > 0 && (
              <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl gap-0 py-0 overflow-hidden">
                <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      Previous Speed Audits ({data.history.length})
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Select a past run to view detailed performance metrics
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>LCP</TableHead>
                        <TableHead>CLS</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.history.map((h) => {
                        const scoreM = getScoreColor(h.performanceScore);
                        return (
                          <TableRow
                            key={h.id}
                            className="text-xs hover:bg-slate-50/70"
                          >
                            <TableCell className="pl-6 text-slate-700">
                              {new Date(h.createdAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </TableCell>
                            <TableCell className="capitalize font-semibold">
                              {h.device}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${scoreM.bg} ${scoreM.text} ${scoreM.border}`}
                              >
                                {h.performanceScore} / 100
                              </Badge>
                            </TableCell>
                            <TableCell>{h.lcpDisplay || "N/A"}</TableCell>
                            <TableCell>{h.clsDisplay || "N/A"}</TableCell>
                            <TableCell>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {h.triggerSource.replace("_", " ")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                onClick={() => handleSelectHistory(h)}
                              >
                                View Insights
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* AUDIT RESULTS CONTENT */
          <>
            {/* HERO PERFORMANCE ROW */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* MAIN PERFORMANCE GAUGE CARD */}
              <Card className="md:col-span-4 bg-white border border-slate-200/90 shadow-xs rounded-xl overflow-hidden flex flex-col justify-between gap-0 py-0">
                <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-indigo-600" />
                      Performance Score
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CardDescription className="text-xs text-slate-500">
                        Lighthouse v11 model
                      </CardDescription>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsTab("methodology");
                          setIsSettingsOpen(true);
                        }}
                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Info className="h-3 w-3" /> Methodology
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold bg-white text-slate-600 border-slate-200 flex items-center gap-1"
                    >
                      {currentTest.engineUsed?.includes("Google") ? (
                        <>
                          <Cloud className="h-2.5 w-2.5 text-sky-500" /> Cloud API
                        </>
                      ) : (
                        <>
                          <Cpu className="h-2.5 w-2.5 text-indigo-500" /> Profiler
                        </>
                      )}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold tracking-wider bg-white border-slate-200"
                    >
                      {currentTest.device}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-6 text-center flex flex-col items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    {/* CIRCULAR BADGE DISPLAY */}
                    <div
                      className={`h-36 w-36 rounded-full flex flex-col items-center justify-center border-8 ${
                        scoreMeta?.border || "border-slate-200"
                      } ${scoreMeta?.bg || "bg-slate-50"} shadow-inner`}
                    >
                      <span
                        className={`text-4xl font-black tracking-tight ${
                          scoreMeta?.text || "text-slate-800"
                        }`}
                      >
                        {currentTest.performanceScore}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        / 100
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1">
                    <Badge
                      className={`font-bold px-2.5 py-0.5 text-xs ${
                        scoreMeta?.bg || ""
                      } ${scoreMeta?.text || ""} border ${
                        scoreMeta?.border || ""
                      }`}
                    >
                      {scoreMeta?.label}
                    </Badge>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Audited on{" "}
                      {new Date(currentTest.createdAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}{" "}
                      via {currentTest.triggerSource.replace("_", " ")}
                    </p>
                  </div>
                </CardContent>

                {/* CATEGORY SCORES FOOTER */}
                <div className="grid grid-cols-3 border-t border-slate-150 bg-slate-50/70 text-center py-3 px-2 text-xs">
                  <div className="border-r border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">
                      Accessibility
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {currentTest.accessibilityScore !== null &&
                      currentTest.accessibilityScore !== undefined
                        ? `${currentTest.accessibilityScore}`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="border-r border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold">
                      Best Practices
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {currentTest.bestPracticesScore !== null &&
                      currentTest.bestPracticesScore !== undefined
                        ? `${currentTest.bestPracticesScore}`
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold">
                      SEO
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {currentTest.seoScore !== null &&
                      currentTest.seoScore !== undefined
                        ? `${currentTest.seoScore}`
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </Card>

              {/* CORE WEB VITALS MATRIX (8 COLS) */}
              <Card className="md:col-span-8 bg-white border border-slate-200/90 shadow-xs rounded-xl gap-0 py-0 overflow-hidden">
                <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-600" />
                      Core Web Vitals & Key Timings
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Directly influences Google Ads Landing Page Experience & Quality Score
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{" "}
                    Good (&le; 2.5s)
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500 ml-2" />{" "}
                    Needs Work
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500 ml-2" />{" "}
                    Poor (&gt; 4s)
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. LCP */}
                    {(() => {
                      const st = getMetricStatus("LCP", currentTest.lcpMs);
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Largest Contentful Paint (LCP)
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.lcpDisplay ||
                                (currentTest.lcpMs
                                  ? `${(currentTest.lcpMs / 1000).toFixed(1)} s`
                                  : "N/A")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 2.5s. Main visual element rendering
                            time.
                          </p>
                        </div>
                      );
                    })()}

                    {/* 2. INP / TBT */}
                    {(() => {
                      const st = getMetricStatus("INP", currentTest.inpMs);
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Interaction to Next Paint (INP)
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.inpDisplay ||
                                (currentTest.inpMs
                                  ? `${currentTest.inpMs} ms`
                                  : "N/A")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 200ms. UI response latency on tap /
                            click.
                          </p>
                        </div>
                      );
                    })()}

                    {/* 3. CLS */}
                    {(() => {
                      const st = getMetricStatus(
                        "CLS",
                        null,
                        currentTest.clsScore,
                      );
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Cumulative Layout Shift (CLS)
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.clsDisplay ||
                                currentTest.clsScore?.toString() ||
                                "0.0"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 0.1. Visual stability & layout jumping.
                          </p>
                        </div>
                      );
                    })()}

                    {/* 4. FCP */}
                    {(() => {
                      const st = getMetricStatus("FCP", currentTest.fcpMs);
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              First Contentful Paint (FCP)
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.fcpDisplay ||
                                (currentTest.fcpMs
                                  ? `${(currentTest.fcpMs / 1000).toFixed(1)} s`
                                  : "N/A")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 1.8s. Time until first text or image
                            appears.
                          </p>
                        </div>
                      );
                    })()}

                    {/* 5. TTFB */}
                    {(() => {
                      const st = getMetricStatus("TTFB", currentTest.ttfbMs);
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Time to First Byte (TTFB)
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.ttfbDisplay ||
                                (currentTest.ttfbMs
                                  ? `${currentTest.ttfbMs} ms`
                                  : "N/A")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 800ms. Server response & host latency.
                          </p>
                        </div>
                      );
                    })()}

                    {/* 6. Speed Index */}
                    {(() => {
                      const st = getMetricStatus(
                        "SpeedIndex",
                        currentTest.speedIndexMs,
                      );
                      return (
                        <div
                          className={`p-4 rounded-xl border ${st.bg} flex flex-col justify-between min-h-[140px] shadow-xs`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-800">
                              Speed Index
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0 border ${st.color} bg-white/80`}
                            >
                              {st.label}
                            </Badge>
                          </div>
                          <div className="my-2">
                            <span
                              className={`text-2xl font-black tracking-tight ${st.color}`}
                            >
                              {currentTest.speedIndexDisplay ||
                                (currentTest.speedIndexMs
                                  ? `${(currentTest.speedIndexMs / 1000).toFixed(1)} s`
                                  : "N/A")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal pt-1">
                            Target &le; 3.4s. Visual progression during page
                            load.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RESOURCE WEIGHTS & DIAGNOSTICS */}
            {currentTest.diagnostics && (
              <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl gap-0 py-0 overflow-hidden">
                <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-600" />
                      Payload & Resource Weight Breakdown
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Total transfer size:{" "}
                      <strong className="text-slate-800">
                        {formatBytes(currentTest.totalByteWeight)}
                      </strong>
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        JavaScript
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.jsBytes)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Images
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.imageBytes)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Stylesheets
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.cssBytes)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Web Fonts
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.fontBytes)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        HTML Document
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.htmlBytes)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        3rd-Party Tags
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {formatBytes(currentTest.diagnostics.thirdPartyBytes)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* HIGH-IMPACT OPTIMIZATION OPPORTUNITIES */}
            <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl gap-0 py-0 overflow-hidden">
              <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Top Speed Opportunities & Fixes
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Ranked by estimated load time and payload reduction
                  </CardDescription>
                </div>
                {currentTest.opportunities && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-bold text-slate-700"
                  >
                    {currentTest.opportunities.length} Improvements Identified
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-6 divide-y divide-slate-100">
                {currentTest.opportunities &&
                currentTest.opportunities.length > 0 ? (
                  currentTest.opportunities.map((opp: any) => {
                    const isExpanded = !!expandedOpportunityIds[opp.id];
                    return (
                      <div key={opp.id} className="py-4 first:pt-0 last:pb-0">
                        <div
                          onClick={() => toggleOpportunity(opp.id)}
                          className="flex items-start justify-between cursor-pointer group hover:bg-slate-50/60 p-2.5 rounded-lg transition-colors -mx-2.5"
                        >
                          <div className="flex items-start gap-3">
                            <button className="text-slate-400 group-hover:text-slate-700 mt-0.5">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {opp.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 max-w-2xl">
                                {opp.description.replace(/\[.*?\]\(.*?\)/g, "")}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            {opp.wastedMs ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border-rose-200"
                              >
                                Save ~{(opp.wastedMs / 1000).toFixed(2)}s
                              </Badge>
                            ) : opp.wastedBytes ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border-amber-200"
                              >
                                Save ~{formatBytes(opp.wastedBytes)}
                              </Badge>
                            ) : opp.displayValue ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold text-slate-600 bg-slate-50"
                              >
                                {opp.displayValue}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        {/* EXPANDED OFFENDING URLS / ASSETS */}
                        {isExpanded && opp.items && opp.items.length > 0 && (
                          <div className="mt-3 ml-7 mr-2 p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Offending Assets / Requests
                            </span>
                            <div className="space-y-2 divide-y divide-slate-200/60">
                              {opp.items.map((sub: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="pt-2 first:pt-0 flex items-center justify-between text-xs gap-4"
                                >
                                  <span className="font-mono text-[11px] text-slate-700 truncate max-w-xl">
                                    {sub.url || sub.node || "Inline Resource"}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 text-[10px] font-semibold text-slate-500">
                                    {sub.wastedBytes && (
                                      <span>
                                        {formatBytes(sub.wastedBytes)}
                                      </span>
                                    )}
                                    {sub.wastedMs && (
                                      <span>{sub.wastedMs} ms</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                    Great job! No major high-impact performance bottlenecks
                    detected.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AUDIT HISTORY TABLE */}
            {data.history.length > 0 && (
              <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl gap-0 py-0 overflow-hidden">
                <CardHeader className="p-4 px-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between [.border-b]:pb-4 gap-0">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                      Speed Audit History ({data.history.length})
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Historical speed scans for this campaign landing page
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>LCP</TableHead>
                        <TableHead>CLS</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.history.map((h) => {
                        const isSelected = currentTest?.id === h.id;
                        const scoreM = getScoreColor(h.performanceScore);
                        return (
                          <TableRow
                            key={h.id}
                            className={`text-xs ${
                              isSelected
                                ? "bg-indigo-50/40 font-semibold"
                                : "hover:bg-slate-50/70"
                            }`}
                          >
                            <TableCell className="pl-6 text-slate-700">
                              {new Date(h.createdAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </TableCell>
                            <TableCell className="capitalize font-medium">
                              {h.device}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${scoreM.bg} ${scoreM.text} ${scoreM.border}`}
                              >
                                {h.performanceScore} / 100
                              </Badge>
                            </TableCell>
                            <TableCell>{h.lcpDisplay || "N/A"}</TableCell>
                            <TableCell>{h.clsDisplay || "N/A"}</TableCell>
                            <TableCell>
                              <span className="text-[10px] font-semibold text-slate-500">
                                {h.triggerSource.replace("_", " ")}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {isSelected ? (
                                <span className="text-[10px] text-indigo-600 font-bold">
                                  Currently Viewing
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                  onClick={() => handleSelectHistory(h)}
                                >
                                  View Insights
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* AUDIT SETTINGS & METHODOLOGY TRANSPARENCY MODAL */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white rounded-2xl gap-0 shadow-2xl border border-slate-200">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Speed Audit Settings & Simulation Parameters
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Complete transparency into scoring formulas, hardware emulation, and provider keys.
                </DialogDescription>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-slate-200/60 border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSettingsTab("methodology")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                  settingsTab === "methodology"
                    ? "bg-white text-indigo-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📊 Methodology & Weights
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("engine")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                  settingsTab === "engine"
                    ? "bg-white text-indigo-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ☁️ Engine & API Key
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("simulation")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                  settingsTab === "simulation"
                    ? "bg-white text-indigo-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⚙️ Simulation & Throttle
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("alerts")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                  settingsTab === "alerts"
                    ? "bg-white text-indigo-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🔔 Health Thresholds
              </button>
            </div>
          </DialogHeader>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            {/* TAB 1: METHODOLOGY & WEIGHTS */}
            {settingsTab === "methodology" && (
              <div className="space-y-4">
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-900 text-sm">
                    <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                    How Uprise Computes Speed Scores
                  </div>
                  <p className="leading-relaxed text-indigo-800">
                    Scores use the official <strong>Google Lighthouse v10/v11 log-normal distribution curves</strong>. 
                    Rather than arbitrary linear tiers, raw metric times (ms) are evaluated via complementary error functions (erfc) 
                    against industry-calibrated p10 and median control points.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Official Metric Weighting Distribution
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-600">
                          <TableHead className="pl-4">Core Web Vital</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Target (Good / Needs Impr.)</TableHead>
                          <TableHead>What It Measures</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        <TableRow>
                          <TableCell className="pl-4 font-bold text-indigo-950">
                            Total Blocking Time (TBT / INP)
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold">
                              30%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            &le; 200 ms / 600 ms
                          </TableCell>
                          <TableCell className="text-slate-500">
                            Main-thread CPU delay from heavy tracking scripts (GTM, Meta, CallRail).
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="pl-4 font-bold text-indigo-950">
                            Largest Contentful Paint (LCP)
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-bold">
                              25%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            &le; 2.5 s / 4.0 s
                          </TableCell>
                          <TableCell className="text-slate-500">
                            Render time of the main hero element or headline image.
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="pl-4 font-bold text-indigo-950">
                            Cumulative Layout Shift (CLS)
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold">
                              25%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            &le; 0.10 / 0.25
                          </TableCell>
                          <TableCell className="text-slate-500">
                            Visual jumpiness caused by unsized images or dynamically injected widgets.
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="pl-4 font-bold text-indigo-950">
                            First Contentful Paint (FCP)
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-slate-100 text-slate-800 border-slate-200 font-bold">
                              10%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            &le; 1.8 s / 3.0 s
                          </TableCell>
                          <TableCell className="text-slate-500">
                            Initial server response & critical stylesheet download speed.
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="pl-4 font-bold text-indigo-950">
                            Speed Index (SI)
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-slate-100 text-slate-800 border-slate-200 font-bold">
                              10%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            &le; 3.4 s / 5.8 s
                          </TableCell>
                          <TableCell className="text-slate-500">
                            Visual progression and pixel fill rate across viewport.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                  💡 <strong>Mobile vs Desktop Realism</strong>: Mobile profiles simulate a standard 4G network (1.63 Mbps, 150ms roundtrip) 
                  and 4x CPU slowdown factor (emulating a mid-range Moto G4 device). This matches Google Ads Landing Page Experience grading criteria.
                </div>
              </div>
            )}

            {/* TAB 2: ENGINE & API KEY */}
            {settingsTab === "engine" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-900">
                    Execution Engine Strategy
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setTempSettings((prev) => ({ ...prev, engine: "auto" }))
                      }
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        tempSettings.engine === "auto"
                          ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Auto (Hybrid)
                        </span>
                        {tempSettings.engine === "auto" && (
                          <Check className="h-3.5 w-3.5 text-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Uses Google Cloud API if key is present; falls back to Edge Profiler seamlessly.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTempSettings((prev) => ({
                          ...prev,
                          engine: "google",
                        }))
                      }
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        tempSettings.engine === "google"
                          ? "bg-sky-50/70 border-sky-500 ring-2 ring-sky-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Google API Only
                        </span>
                        {tempSettings.engine === "google" && (
                          <Check className="h-3.5 w-3.5 text-sky-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Directly queries Google PageSpeed Insights API servers. Requires active API key.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTempSettings((prev) => ({ ...prev, engine: "edge" }))
                      }
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        tempSettings.engine === "edge"
                          ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Edge Profiler
                        </span>
                        {tempSettings.engine === "edge" && (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        Real-time Lighthouse v11 engine. Zero Google API rate limits or quota caps.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-slate-500" />
                        Custom Google PageSpeed API Key
                      </Label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Optional. If left blank, server defaults or the local Edge Profiler will be used.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="AIzaSy..."
                      value={tempSettings.apiKey}
                      onChange={(e) => {
                        setTempSettings((prev) => ({
                          ...prev,
                          apiKey: e.target.value,
                        }));
                        setKeyVerificationResult(null);
                      }}
                      className="text-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleVerifyApiKey}
                      disabled={isVerifyingKey || !tempSettings.apiKey.trim()}
                      className="shrink-0 h-9 text-xs font-semibold cursor-pointer"
                    >
                      {isVerifyingKey ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Key"
                      )}
                    </Button>
                  </div>

                  {keyVerificationResult && (
                    <div
                      className={`text-xs p-3 rounded-xl border flex items-center gap-2 ${
                        keyVerificationResult.success
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {keyVerificationResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <span>{keyVerificationResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: HARDWARE & NETWORK SIMULATION */}
            {settingsTab === "simulation" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-900">
                    Mobile Network Latency & Throughput Profile
                  </Label>
                  <div className="space-y-2">
                    {[
                      {
                        id: "standard_4g",
                        label: "Standard 4G (Google Lighthouse Default)",
                        desc: "1.63 Mbps throughput, 150ms roundtrip latency. Matches Google Ads grading.",
                      },
                      {
                        id: "fast_4g",
                        label: "Fast 4G / 5G Mobile",
                        desc: "10 Mbps throughput, 40ms roundtrip latency. Emulates top-tier urban cellular networks.",
                      },
                      {
                        id: "unthrottled",
                        label: "Unthrottled Broadband",
                        desc: "Direct network throughput with zero artificial transfer delays.",
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setTempSettings((prev) => ({
                            ...prev,
                            networkProfile: item.id as any,
                          }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          tempSettings.networkProfile === item.id
                            ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500/20"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                        {tempSettings.networkProfile === item.id && (
                          <Check className="h-4 w-4 text-indigo-600 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <Label className="text-xs font-bold text-slate-900">
                    Mobile CPU Throttling Factor
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        id: "4x",
                        label: "4× Slowdown",
                        desc: "Lighthouse baseline (Moto G4)",
                      },
                      {
                        id: "2x",
                        label: "2× Slowdown",
                        desc: "Modern mid-range phone",
                      },
                      {
                        id: "1x",
                        label: "1× (No Throttle)",
                        desc: "Full host CPU power",
                      },
                    ].map((cpu) => (
                      <button
                        key={cpu.id}
                        type="button"
                        onClick={() =>
                          setTempSettings((prev) => ({
                            ...prev,
                            cpuThrottle: cpu.id as any,
                          }))
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          tempSettings.cpuThrottle === cpu.id
                            ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500/20"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {cpu.label}
                          </span>
                          {tempSettings.cpuThrottle === cpu.id && (
                            <Check className="h-3.5 w-3.5 text-indigo-600" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">
                          {cpu.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ALERT THRESHOLDS */}
            {settingsTab === "alerts" && (
              <div className="space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600">
                  Configure health alert triggers for weekly automated scans. If an audit falls below these limits, an automated triage alert is flagged.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-900">
                      Min Performance Score
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={tempSettings.minScoreAlert}
                      onChange={(e) =>
                        setTempSettings((prev) => ({
                          ...prev,
                          minScoreAlert: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-500">Alert if score &lt; {tempSettings.minScoreAlert}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-900">
                      Max LCP Target (Seconds)
                    </Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={10}
                      value={tempSettings.maxLcpAlert}
                      onChange={(e) =>
                        setTempSettings((prev) => ({
                          ...prev,
                          maxLcpAlert: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-500">Alert if LCP &gt; {tempSettings.maxLcpAlert}s</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-900">
                      Max TTFB Target (ms)
                    </Label>
                    <Input
                      type="number"
                      step={50}
                      min={100}
                      max={3000}
                      value={tempSettings.maxTtfbAlert}
                      onChange={(e) =>
                        setTempSettings((prev) => ({
                          ...prev,
                          maxTtfbAlert: Number(e.target.value) || 0,
                        }))
                      }
                      className="text-xs"
                    />
                    <p className="text-[10px] text-slate-500">Alert if TTFB &gt; {tempSettings.maxTtfbAlert}ms</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTempSettings(DEFAULT_SPEED_SETTINGS);
                toast.info("Reset to default Lighthouse v11 parameters.");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Reset to Defaults
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs px-4 cursor-pointer"
              >
                Save & Apply Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
