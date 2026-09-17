"use client";

import {
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  HeartPulse,
  Mail,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { triggerManualQueueTestAction } from "@/actions/automation.actions";
import { sendMorningBriefingAction } from "@/actions/briefing.actions";
import { saveBriefingSettingsAction } from "@/actions/briefing-settings.actions";
import {
  type ClientReportAccountItem,
  type ClientReportAutomationOverview,
  toggleClientScheduleActiveAction,
  toggleGlobalClientReportAction,
} from "@/actions/client-report-automation.actions";
import {
  saveWeeklyClientReportSettingsAction,
  sendWeeklyClientReportAction,
  type WeeklyClientReportSettingsData,
} from "@/actions/weekly-client-report.actions";
import { ReportAutomationTrigger } from "@/components/reportAutomationTrigger";
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
import { TopProgressBar } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface BriefingSettingsData {
  id: number | null;
  isActive: boolean;
  onlyActiveAccounts: boolean;
  sendTime: string;
  recipients: string[];
  dataPoints: {
    spend: boolean;
    conversions: boolean;
    cpa: boolean;
    clicks: boolean;
    impressions: boolean;
    ctr: boolean;
    cpc: boolean;
    anomalies: boolean;
    whaleAnalysis: boolean;
  };
}

interface ReportsClientProps {
  initialSettings: BriefingSettingsData | null;
  initialWeeklySettings: WeeklyClientReportSettingsData | null;
  initialClientReportOverview: ClientReportAutomationOverview | null;
  teamMembers: TeamMember[];
}

export default function ReportsClient({
  initialSettings,
  initialWeeklySettings,
  initialClientReportOverview,
  teamMembers,
}: ReportsClientProps) {
  // Tab state: "daily_briefing" | "weekly_client_report" | "client_reports"
  const [activeTab, setActiveTab] = useState<
    "daily_briefing" | "weekly_client_report" | "client_reports"
  >("daily_briefing");

  // 1. Daily Morning Briefing State
  const [settings, setSettings] = useState<BriefingSettingsData>(
    initialSettings || {
      id: null,
      isActive: true,
      onlyActiveAccounts: true,
      sendTime: "07:00",
      recipients: teamMembers.map((u) => u.email).filter(Boolean),
      dataPoints: {
        spend: true,
        conversions: true,
        cpa: true,
        clicks: true,
        impressions: true,
        ctr: true,
        cpc: true,
        anomalies: true,
        whaleAnalysis: true,
      },
    },
  );

  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 2. Weekly Client Report State
  const [weeklySettings, setWeeklySettings] =
    useState<WeeklyClientReportSettingsData>(
      initialWeeklySettings || {
        id: null,
        isActive: true,
        sendDayOfWeek: "monday",
        sendTime: "08:00",
        recipients: teamMembers.map((u) => u.email).filter(Boolean),
        includeRiskWatchlist: true,
        includePerformanceMetrics: true,
        includeSentimentPrompt: true,
      },
    );

  const [newWeeklyEmail, setNewWeeklyEmail] = useState("");
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);
  const [isSendingWeekly, setIsSendingWeekly] = useState(false);

  // Save Daily Briefing configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading("Saving briefing automation settings...");
    try {
      const res = await saveBriefingSettingsAction(settings);
      if (res.success) {
        toast.success("Briefing automation settings saved successfully!", {
          id: toastId,
        });
      } else {
        toast.error(res.error || "Failed to save settings.", { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test send Daily Briefing immediately
  const handleSendNow = async () => {
    setIsSending(true);
    const toastId = toast.loading(
      "Aggregating metrics and dispatching briefing...",
    );
    try {
      const res = await sendMorningBriefingAction();
      if (res.success) {
        toast.success(
          res.message || "Briefing sent to configured recipients!",
          { id: toastId },
        );
      } else {
        toast.error(res.error || "Failed to send briefing.", { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Toggle a data point include setting
  const toggleDataPoint = (key: keyof BriefingSettingsData["dataPoints"]) => {
    setSettings((prev) => ({
      ...prev,
      dataPoints: {
        ...prev.dataPoints,
        [key]: !prev.dataPoints[key],
      },
    }));
  };

  // Toggle team recipient selection
  const toggleTeamRecipient = (email: string) => {
    setSettings((prev) => {
      const isSelected = prev.recipients.includes(email);
      const updated = isSelected
        ? prev.recipients.filter((e) => e !== email)
        : [...prev.recipients, email];
      return { ...prev, recipients: updated };
    });
  };

  // Add external/custom email tag
  const handleAddEmail = () => {
    const clean = newEmail.trim().toLowerCase();
    if (!clean) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (settings.recipients.includes(clean)) {
      toast.error("Email is already in the recipient list.");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      recipients: [...prev.recipients, clean],
    }));
    setNewEmail("");
    toast.success(`Added ${clean} to recipients.`);
  };

  // Remove email tag
  const handleRemoveEmail = (email: string) => {
    setSettings((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((e) => e !== email),
    }));
  };

  // ── Weekly Client Report Handlers ──
  const handleSaveWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWeekly(true);
    const toastId = toast.loading("Saving weekly client report settings...");
    try {
      const res = await saveWeeklyClientReportSettingsAction(weeklySettings);
      if (res.success) {
        toast.success("Weekly client report settings saved successfully!", {
          id: toastId,
        });
      } else {
        toast.error(res.error || "Failed to save weekly report settings.", {
          id: toastId,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsSavingWeekly(false);
    }
  };

  const handleSendWeeklyNow = async () => {
    setIsSendingWeekly(true);
    const toastId = toast.loading(
      "Aggregating active clients and dispatching weekly report...",
    );
    try {
      const res = await sendWeeklyClientReportAction();
      if (res.success) {
        toast.success(
          res.message ||
            "Weekly client report sent to all configured team members!",
          { id: toastId },
        );
      } else {
        toast.error(res.error || "Failed to send weekly client report.", {
          id: toastId,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An unexpected error occurred.", {
        id: toastId,
      });
    } finally {
      setIsSendingWeekly(false);
    }
  };

  const toggleWeeklyTeamRecipient = (email: string) => {
    setWeeklySettings((prev) => {
      const isSelected = prev.recipients.includes(email);
      const updated = isSelected
        ? prev.recipients.filter((e) => e !== email)
        : [...prev.recipients, email];
      return { ...prev, recipients: updated };
    });
  };

  const handleAddWeeklyEmail = () => {
    const clean = newWeeklyEmail.trim().toLowerCase();
    if (!clean) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (weeklySettings.recipients.includes(clean)) {
      toast.error("Email is already in the recipient list.");
      return;
    }

    setWeeklySettings((prev) => ({
      ...prev,
      recipients: [...prev.recipients, clean],
    }));
    setNewWeeklyEmail("");
    toast.success(`Added ${clean} to weekly report recipients.`);
  };

  const handleRemoveWeeklyEmail = (email: string) => {
    setWeeklySettings((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((e) => e !== email),
    }));
  };

  // ── Automated Client Reports State & Handlers ──
  const [clientReportOverview, setClientReportOverview] =
    useState<ClientReportAutomationOverview | null>(
      initialClientReportOverview,
    );
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<
    "all" | "active" | "paused" | "unscheduled"
  >("all");
  const [isTogglingGlobal, setIsTogglingGlobal] = useState(false);
  const [togglingScheduleId, setTogglingScheduleId] = useState<number | null>(
    null,
  );
  const [testingScheduleId, setTestingScheduleId] = useState<number | null>(
    null,
  );

  const handleToggleGlobal = async (checked: boolean) => {
    setIsTogglingGlobal(true);
    setClientReportOverview((prev) =>
      prev ? { ...prev, isGloballyActive: checked } : prev,
    );

    try {
      const res = await toggleGlobalClientReportAction(checked);
      if (res.success) {
        toast.success(
          checked
            ? "Automated client report sending is enabled"
            : "Automated client report sending is globally paused",
        );
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setClientReportOverview((prev) =>
        prev ? { ...prev, isGloballyActive: !checked } : prev,
      );
      toast.error(err.message || "Failed to update global status");
    } finally {
      setIsTogglingGlobal(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: number, checked: boolean) => {
    setTogglingScheduleId(scheduleId);
    setClientReportOverview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        summary: {
          ...prev.summary,
          activeSchedules: checked
            ? prev.summary.activeSchedules + 1
            : Math.max(0, prev.summary.activeSchedules - 1),
          pausedSchedules: !checked
            ? prev.summary.pausedSchedules + 1
            : Math.max(0, prev.summary.pausedSchedules - 1),
        },
        items: prev.items.map((item) =>
          item.scheduleId === scheduleId
            ? { ...item, isActive: checked }
            : item,
        ),
      };
    });

    try {
      const res = await toggleClientScheduleActiveAction(scheduleId, checked);
      if (res.success) {
        toast.success(
          checked ? "Client schedule resumed" : "Client schedule paused",
        );
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setClientReportOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            activeSchedules: !checked
              ? prev.summary.activeSchedules + 1
              : Math.max(0, prev.summary.activeSchedules - 1),
            pausedSchedules: checked
              ? prev.summary.pausedSchedules + 1
              : Math.max(0, prev.summary.pausedSchedules - 1),
          },
          items: prev.items.map((item) =>
            item.scheduleId === scheduleId
              ? { ...item, isActive: !checked }
              : item,
          ),
        };
      });
      toast.error(err.message || "Failed to toggle schedule");
    } finally {
      setTogglingScheduleId(null);
    }
  };

  const handleTriggerTest = async (item: ClientReportAccountItem) => {
    if (!item.scheduleId) return;
    setTestingScheduleId(item.scheduleId);
    const toastId = toast.loading(
      `Sending test report for ${item.accountName}...`,
    );

    try {
      const res = await triggerManualQueueTestAction({
        scheduleId: item.scheduleId,
        googleAccountId: item.googleAccountId,
        clientName: item.accountName,
        isTest: true,
      });

      if (res.success) {
        toast.success(
          `Test report sent to ${item.recipientEmail || "client"}`,
          { id: toastId },
        );
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test report", { id: toastId });
    } finally {
      setTestingScheduleId(null);
    }
  };

  const filteredClientItems = useMemo(() => {
    if (!clientReportOverview?.items) return [];
    return clientReportOverview.items.filter((item) => {
      // 1. Status Filter
      if (clientFilter === "active" && (!item.hasSchedule || !item.isActive)) {
        return false;
      }
      if (clientFilter === "paused" && (!item.hasSchedule || item.isActive)) {
        return false;
      }
      if (clientFilter === "unscheduled" && item.hasSchedule) {
        return false;
      }

      // 2. Search Filter
      if (clientSearch.trim()) {
        const query = clientSearch.toLowerCase();
        const nameMatch = item.accountName.toLowerCase().includes(query);
        const idMatch = item.googleAccountId.toLowerCase().includes(query);
        const emailMatch = (item.recipientEmail || "")
          .toLowerCase()
          .includes(query);
        return nameMatch || idMatch || emailMatch;
      }

      return true;
    });
  }, [clientReportOverview?.items, clientFilter, clientSearch]);

  return (
    <div className="space-y-8 md:p-8 max-w-6xl mx-auto relative">
      <TopProgressBar
        loading={isSending || isSaving || isSendingWeekly || isSavingWeekly}
        color="indigo"
      />

      {/* Header & Main Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Settings className="h-7 w-7 text-indigo-600 animate-spin-slow" />{" "}
              Report Automation
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure and manage agency-wide automated email reports,
              schedules, and targets.
            </p>
          </div>

          {activeTab === "daily_briefing" ? (
            <Button
              onClick={handleSendNow}
              disabled={isSaving}
              loading={isSending}
              loadingText="Dispatching..."
              variant="outline"
              className="w-full md:w-auto bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 shadow-xs cursor-pointer font-semibold"
            >
              <Sparkles className="h-4 w-4 mr-2 text-indigo-600" /> Send
              Briefing Now
            </Button>
          ) : (
            <Button
              onClick={handleSendWeeklyNow}
              disabled={isSavingWeekly}
              loading={isSendingWeekly}
              loadingText="Dispatching Weekly Report..."
              variant="outline"
              className="w-full md:w-auto bg-gradient-to-r from-violet-50 to-indigo-50 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-violet-100 shadow-xs cursor-pointer font-semibold"
            >
              <Send className="h-4 w-4 mr-2 text-indigo-600" /> Send Weekly
              Report Now
            </Button>
          )}
        </div>

        {/* Report Selector Pills */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("daily_briefing")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "daily_briefing"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            ☀️ Daily Morning Briefing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("weekly_client_report")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "weekly_client_report"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />📊 Weekly
            Client Retention Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("client_reports")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === "client_reports"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
            )}
          >
            <FileText className="h-3.5 w-3.5 text-indigo-600" />📑 Automated
            Client Reports
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: DAILY MORNING BRIEFING                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "daily_briefing" && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Quick Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div
                className={`absolute top-0 left-0 w-full h-1.5 ${settings.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
              ></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Briefing Engine Status
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  {settings.isActive ? (
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping absolute inline-flex"></span>
                      <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1.5">
                      Paused
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  {settings.isActive
                    ? `Scheduled to run daily at ${settings.sendTime} Melbourne time.`
                    : "Daily automated runs are currently paused."}
                </p>
              </CardContent>
            </Card>

            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Recipient Count
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />{" "}
                  {settings.recipients.length} configured
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Includes active team members plus custom external email
                  targets.
                </p>
              </CardContent>
            </Card>

            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Active Data Points
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-800">
                  {Object.values(settings.dataPoints).filter(Boolean).length} /
                  9 enabled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Controls which key metrics are sent to Gemini to generate the
                  briefing.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Config Form Grid */}
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left/Middle Column (Recipients & Schedule) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Schedule Card */}
              <Card className="py-6 shadow-xs border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                    <Clock className="h-5 w-5 text-indigo-500" /> Schedule
                    settings
                  </CardTitle>
                  <CardDescription>
                    Configure when the automated daily morning briefing should
                    run.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* IsActive Switch */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        Enable Daily Morning Briefing
                      </h4>
                      <p className="text-xs text-slate-500">
                        Automatically compile and email yesterday's performance
                        report daily.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.isActive}
                        onChange={() =>
                          setSettings((prev) => ({
                            ...prev,
                            isActive: !prev.isActive,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Only Active Accounts Switch */}
                  <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        Only Include Active Accounts
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Exclude delinked and inactive accounts from report
                        totals, daily morning briefings, and portfolio metrics.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.onlyActiveAccounts}
                        onChange={() =>
                          setSettings((prev) => ({
                            ...prev,
                            onlyActiveAccounts: !prev.onlyActiveAccounts,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Time input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Send Time of Day
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="time"
                        value={settings.sendTime}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            sendTime: e.target.value,
                          }))
                        }
                        className="w-36 font-mono text-sm bg-slate-50 border-slate-200"
                      />
                      <span className="text-xs text-slate-400">
                        Australia/Melbourne Time (AEST)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recipients Card */}
              <Card className="py-6 shadow-xs border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                    <Mail className="h-5 w-5 text-indigo-500" /> Briefing
                    Recipients
                  </CardTitle>
                  <CardDescription>
                    Manage who will receive the daily morning briefing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Agency team list toggle */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Agency Team Members
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {teamMembers.map((member) => {
                        const isSelected = settings.recipients.includes(
                          member.email,
                        );
                        return (
                          <div
                            key={member.id}
                            onClick={() => toggleTeamRecipient(member.email)}
                            className={`flex items-center justify-between p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-indigo-50/60 border-indigo-200 text-indigo-950 font-medium"
                                : "bg-slate-50/40 border-slate-100 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="block truncate font-semibold text-slate-900">
                                {member.name}
                              </span>
                              <span className="block text-xs text-slate-500 truncate">
                                {member.email}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom External Emails */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      External Email Recipients
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="client.executive@company.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="bg-slate-50 border-slate-200 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddEmail();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleAddEmail}
                        variant="secondary"
                        className="cursor-pointer"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>

                    {/* Tag list */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {settings.recipients.map((email) => {
                        const isTeam = teamMembers.some(
                          (tm) => tm.email === email,
                        );
                        return (
                          <span
                            key={email}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                              isTeam
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column (Data Points selection) */}
            <div>
              <Card className="py-6 shadow-xs border-slate-200 bg-white sticky top-6">
                <CardHeader>
                  <CardTitle className="text-slate-800 text-lg font-bold">
                    Metrics & Data Points
                  </CardTitle>
                  <CardDescription>
                    Select which performance sections and stats to include in
                    the briefing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      key: "spend",
                      label: "Spend Total",
                      desc: "Yesterday's portfolio cash spend",
                    },
                    {
                      key: "conversions",
                      label: "Conversions Total",
                      desc: "Total conversion volume",
                    },
                    {
                      key: "cpa",
                      label: "Blended CPA",
                      desc: "Portfolio blended cost-per-acquisition",
                    },
                    {
                      key: "clicks",
                      label: "Clicks",
                      desc: "Raw total traffic click counts",
                    },
                    {
                      key: "impressions",
                      label: "Impressions",
                      desc: "Total view counts",
                    },
                    {
                      key: "ctr",
                      label: "CTR %",
                      desc: "Click-through rate metrics",
                    },
                    {
                      key: "cpc",
                      label: "CPC",
                      desc: "Cost-per-click averages",
                    },
                    {
                      key: "anomalies",
                      label: "Attention & Anomalies",
                      desc: "Highlights critical fires / spend anomalies",
                    },
                    {
                      key: "whaleAnalysis",
                      label: "Whale Analysis",
                      desc: "Compares blended vs long-tail CPAs",
                    },
                  ].map((dp) => {
                    const isChecked =
                      settings.dataPoints[
                        dp.key as keyof BriefingSettingsData["dataPoints"]
                      ];
                    return (
                      <button
                        type="button"
                        key={dp.key}
                        onClick={() =>
                          toggleDataPoint(
                            dp.key as keyof BriefingSettingsData["dataPoints"],
                          )
                        }
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all w-full ${
                          isChecked
                            ? "bg-slate-50/50 border-slate-200"
                            : "bg-white border-slate-100 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <span className="pt-0.5 shrink-0 block">
                          {isChecked ? (
                            <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-slate-300" />
                          )}
                        </span>
                        <span className="block">
                          <span className="text-sm font-semibold text-slate-800 block">
                            {dp.label}
                          </span>
                          <span className="text-[11px] text-slate-500 leading-tight mt-0.5 block">
                            {dp.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}

                  {/* Submit Save Button */}
                  <Button
                    type="submit"
                    disabled={isSending}
                    loading={isSaving}
                    loadingText="Saving Settings..."
                    className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-md h-11 cursor-pointer"
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Automation Rule
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: WEEKLY CLIENT RETENTION REPORT                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "weekly_client_report" && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Quick Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div
                className={`absolute top-0 left-0 w-full h-1.5 ${weeklySettings.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
              ></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Weekly Report Status
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  {weeklySettings.isActive ? (
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping absolute inline-flex"></span>
                      <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1.5">
                      Paused
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  {weeklySettings.isActive
                    ? `Scheduled every ${weeklySettings.sendDayOfWeek.toUpperCase()} at ${weeklySettings.sendTime} AEST.`
                    : "Automated weekly runs are currently paused."}
                </p>
              </CardContent>
            </Card>

            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Target Team Recipients
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />{" "}
                  {weeklySettings.recipients.length} configured
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Team members receiving the weekly client digest & sentiment
                  invite.
                </p>
              </CardContent>
            </Card>

            <Card className="py-6 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-violet-500"></div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Retention Scoring Goal
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-indigo-600" />
                  Standup Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Prompts staff to review clients and submit notes before
                  morning standup.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Report Config Form */}
          <form
            onSubmit={handleSaveWeekly}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column (Schedule & Recipients) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Schedule Settings Card */}
              <Card className="py-6 shadow-xs border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                    <Calendar className="h-5 w-5 text-indigo-500" /> Weekly
                    Schedule
                  </CardTitle>
                  <CardDescription>
                    Configure day of week and send time for the client retention
                    digest.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm">
                        Enable Weekly Client Report
                      </h4>
                      <p className="text-xs text-slate-500">
                        Automatically compile and email active client statuses
                        weekly.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weeklySettings.isActive}
                        onChange={() =>
                          setWeeklySettings((prev) => ({
                            ...prev,
                            isActive: !prev.isActive,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {/* Day of Week & Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Send Day of Week
                      </label>
                      <select
                        value={weeklySettings.sendDayOfWeek}
                        onChange={(e) =>
                          setWeeklySettings((prev) => ({
                            ...prev,
                            sendDayOfWeek: e.target.value,
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="monday">
                          Monday (Recommended for Standup)
                        </option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Send Time of Day
                      </label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="time"
                          value={weeklySettings.sendTime}
                          onChange={(e) =>
                            setWeeklySettings((prev) => ({
                              ...prev,
                              sendTime: e.target.value,
                            }))
                          }
                          className="w-full font-mono text-sm bg-slate-50 border-slate-200 rounded-xl"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Australia/Melbourne Time (AEST)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recipients Card */}
              <Card className="py-6 shadow-xs border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                    <Mail className="h-5 w-5 text-indigo-500" /> Report
                    Recipients
                  </CardTitle>
                  <CardDescription>
                    Select which team members receive the weekly digest and
                    sentiment invitation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Agency Team Members
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {teamMembers.map((member) => {
                        const isSelected = weeklySettings.recipients.includes(
                          member.email,
                        );
                        return (
                          <div
                            key={member.id}
                            onClick={() =>
                              toggleWeeklyTeamRecipient(member.email)
                            }
                            className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-indigo-50/60 border-indigo-200 text-indigo-950 font-medium"
                                : "bg-slate-50/40 border-slate-100 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="block truncate font-semibold text-slate-900">
                                {member.name}
                              </span>
                              <span className="block text-xs text-slate-500 truncate">
                                {member.email}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* External Recipients */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      External Recipients
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="advisor@partner.com"
                        value={newWeeklyEmail}
                        onChange={(e) => setNewWeeklyEmail(e.target.value)}
                        className="bg-slate-50 border-slate-200 text-sm rounded-xl"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddWeeklyEmail();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleAddWeeklyEmail}
                        variant="secondary"
                        className="rounded-xl cursor-pointer"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {weeklySettings.recipients.map((email) => {
                        const isTeam = teamMembers.some(
                          (tm) => tm.email === email,
                        );
                        return (
                          <span
                            key={email}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                              isTeam
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveWeeklyEmail(email)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Report Sections */}
            <div>
              <Card className="py-6 shadow-xs border-slate-200 bg-white sticky top-6">
                <CardHeader>
                  <CardTitle className="text-slate-800 text-lg font-bold">
                    Digest Sections
                  </CardTitle>
                  <CardDescription>
                    Control what content is embedded in the weekly client report
                    email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Sentiment Invite Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setWeeklySettings((prev) => ({
                        ...prev,
                        includeSentimentPrompt: !prev.includeSentimentPrompt,
                      }))
                    }
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all w-full ${
                      weeklySettings.includeSentimentPrompt
                        ? "bg-slate-50/50 border-slate-200"
                        : "bg-white border-slate-100 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="pt-0.5 shrink-0 block">
                      {weeklySettings.includeSentimentPrompt ? (
                        <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-slate-300" />
                      )}
                    </span>
                    <span className="block">
                      <span className="text-sm font-semibold text-slate-800 block">
                        Team Sentiment Call-to-Action
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight mt-0.5 block">
                        Prominent banner inviting team members to review clients
                        & submit pulse ratings before standup.
                      </span>
                    </span>
                  </button>

                  {/* Watchlist Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setWeeklySettings((prev) => ({
                        ...prev,
                        includeRiskWatchlist: !prev.includeRiskWatchlist,
                      }))
                    }
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all w-full ${
                      weeklySettings.includeRiskWatchlist
                        ? "bg-slate-50/50 border-slate-200"
                        : "bg-white border-slate-100 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="pt-0.5 shrink-0 block">
                      {weeklySettings.includeRiskWatchlist ? (
                        <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-slate-300" />
                      )}
                    </span>
                    <span className="block">
                      <span className="text-sm font-semibold text-slate-800 block">
                        Attention & Risk Watchlist
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight mt-0.5 block">
                        Highlights accounts with lead drops (&gt;30% WoW) or
                        critical churn risks.
                      </span>
                    </span>
                  </button>

                  {/* Performance Metrics Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setWeeklySettings((prev) => ({
                        ...prev,
                        includePerformanceMetrics:
                          !prev.includePerformanceMetrics,
                      }))
                    }
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all w-full ${
                      weeklySettings.includePerformanceMetrics
                        ? "bg-slate-50/50 border-slate-200"
                        : "bg-white border-slate-100 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="pt-0.5 shrink-0 block">
                      {weeklySettings.includePerformanceMetrics ? (
                        <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-slate-300" />
                      )}
                    </span>
                    <span className="block">
                      <span className="text-sm font-semibold text-slate-800 block">
                        7-Day Leads & CPA Stats
                      </span>
                      <span className="text-[11px] text-slate-500 leading-tight mt-0.5 block">
                        Includes weekly conversion volume, CPA vs target, and
                        spend figures.
                      </span>
                    </span>
                  </button>

                  <Button
                    type="submit"
                    disabled={isSendingWeekly}
                    loading={isSavingWeekly}
                    loadingText="Saving Settings..."
                    className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-md h-11 rounded-xl cursor-pointer"
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Weekly Rule
                  </Button>
                </CardContent>
              </Card>
            </div>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: AUTOMATED CLIENT REPORTS                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "client_reports" && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Top Quick Status & Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card 1: Global Engine Status */}
            <Card className="py-5 shadow-xs border-slate-200 overflow-hidden relative bg-white">
              <div
                className={cn(
                  "absolute top-0 left-0 w-full h-1.5",
                  clientReportOverview?.isGloballyActive
                    ? "bg-emerald-500"
                    : "bg-amber-500",
                )}
              />
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Global Sending Engine
                </CardDescription>
                <CardTitle className="flex items-center text-xl font-bold">
                  {clientReportOverview?.isGloballyActive ? (
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      Active
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-2">
                      <Pause className="h-4 w-4" />
                      Globally Paused
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  {clientReportOverview?.isGloballyActive
                    ? "All active client schedules run according to their cadence."
                    : "All automated client sending is paused across the agency."}
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Active Automations */}
            <Card className="py-5 shadow-xs border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Active Automations
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {clientReportOverview?.summary.activeSchedules ?? 0}
                  <span className="text-sm font-normal text-slate-400 ml-1.5">
                    / {clientReportOverview?.summary.configuredSchedules ?? 0}{" "}
                    configured
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  {clientReportOverview?.summary.pausedSchedules ?? 0}{" "}
                  schedule(s) paused on a case-by-case basis.
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Total Clients Covered */}
            <Card className="py-5 shadow-xs border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Total Clients
                </CardDescription>
                <CardTitle className="text-2xl font-bold text-slate-900">
                  {clientReportOverview?.summary.totalAccounts ?? 0}
                  <span className="text-sm font-normal text-slate-400 ml-1.5">
                    active accounts
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  {(
                    ((clientReportOverview?.summary.configuredSchedules ?? 0) /
                      Math.max(
                        1,
                        clientReportOverview?.summary.totalAccounts ?? 1,
                      )) *
                    100
                  ).toFixed(0)}
                  % have automation configured.
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Last Dispatched */}
            <Card className="py-5 shadow-xs border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Last Dispatched
                </CardDescription>
                <CardTitle className="text-lg font-bold text-slate-900 truncate">
                  {clientReportOverview?.summary.lastDispatchedAt
                    ? new Date(
                        clientReportOverview.summary.lastDispatchedAt,
                      ).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "No Dispatches Yet"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Dispatched by daily cron on scheduled day of month.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Master Pause / Resume Global Banner */}
          <div
            className={cn(
              "rounded-2xl p-5 border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
              clientReportOverview?.isGloballyActive
                ? "bg-slate-50/80 border-slate-200/80"
                : "bg-amber-50/90 border-amber-200 text-amber-950",
            )}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={cn(
                  "p-2.5 rounded-xl shrink-0",
                  clientReportOverview?.isGloballyActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {clientReportOverview?.isGloballyActive
                    ? "Automated Client Report Sending is Enabled"
                    : "Automated Client Report Sending is Globally Paused"}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {clientReportOverview?.isGloballyActive
                    ? "Monthly performance PDF reports and AI executive summaries will be emailed automatically on each client's configured day of month."
                    : "All automatic cron sends are suspended across all clients. Individual schedule toggles below remain saved for when you resume."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-slate-600">
                {clientReportOverview?.isGloballyActive
                  ? "Pause All Reports"
                  : "Resume All Reports"}
              </span>
              <Switch
                checked={clientReportOverview?.isGloballyActive ?? true}
                onCheckedChange={handleToggleGlobal}
                disabled={isTogglingGlobal}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Interactive Client Reports Table Card */}
          <Card className="shadow-xs border-slate-200 overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Client Automation Schedules & Toggles
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Manage report automation on a case-by-case basis. Use the
                    toggles to enable or pause individual clients.
                  </CardDescription>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search client, ID, or email..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-8 text-xs h-9 bg-slate-50/50 border-slate-200"
                    />
                  </div>

                  <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => setClientFilter("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        clientFilter === "all"
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "hover:text-slate-900",
                      )}
                    >
                      All ({clientReportOverview?.items.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientFilter("active")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        clientFilter === "active"
                          ? "bg-white text-emerald-700 shadow-xs font-bold"
                          : "hover:text-slate-900",
                      )}
                    >
                      Active (
                      {clientReportOverview?.summary.activeSchedules || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientFilter("paused")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        clientFilter === "paused"
                          ? "bg-white text-amber-700 shadow-xs font-bold"
                          : "hover:text-slate-900",
                      )}
                    >
                      Paused (
                      {clientReportOverview?.summary.pausedSchedules || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientFilter("unscheduled")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                        clientFilter === "unscheduled"
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "hover:text-slate-900",
                      )}
                    >
                      Unconfigured
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Client Account</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4">Recipient(s)</th>
                      <th className="py-3 px-4">AI Summary</th>
                      <th className="py-3 px-4">Last Dispatched</th>
                      <th className="py-3 px-4 text-center">Status / Toggle</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClientItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-400"
                        >
                          No client report schedules match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredClientItems.map((item) => (
                        <tr
                          key={item.adAccountId}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  item.hasSchedule && item.isActive
                                    ? "bg-emerald-500"
                                    : item.hasSchedule
                                      ? "bg-amber-400"
                                      : "bg-slate-300",
                                )}
                              />
                              <div>
                                <div className="font-bold text-slate-900">
                                  {item.accountName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  G: {item.googleAccountId}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-slate-700">
                            {item.hasSchedule ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-medium bg-slate-50 border-slate-200"
                              >
                                <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                Monthly (Day {item.dayOfMonth})
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic">
                                No schedule
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-700">
                            {item.recipientEmail ? (
                              <div className="max-w-[180px] truncate">
                                <span className="font-medium text-slate-800">
                                  {item.recipientEmail}
                                </span>
                                {item.ccEmails && (
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    CC: {item.ccEmails}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {item.hasSchedule ? (
                              item.useAiSummary ? (
                                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-slate-400 text-[10px]"
                                >
                                  Off
                                </Badge>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            {item.lastRunAt ? (
                              <div>
                                <span className="font-medium text-slate-800">
                                  {new Date(item.lastRunAt).toLocaleDateString(
                                    undefined,
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  {new Date(item.lastRunAt).toLocaleTimeString(
                                    undefined,
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>
                            ) : item.hasSchedule ? (
                              <span className="text-amber-600 font-medium text-[11px]">
                                Pending next run
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.hasSchedule ? (
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={item.isActive}
                                  onCheckedChange={(checked) =>
                                    item.scheduleId &&
                                    handleToggleSchedule(
                                      item.scheduleId,
                                      checked,
                                    )
                                  }
                                  disabled={
                                    togglingScheduleId === item.scheduleId
                                  }
                                  className="cursor-pointer"
                                />
                                <span
                                  className={cn(
                                    "text-[10px] font-bold w-12 text-left",
                                    item.isActive
                                      ? "text-emerald-700"
                                      : "text-slate-400",
                                  )}
                                >
                                  {item.isActive ? "Active" : "Paused"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Unconfigured
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.hasSchedule && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    testingScheduleId === item.scheduleId
                                  }
                                  onClick={() => handleTriggerTest(item)}
                                  className="h-7 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                                  title="Send Test Report Email"
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Test
                                </Button>
                              )}
                              <ReportAutomationTrigger
                                adAccount={{
                                  id: item.adAccountId,
                                  googleAccountId: item.googleAccountId,
                                  name: item.accountName,
                                }}
                                initialRules={item.rawRules}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
