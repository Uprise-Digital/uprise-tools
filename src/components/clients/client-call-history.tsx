"use client";

import {
  AlertCircle,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Flame,
  ListTodo,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  UserCheck,
  Volume2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  analyzeCallAction,
  getClientCallRecordsAction,
  syncCallNoteToGhlAction,
  syncClientCallsFromGhlAction,
} from "@/actions/call-intelligence.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CallRecordItem {
  id: number;
  clientOnboardingId: number | null;
  ghlLocationId: string;
  ghlConversationId: string | null;
  ghlMessageId: string;
  ghlContactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  direction: string;
  status: string;
  durationSeconds: number;
  callStartedAt: string | Date | null;
  audioStreamAvailable: boolean;
  transcript: string | null;
  summary: string | null;
  leadScore: number | null;
  sentiment: string | null;
  serviceRequested: string | null;
  estimatedBudget: string | null;
  urgency: string | null;
  objections: string[] | any;
  keyTakeaways: string[] | any;
  actionItems: string[] | any;
  agentFeedback: any;
  syncedToGhl: boolean;
  syncedAt: string | Date | null;
  analysisError: string | null;
  createdAt: string | Date;
}

interface ClientCallHistoryProps {
  clientId: number;
  clientName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export default function ClientCallHistory({
  clientId,
  clientName,
  contactPhone,
  contactEmail,
}: ClientCallHistoryProps) {
  const [calls, setCalls] = useState<CallRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [analyzingCallId, setAnalyzingCallId] = useState<number | null>(null);
  const [syncingNoteCallId, setSyncingNoteCallId] = useState<number | null>(
    null,
  );
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<
    "insights" | "transcript" | "coaching"
  >("insights");

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getClientCallRecordsAction(clientId);
      if (res.success && res.calls) {
        setCalls(res.calls as any);
        if (res.calls.length > 0 && !selectedCallId) {
          setSelectedCallId(res.calls[0].id);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load calls");
    } finally {
      setLoading(false);
    }
  }, [clientId, selectedCallId]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const handleSyncFromGhl = async () => {
    setIsSyncing(true);
    try {
      const res = await syncClientCallsFromGhlAction(clientId);
      if (res.success) {
        toast.success(
          `Sync complete: Found ${res.totalFound} call(s) (${res.totalImported} new)`,
        );
        await loadCalls();
      } else {
        toast.error(res.error || "Failed to sync calls from GoHighLevel");
      }
    } catch (err: any) {
      toast.error(err.message || "Sync error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalyzeCall = async (callId: number) => {
    setAnalyzingCallId(callId);
    try {
      toast.loading("Analyzing call audio with Gemini AI...", {
        id: `analyze-${callId}`,
      });
      const res = await analyzeCallAction(callId);
      if (res.success && res.call) {
        toast.success("AI Analysis & Transcription complete!", {
          id: `analyze-${callId}`,
        });
        setCalls((prev) =>
          prev.map((c) => (c.id === callId ? (res.call as any) : c)),
        );
      } else {
        toast.error(res.error || "Analysis failed", {
          id: `analyze-${callId}`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Analysis error", { id: `analyze-${callId}` });
    } finally {
      setAnalyzingCallId(null);
    }
  };

  const handleSyncToGhlNotes = async (callId: number) => {
    setSyncingNoteCallId(callId);
    try {
      toast.loading("Posting summary note to GHL Contact...", {
        id: `sync-note-${callId}`,
      });
      const res = await syncCallNoteToGhlAction(callId);
      if (res.success) {
        toast.success("Summary note saved to GoHighLevel!", {
          id: `sync-note-${callId}`,
        });
        setCalls((prev) =>
          prev.map((c) =>
            c.id === callId
              ? { ...c, syncedToGhl: true, syncedAt: new Date() }
              : c,
          ),
        );
      } else {
        toast.error(res.error || "Failed to post note to GHL", {
          id: `sync-note-${callId}`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Note sync error", {
        id: `sync-note-${callId}`,
      });
    } finally {
      setSyncingNoteCallId(null);
    }
  };

  const selectedCall = calls.find((c) => c.id === selectedCallId) || calls[0];

  const handleCopyTranscript = () => {
    if (!selectedCall?.transcript) return;
    navigator.clipboard.writeText(selectedCall.transcript);
    setCopiedTranscript(true);
    toast.success("Verbatim transcript copied to clipboard");
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Helper formatting
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "Unknown Date";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLeadScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          Unanalyzed
        </span>
      );
    }
    if (score >= 8) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
          <Flame className="h-3 w-3 fill-emerald-600 text-emerald-600" />
          Score: {score}/10 (Hot)
        </span>
      );
    }
    if (score >= 5) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
          <Zap className="h-3 w-3 fill-amber-600 text-amber-600" />
          Score: {score}/10 (Warm)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
        <AlertCircle className="h-3 w-3 text-rose-600" />
        Score: {score}/10 (Cold)
      </span>
    );
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const s = sentiment.toLowerCase();
    if (s === "positive") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Positive
        </span>
      );
    }
    if (s === "negative") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          Negative
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        Neutral
      </span>
    );
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Header Sync & Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
            <PhoneCall className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              GoHighLevel Call Intelligence
              <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded-md">
                {calls.length} {calls.length === 1 ? "Call" : "Calls"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Direct recording playback, AI transcripts & lead qualification
              scoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSyncFromGhl}
            disabled={isSyncing}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                isSyncing && "animate-spin text-indigo-600",
              )}
            />
            {isSyncing ? "Syncing GHL..." : "Sync Calls from GHL"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          <p className="text-xs font-medium">Loading call history...</p>
        </div>
      ) : calls.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-3 bg-white">
          <div className="h-10 w-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <PhoneMissed className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700">
              No Call Records Found
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              No recent call history is currently linked to this client. Click{" "}
              <strong>Sync Calls from GHL</strong> to search for inbound and
              outbound calls.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSyncFromGhl}
            disabled={isSyncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-8 px-4 rounded-lg cursor-pointer"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")}
            />
            Sync from GoHighLevel
          </Button>
        </div>
      ) : (
        /* Calls Master-Detail View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Call List */}
          <div className="lg:col-span-4 space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {calls.map((call) => {
              const isSelected = call.id === selectedCall?.id;
              const isInbound = call.direction.toLowerCase() === "inbound";

              return (
                <div
                  key={call.id}
                  onClick={() => setSelectedCallId(call.id)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer text-left space-y-2 relative",
                    isSelected
                      ? "bg-indigo-50/60 border-indigo-300 shadow-sm ring-1 ring-indigo-200"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      {isInbound ? (
                        <div className="p-1 rounded bg-emerald-100 text-emerald-700">
                          <PhoneIncoming className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="p-1 rounded bg-blue-100 text-blue-700">
                          <PhoneOutgoing className="h-3 w-3" />
                        </div>
                      )}
                      <span className="text-slate-800 capitalize">
                        {call.direction} Call
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {formatDuration(call.durationSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {formatDate(call.callStartedAt)}
                    </span>
                    {getLeadScoreBadge(call.leadScore)}
                  </div>

                  {call.summary && (
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-1.5 rounded border border-slate-100">
                      {call.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Selected Call Details & AI Inspector */}
          {selectedCall && (
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
              {/* Call Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedCall.contactName || clientName}
                    </h4>
                    {selectedCall.contactPhone && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                        {selectedCall.contactPhone}
                      </span>
                    )}
                    {getSentimentBadge(selectedCall.sentiment)}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{formatDate(selectedCall.callStartedAt)}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      {formatDuration(selectedCall.durationSeconds)}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{selectedCall.direction}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAnalyzeCall(selectedCall.id)}
                    disabled={analyzingCallId === selectedCall.id}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {analyzingCallId === selectedCall.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        {selectedCall.transcript
                          ? "Re-Analyze AI"
                          : "Analyze with AI"}
                      </>
                    )}
                  </Button>

                  {selectedCall.summary && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSyncToGhlNotes(selectedCall.id)}
                      disabled={syncingNoteCallId === selectedCall.id}
                      className={cn(
                        "text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer border-slate-200",
                        selectedCall.syncedToGhl
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-white text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      {syncingNoteCallId === selectedCall.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : selectedCall.syncedToGhl ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      {selectedCall.syncedToGhl
                        ? "Synced to GHL Note"
                        : "Sync Note to GHL"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Audio Playback Player */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-slate-200">
                    <Volume2 className="h-4 w-4 text-indigo-400" />
                    Call Audio Recording
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDuration(selectedCall.durationSeconds)}
                  </span>
                </div>
                {/* biome-ignore lint/a11y/useMediaCaption: Dynamic call audio recording playback */}
                <audio
                  controls
                  className="w-full h-8 rounded-lg outline-none"
                  src={`/api/calls/${selectedCall.id}/audio`}
                  preload="metadata"
                >
                  <track kind="captions" />
                  Your browser does not support the audio element.
                </audio>
              </div>

              {/* View Switcher Tabs */}
              {selectedCall.transcript ? (
                <div className="space-y-3">
                  <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
                    <button
                      onClick={() => setActiveViewTab("insights")}
                      className={cn(
                        "pb-2 transition-colors cursor-pointer flex items-center gap-1.5",
                        activeViewTab === "insights"
                          ? "text-indigo-600 border-b-2 border-indigo-600"
                          : "text-slate-500 hover:text-slate-800",
                      )}
                    >
                      <Bot className="h-3.5 w-3.5" /> AI Summary & Deal Criteria
                    </button>
                    <button
                      onClick={() => setActiveViewTab("transcript")}
                      className={cn(
                        "pb-2 transition-colors cursor-pointer flex items-center gap-1.5",
                        activeViewTab === "transcript"
                          ? "text-indigo-600 border-b-2 border-indigo-600"
                          : "text-slate-500 hover:text-slate-800",
                      )}
                    >
                      <Copy className="h-3.5 w-3.5" /> Full Verbatim Transcript
                    </button>
                    {selectedCall.agentFeedback && (
                      <button
                        onClick={() => setActiveViewTab("coaching")}
                        className={cn(
                          "pb-2 transition-colors cursor-pointer flex items-center gap-1.5",
                          activeViewTab === "coaching"
                            ? "text-indigo-600 border-b-2 border-indigo-600"
                            : "text-slate-500 hover:text-slate-800",
                        )}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Sales Coaching
                      </button>
                    )}
                  </div>

                  {/* Tab 1: AI Summary & Deal Criteria */}
                  {activeViewTab === "insights" && (
                    <div className="space-y-4 animate-in fade-in-50 duration-200">
                      {/* Lead Score & Executive Summary Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Executive Call Summary
                          </span>
                          {getLeadScoreBadge(selectedCall.leadScore)}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {selectedCall.summary}
                        </p>
                      </div>

                      {/* 4-Box Extracted Deal Matrix */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-2.5 space-y-1">
                          <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wider">
                            <Target className="h-3 w-3" /> Service
                          </span>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {selectedCall.serviceRequested || "Not specified"}
                          </p>
                        </div>

                        <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-2.5 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 uppercase tracking-wider">
                            <DollarSign className="h-3 w-3" /> Budget
                          </span>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {selectedCall.estimatedBudget || "Not specified"}
                          </p>
                        </div>

                        <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-2.5 space-y-1">
                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1 uppercase tracking-wider">
                            <Clock className="h-3 w-3" /> Urgency
                          </span>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {selectedCall.urgency || "Flexible"}
                          </p>
                        </div>

                        <div className="bg-rose-50/40 border border-rose-100 rounded-lg p-2.5 space-y-1">
                          <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1 uppercase tracking-wider">
                            <ShieldAlert className="h-3 w-3" /> Objections
                          </span>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {Array.isArray(selectedCall.objections) &&
                            selectedCall.objections.length > 0
                              ? `${selectedCall.objections.length} Raised`
                              : "None"}
                          </p>
                        </div>
                      </div>

                      {/* Objections List if present */}
                      {Array.isArray(selectedCall.objections) &&
                        selectedCall.objections.length > 0 && (
                          <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3 space-y-1.5">
                            <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                              Customer Objections & Hesitations:
                            </span>
                            <ul className="list-disc list-inside text-xs text-rose-800 space-y-1">
                              {selectedCall.objections.map(
                                (obj: string, i: number) => (
                                  <li key={i}>{obj}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}

                      {/* Action Items & Key Takeaways Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Action Items */}
                        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <ListTodo className="h-3.5 w-3.5 text-indigo-600" />{" "}
                            Action Items
                          </span>
                          {Array.isArray(selectedCall.actionItems) &&
                          selectedCall.actionItems.length > 0 ? (
                            <ul className="space-y-1.5 text-xs text-slate-700">
                              {selectedCall.actionItems.map(
                                (item: string, idx: number) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                      {idx + 1}
                                    </span>
                                    <span>{item}</span>
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No action items detected.
                            </p>
                          )}
                        </div>

                        {/* Key Takeaways */}
                        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{" "}
                            Key Discussion Points
                          </span>
                          {Array.isArray(selectedCall.keyTakeaways) &&
                          selectedCall.keyTakeaways.length > 0 ? (
                            <ul className="space-y-1.5 text-xs text-slate-700">
                              {selectedCall.keyTakeaways.map(
                                (point: string, idx: number) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-1.5"
                                  >
                                    <span className="text-emerald-500 font-bold">
                                      •
                                    </span>
                                    <span>{point}</span>
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No specific points extracted.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Full Verbatim Transcript */}
                  {activeViewTab === "transcript" && (
                    <div className="space-y-3 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <Input
                            placeholder="Search transcript phrases..."
                            value={transcriptSearch}
                            onChange={(e) =>
                              setTranscriptSearch(e.target.value)
                            }
                            className="pl-8 text-xs h-8 rounded-lg bg-slate-50 border-slate-200 text-slate-800"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopyTranscript}
                          className="h-8 text-xs font-bold text-slate-700 border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-slate-100"
                        >
                          {copiedTranscript ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedTranscript ? "Copied" : "Copy"}
                        </Button>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-[360px] overflow-y-auto space-y-2 text-xs font-mono leading-relaxed text-slate-800">
                        {selectedCall.transcript
                          .split("\n")
                          .map((line, index) => {
                            if (!line.trim()) return null;
                            const isMatch =
                              transcriptSearch.trim() &&
                              line
                                .toLowerCase()
                                .includes(transcriptSearch.toLowerCase());
                            const isAgent =
                              line.toLowerCase().startsWith("agent") ||
                              line.toLowerCase().startsWith("speaker 1") ||
                              line.toLowerCase().startsWith("uprise");

                            return (
                              <div
                                key={index}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  isAgent
                                    ? "bg-white border-l-3 border-indigo-500 shadow-2xs"
                                    : "bg-emerald-50/50 border-l-3 border-emerald-500",
                                  isMatch &&
                                    "bg-yellow-100 ring-2 ring-yellow-400 font-bold",
                                )}
                              >
                                <p className="text-slate-800 text-[11px] whitespace-pre-wrap">
                                  {line}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Sales Coaching */}
                  {activeViewTab === "coaching" &&
                    selectedCall.agentFeedback && (
                      <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in-50 duration-200">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-indigo-600" />
                            Sales Rep Adherence & Evaluation
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {selectedCall.agentFeedback.adherence ||
                              "Script adherence verified."}
                          </p>
                        </div>

                        {Array.isArray(
                          selectedCall.agentFeedback.coachingTips,
                        ) &&
                          selectedCall.agentFeedback.coachingTips.length >
                            0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-200">
                              <span className="text-xs font-bold text-indigo-900">
                                Coaching Opportunities:
                              </span>
                              <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                                {selectedCall.agentFeedback.coachingTips.map(
                                  (tip: string, idx: number) => (
                                    <li key={idx}>{tip}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              ) : (
                /* Empty state for unanalyzed call */
                <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-6 text-center space-y-3">
                  <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-slate-800">
                      Audio Ready for AI Intelligence
                    </h5>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Click below to generate verbatim speaker transcripts,
                      extract lead score (1-10), service requirements, customer
                      objections, and action items.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAnalyzeCall(selectedCall.id)}
                    disabled={analyzingCallId === selectedCall.id}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-8 px-4 rounded-lg cursor-pointer shadow-sm"
                  >
                    {analyzingCallId === selectedCall.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Analyzing Audio...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Run AI Analysis Now
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
