"use client";

import {
  AlertTriangle,
  CheckSquare,
  Clock,
  Loader2,
  Mail,
  Plus,
  Save,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface BriefingSettingsData {
  id: number | null;
  isActive: boolean;
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
  teamMembers: TeamMember[];
}

export default function ReportsClient({
  initialSettings,
  teamMembers,
}: ReportsClientProps) {
  const [settings, setSettings] = useState<BriefingSettingsData>(
    initialSettings || {
      id: null,
      isActive: true,
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

  // Save configuration
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

  // Test send briefing immediately
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

    // Simple regex
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

  return (
    <div className="space-y-8 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-7 w-7 text-indigo-600 animate-spin-slow" />{" "}
            Report Automation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure and manage daily agency-wide briefing schedules and
            targets.
          </p>
        </div>

        <Button
          onClick={handleSendNow}
          disabled={isSending || isSaving}
          variant="outline"
          className="w-full md:w-auto bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 shadow-sm"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-indigo-600" />{" "}
              Dispatching...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2 text-indigo-600" /> Send
              Briefing Now
            </>
          )}
        </Button>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border-slate-200 overflow-hidden relative">
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

        <Card className="shadow-sm border-slate-200 overflow-hidden relative">
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
              Includes active team members plus custom external email targets.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-500"></div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Active Data Points
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-800">
              {Object.values(settings.dataPoints).filter(Boolean).length} / 9
              enabled
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
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                <Clock className="h-5 w-5 text-indigo-500" /> Schedule settings
              </CardTitle>
              <CardDescription>
                Configure when the automated daily morning briefing should run.
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

              {/* Send Time */}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 block">
                  Send Time of Day
                </span>
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
                    className="w-40 border-slate-200 font-medium text-slate-700 focus-visible:ring-indigo-500 h-10"
                  />
                  <span className="text-xs text-slate-400 font-medium">
                    Australia/Melbourne Time (AEST)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipients Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                <Mail className="h-5 w-5 text-indigo-500" /> Briefing Recipients
              </CardTitle>
              <CardDescription>
                Manage who will receive the daily morning briefing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Member Checkboxes */}
              <div className="space-y-3">
                <span className="text-sm font-semibold text-slate-700 block">
                  Agency Team Members
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teamMembers.map((member) => {
                    const isSelected = settings.recipients.includes(
                      member.email,
                    );
                    return (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => toggleTeamRecipient(member.email)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all w-full ${
                          isSelected
                            ? "bg-indigo-50/50 border-indigo-200 animate-pulse-subtle"
                            : "bg-white border-slate-100 hover:border-slate-300"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="h-4.5 w-4.5 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate block">
                          <span className="text-sm font-semibold text-slate-800 truncate block">
                            {member.name}
                          </span>
                          <span className="text-xs text-slate-400 truncate block">
                            {member.email}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Recipients Input */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <span className="text-sm font-semibold text-slate-700 block">
                  Add External Email Targets
                </span>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="e.g., director@client.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    className="border-slate-200 focus-visible:ring-indigo-500"
                  />
                  <Button
                    type="button"
                    onClick={handleAddEmail}
                    variant="outline"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>

              {/* Recipients Tags */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Selected Recipients
                </span>
                {settings.recipients.length === 0 ? (
                  <p className="text-xs text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> No recipients
                    configured. The briefing cannot be sent.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.recipients.map((email) => {
                      const isTeam = teamMembers.some((t) => t.email === email);
                      return (
                        <span
                          key={email}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
                            isTeam
                              ? "bg-slate-100 text-slate-700"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}
                        >
                          {email}
                          <X
                            onClick={() => handleRemoveEmail(email)}
                            className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-600"
                          />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Data Points Config) */}
        <div className="space-y-8">
          <Card className="shadow-sm border-slate-200 h-full">
            <CardHeader>
              <CardTitle className="text-slate-800 text-lg font-bold">
                Metrics & Data Points
              </CardTitle>
              <CardDescription>
                Select which performance sections and stats to include in the
                briefing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Data points checklist */}
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
                { key: "cpc", label: "CPC", desc: "Cost-per-click averages" },
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
                disabled={isSaving || isSending}
                className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-md h-11"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving
                    Settings...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save Automation Rule
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
