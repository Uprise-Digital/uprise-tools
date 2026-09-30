"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  History,
  Layers,
  Mail,
  PenLine,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type ClientDraftEmailResponse,
  generateClientDraftEmailAction,
  getClientReportSendingHistoryAction,
  saveClientDraftInstructionsAction,
  sendClientExecutiveEmailAction,
} from "@/actions/client-report-draft.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface ClientEmailDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  adAccountId: number;
  accountName: string;
  googleAccountId: string;
  teamMembers: TeamMember[];
}

export function ClientEmailDraftModal({
  isOpen,
  onClose,
  adAccountId,
  accountName,
  googleAccountId,
  teamMembers,
}: ClientEmailDraftModalProps) {
  const [activeTab, setActiveTab] = useState<"draft" | "history">("draft");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Draft Data & Form State
  const [draft, setDraft] = useState<ClientDraftEmailResponse | null>(null);
  const [subject, setSubject] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [wordLimitTier, setWordLimitTier] = useState<
    "concise" | "standard" | "detailed"
  >("standard");
  const [includeGoogle, setIncludeGoogle] = useState(true);
  const [includeMeta, setIncludeMeta] = useState(true);
  const [showTuning, setShowTuning] = useState(false);

  // Staff testing state
  const [selectedStaffEmail, setSelectedStaffEmail] = useState<string>("");

  // History state
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load draft upon opening
  useEffect(() => {
    if (isOpen && adAccountId) {
      loadInitialDraft();
    }
  }, [isOpen, adAccountId]);

  // Set default staff recipient to first team member if available
  useEffect(() => {
    if (teamMembers.length > 0 && !selectedStaffEmail) {
      const seyone = teamMembers.find((m) =>
        m.email.toLowerCase().includes("seyone"),
      );
      setSelectedStaffEmail(seyone ? seyone.email : teamMembers[0].email);
    }
  }, [teamMembers]);

  const loadInitialDraft = async () => {
    setIsLoading(true);
    try {
      const res = await generateClientDraftEmailAction({
        adAccountId,
        wordLimitTier: "standard",
        channels: ["google", "meta"],
      });

      if (res.success && res.data) {
        applyDraftData(res.data);
      } else {
        toast.error(res.error || "Failed to generate initial draft.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load draft");
    } finally {
      setIsLoading(false);
    }
  };

  const applyDraftData = (data: ClientDraftEmailResponse) => {
    setDraft(data);
    setSubject(data.subject);
    setRecipientEmail(data.recipientEmail || "");
    setCcEmails(data.ccEmails || "");
    setBodyText(data.plainText);
    setCustomInstructions(data.customInstructions || "");
    setWordLimitTier(data.wordLimitTier);
    setIncludeGoogle(true);
    setIncludeMeta(data.hasMeta);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    const channels: ("google" | "meta")[] = [];
    if (includeGoogle) channels.push("google");
    if (includeMeta && draft?.hasMeta) channels.push("meta");

    try {
      const res = await generateClientDraftEmailAction({
        adAccountId,
        customInstructions,
        wordLimitTier,
        channels: channels.length > 0 ? channels : ["google"],
      });

      if (res.success && res.data) {
        applyDraftData(res.data);
        toast.success("Draft regenerated successfully!");
      } else {
        toast.error(res.error || "Failed to regenerate draft");
      }
    } catch (err: any) {
      toast.error(err.message || "Error regenerating draft");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveInstructionsAsDefault = async () => {
    setIsSavingInstructions(true);
    try {
      const res = await saveClientDraftInstructionsAction({
        adAccountId,
        customAiInstructions: customInstructions,
        recipientEmail,
        ccEmails,
      });

      if (res.success) {
        toast.success("Custom instructions saved for future drafts & reports!");
      } else {
        toast.error(res.error || "Failed to save instructions.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving instructions");
    } finally {
      setIsSavingInstructions(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopied(true);
      toast.success("Email copied to clipboard (ready to paste in Gmail)!");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCopyLink = async () => {
    if (!draft?.publicShareUrl) return;
    try {
      await navigator.clipboard.writeText(draft.publicShareUrl);
      setCopiedLink(true);
      toast.success("Public dashboard link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleSendToClient = async () => {
    if (!recipientEmail.trim()) {
      toast.error("Please enter a recipient email address.");
      return;
    }

    setIsSending(true);
    const toastId = toast.loading("Dispatching email...");

    try {
      const res = await sendClientExecutiveEmailAction({
        adAccountId,
        recipientEmail,
        ccEmails,
        subject,
        bodyText,
      });

      if (res.success) {
        toast.success(
          res.wasSafeguarded
            ? `Email safely dispatched (Diverted to ${res.deliveredTo} per agency safeguard)`
            : `Email sent to ${res.deliveredTo}`,
          { id: toastId, duration: 6000 },
        );
        fetchHistory();
      } else {
        toast.error(res.error || "Failed to dispatch email", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch email", { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTestToStaff = async () => {
    if (!selectedStaffEmail) {
      toast.error("Please select a staff member to send test to.");
      return;
    }

    setIsSendingTest(true);
    const toastId = toast.loading(`Sending test preview to ${selectedStaffEmail}...`);

    try {
      const res = await sendClientExecutiveEmailAction({
        adAccountId,
        recipientEmail: selectedStaffEmail,
        subject,
        bodyText,
        staffRecipientEmail: selectedStaffEmail,
      });

      if (res.success) {
        toast.success(`Test preview delivered to ${selectedStaffEmail}`, {
          id: toastId,
        });
        fetchHistory();
      } else {
        toast.error(res.error || "Failed to send test preview", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test", { id: toastId });
    } finally {
      setIsSendingTest(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getClientReportSendingHistoryAction({
        adAccountId,
        limit: 25,
      });
      if (res.success) {
        setHistoryLogs(res.logs);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleTabChange = (tab: "draft" | "history") => {
    setActiveTab(tab);
    if (tab === "history") {
      fetchHistory();
    }
  };

  const wordCount = bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-slate-900 border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Executive Client Report: {accountName}</span>
                  {draft?.hasMeta && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold bg-blue-50/80 text-blue-700 border-blue-200"
                    >
                      Multi-Channel (Google + Meta)
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Lakshane&apos;s 3-pillar executive standard. Edit on the spot, copy to clipboard, or send now.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tabs */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleTabChange("draft")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "draft"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <PenLine className="h-3.5 w-3.5" />
                Draft Editor
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("history")}
                className={cn(
                  "px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === "history"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                <History className="h-3.5 w-3.5" />
                Sending History
              </button>
            </div>
          </div>
        </div>

        {/* Safeguard Notice Banner */}
        <div className="px-6 py-2 bg-emerald-50/90 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-800 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Client Safeguard Active:</strong> Real clients are never emailed. All dispatches are automatically diverted to{" "}
              <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono text-[11px]">
                seyone@uprisedigital.com.au
              </code>
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
            Safe Mode
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">
                Synthesising executive performance data...
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Aggregating Google Ads metrics, Meta Ads conversions, and public share links into Lakshane&apos;s 3-pillar standard.
              </p>
            </div>
          ) : activeTab === "history" ? (
            /* ───────────────────────────────────────────────────────────── */
            /* HISTORY TAB                                                   */
            /* ───────────────────────────────────────────────────────────── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Dispatch History for {accountName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Audit log of all report emails and briefings dispatched for this account.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isLoadingHistory && "animate-spin",
                    )}
                  />
                  Refresh
                </Button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Loading history logs...
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-100">
                  <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">
                    No dispatches recorded yet for {accountName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Emails sent from the draft modal or automated cron runs will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Date / Time</th>
                        <th className="py-2.5 px-3">Recipient</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Resend ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {new Date(log.sentAt).toLocaleString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[180px] truncate">
                            {log.recipient}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[220px] truncate">
                            {log.subject}
                          </td>
                          <td className="py-2.5 px-3">
                            {log.status === "success" ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
                                Delivered
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-semibold">
                                Failed
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px] truncate max-w-[120px]">
                            {log.resendId || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* DRAFT EDITOR TAB                                              */
            /* ───────────────────────────────────────────────────────────── */
            <>
              {/* Quick Metrics Bar & Public Link */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Google Snapshot Card */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5 text-indigo-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      Google Ads (30d)
                    </span>
                    <span className="font-mono text-slate-400">
                      ${draft?.googleMetrics?.spend.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-lg font-black text-slate-900">
                        {draft?.googleMetrics?.conversions || 0}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">leads</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-xs font-bold font-mono bg-white"
                      >
                        ${draft?.googleMetrics?.cpl.toFixed(2) || "0.00"} CPL
                      </Badge>
                      {draft?.publicShareUrl && (
                        <a
                          href={`${draft.publicShareUrl}${draft.publicShareUrl.includes("?") ? "&" : "?"}selected=google`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center"
                          title="Open Google Ads tab on public dashboard"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Meta Snapshot Card */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      Meta Ads (30d)
                    </span>
                    <span className="font-mono text-slate-400">
                      {draft?.hasMeta && draft?.metaMetrics
                        ? `$${draft.metaMetrics.spend.toFixed(2)}`
                        : "No data"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-lg font-black text-slate-900">
                        {draft?.metaMetrics?.conversions ?? "—"}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        {draft?.hasMeta ? "leads" : "Not connected"}
                      </span>
                    </div>
                    {draft?.metaMetrics && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-xs font-bold font-mono bg-white"
                        >
                          ${draft.metaMetrics.cpl.toFixed(2)} CPL
                        </Badge>
                        {draft?.publicShareUrl && (
                          <a
                            href={`${draft.publicShareUrl}${draft.publicShareUrl.includes("?") ? "&" : "?"}selected=meta`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center"
                            title="Open Meta Ads tab on public dashboard"
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Public Link Card */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Public Dashboard URL</span>
                      <span className="text-[10px] font-normal text-emerald-600 font-semibold">
                        No login required
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate font-mono">
                      {draft?.publicShareUrl || "Generating..."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="h-6 text-[11px] px-2 gap-1 cursor-pointer"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    {draft?.publicShareUrl && (
                      <a
                        href={draft.publicShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                      >
                        Open Dashboard
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Tuning / Prompt Injection Toggle & Panel */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTuning(!showTuning)}
                  className="w-full px-4 py-2.5 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                    Modify Instructions (Prompt Injection), Word Limits &amp; Channels
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white font-medium">
                    {showTuning ? "Hide Tuning" : "Adjust Prompt & Limits"}
                  </Badge>
                </button>

                {showTuning && (
                  <div className="p-4 space-y-4 bg-white border-t border-slate-100 animate-in fade-in-50 duration-150">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800">
                          Custom Instructions / Prompt Injection
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveInstructionsAsDefault}
                          disabled={isSavingInstructions}
                          className="h-6 text-[11px] text-indigo-700 hover:bg-indigo-50 font-semibold cursor-pointer"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save as Client Default
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="e.g., Focus heavily on high lead quality this month, note that display leakage was pruned, and emphasize our new landing page launch next week..."
                        className="text-xs font-normal bg-slate-50/50 border-slate-200 resize-none"
                      />
                      <p className="text-[10px] text-slate-400">
                        Injected directly into Gemini alongside Lakshane&apos;s reporting instructions.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Word Limit Tier */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">
                          Brevity &amp; Word Limit Tier
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              {
                                id: "concise",
                                label: "Concise",
                                desc: "~100 words",
                              },
                              {
                                id: "standard",
                                label: "Standard",
                                desc: "~200 words",
                              },
                              {
                                id: "detailed",
                                label: "Detailed",
                                desc: "~300 words",
                              },
                            ] as const
                          ).map((tier) => (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => setWordLimitTier(tier.id)}
                              className={cn(
                                "p-2 rounded-lg border text-left transition-all cursor-pointer",
                                wordLimitTier === tier.id
                                  ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold shadow-2xs"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                              )}
                            >
                              <div className="text-xs font-bold">
                                {tier.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {tier.desc}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Channel Inclusions */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800">
                          Channels Included
                        </Label>
                        <div className="flex items-center gap-4 pt-1.5">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeGoogle}
                              onChange={(e) =>
                                setIncludeGoogle(e.target.checked)
                              }
                              className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                            />
                            Google Ads
                          </label>

                          <label
                            className={cn(
                              "flex items-center gap-2 text-xs font-medium cursor-pointer",
                              draft?.hasMeta
                                ? "text-slate-700"
                                : "text-slate-400 cursor-not-allowed opacity-60",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={includeMeta}
                              onChange={(e) => setIncludeMeta(e.target.checked)}
                              disabled={!draft?.hasMeta}
                              className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                            />
                            Meta Ads {draft?.hasMeta ? "" : "(Not Linked)"}
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                      >
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5 mr-1.5",
                            isRegenerating && "animate-spin",
                          )}
                        />
                        Regenerate with Instructions
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Subject & Recipient Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Subject Line
                  </Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-8 text-xs font-medium bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Client Recipient Email
                  </Label>
                  <Input
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* Live Editable Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5 text-slate-500" />
                    Email Body (Live Editable Plain-Formatted Text)
                  </Label>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{wordCount} words</span>
                    <span>•</span>
                    <span>Lakshane Signature Appended</span>
                  </div>
                </div>

                <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                  <Textarea
                    rows={12}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="text-xs leading-relaxed font-sans p-4 border-none shadow-none resize-y focus-visible:ring-0 min-h-[220px]"
                    placeholder="Drafting executive report..."
                  />

                  {/* Visual Footer Preview Pill */}
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">
                        Lakshane Fonseka
                      </span>
                      <span>|</span>
                      <span>Founder, Uprise Digital</span>
                      <span>|</span>
                      <span>+61 426 759 756</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Official Signature &amp; Legal Disclaimer auto-attached on send
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Left: Send Test to Staff */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Select
                value={selectedStaffEmail}
                onValueChange={setSelectedStaffEmail}
              >
                <SelectTrigger className="h-8 text-xs bg-white border-slate-200 w-[180px]">
                  <SelectValue placeholder="Select staff..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem
                      key={member.id}
                      value={member.email}
                      className="text-xs"
                    >
                      {member.name} ({member.email.split("@")[0]})
                    </SelectItem>
                  ))}
                  {/* Fallback to Seyone if not in team */}
                  {!teamMembers.some((m) =>
                    m.email.toLowerCase().includes("seyone"),
                  ) && (
                    <SelectItem
                      value="seyone@uprisedigital.com.au"
                      className="text-xs"
                    >
                      Seyone (Founder / Admin)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTestToStaff}
                disabled={isSendingTest || isLoading}
                className="h-8 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer"
                title="Send test email preview to selected staff colleague"
              >
                {isSendingTest ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <User className="h-3 w-3 mr-1" />
                )}
                Test to Staff
              </Button>
            </div>
          </div>

          {/* Right: Copy & Send Now */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={isLoading || !bodyText}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSendToClient}
              disabled={isSending || isLoading || !recipientEmail}
              className="h-8 text-xs font-bold gap-1.5 bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-2xs"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
