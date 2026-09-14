"use client";

import {
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  HeartPulse,
  Mail,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { sendMorningBriefingAction } from "@/actions/briefing.actions";
import { saveBriefingSettingsAction } from "@/actions/briefing-settings.actions";
import {
  saveWeeklyClientReportSettingsAction,
  sendWeeklyClientReportAction,
  type WeeklyClientReportSettingsData,
} from "@/actions/weekly-client-report.actions";
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
  teamMembers: TeamMember[];
}

export default function ReportsClient({
  initialSettings,
  initialWeeklySettings,
  teamMembers,
}: ReportsClientProps) {
  // Tab state: "daily_briefing" | "weekly_client_report"
  const [activeTab, setActiveTab] = useState<
    "daily_briefing" | "weekly_client_report"
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
    </div>
  );
}
