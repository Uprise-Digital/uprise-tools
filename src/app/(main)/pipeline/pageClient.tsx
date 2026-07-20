"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Calendar,
  Clipboard,
  Clock,
  DollarSign,
  Loader2,
  Mail,
  MessageSquarePlus,
  Phone,
  Settings,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addGhlContactNoteAction,
  generateRevivalPlanAction,
  generateTranscriptSummaryAction,
  getContactNotesAction,
  getPipelineDashboardDataAction,
  updateSalesReminderSettingsAction,
} from "@/actions/pipeline.actions";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PipelineClientProps {
  initialData: {
    pipelines: { id: string; name: string }[];
    selectedPipelineId: string;
    stages: { id: string; name: string }[];
    opportunities: any[];
    metrics: {
      totalValue: number;
      activeCount: number;
      stalledCount: number;
      stalledValue: number;
    };
  };
  initialSettings: {
    id: number;
    recipients: string[];
    sendTime: string;
    isActive: boolean;
  };
  teamMembers: {
    id: string;
    email: string | null;
    name: string | null;
  }[];
  error: string | null;
}

export default function PipelineClient({
  initialData,
  initialSettings,
  teamMembers,
  error,
}: PipelineClientProps) {
  const [data, setData] = useState(initialData);
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    initialData.selectedPipelineId,
  );

  // Settings configuration state
  const [settings, setSettings] = useState(initialSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [editRecipients, setEditRecipients] = useState<string[]>(
    initialSettings.recipients,
  );
  const [editSendTime, setEditSendTime] = useState(initialSettings.sendTime);
  const [editIsActive, setEditIsActive] = useState(initialSettings.isActive);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [activeMainTab, setActiveMainTab] = useState<"board" | "stalled">(
    "board",
  );
  const [selectedOpportunity, setSelectedOpportunity] = useState<any | null>(
    null,
  );

  // Drawer Tab state
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    "revival" | "notes" | "fathom"
  >("revival");

  // Notes state
  const [notesList, setNotesList] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  // Transcript Summarizer state
  const [rawTranscript, setRawTranscript] = useState("");
  const [summarizedDraft, setSummarizedDraft] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Revival Plan state
  const [revivalPlan, setRevivalPlan] = useState<any | null>(null);
  const [loadingRevival, setLoadingRevival] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(
    {},
  );

  const [isSwitchingPipeline, setIsSwitchingPipeline] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Switch pipeline handler
  const handlePipelineChange = async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setIsSwitchingPipeline(true);
    try {
      const res = await getPipelineDashboardDataAction(pipelineId);
      if (res.success && "pipelines" in res) {
        setData(res as any);
      } else {
        toast.error("Failed to load pipeline data.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error loading pipeline.");
    } finally {
      setIsSwitchingPipeline(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await updateSalesReminderSettingsAction({
        recipients: editRecipients,
        sendTime: editSendTime,
        isActive: editIsActive,
      });

      if (res.success) {
        setSettings({
          id: settings.id,
          recipients: editRecipients,
          sendTime: editSendTime,
          isActive: editIsActive,
        });
        toast.success("Sales reminder settings saved successfully.");
        setIsSettingsOpen(false);
      } else {
        toast.error("Failed to save settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddCustomEmail = () => {
    const clean = customEmailInput.trim().toLowerCase();
    if (!clean) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (editRecipients.includes(clean)) {
      toast.error("Email is already in the recipient list.");
      return;
    }
    setEditRecipients([...editRecipients, clean]);
    setCustomEmailInput("");
  };

  const handleRemoveRecipient = (email: string) => {
    setEditRecipients(editRecipients.filter((r) => r !== email));
  };

  // Open opportunity details slide-over
  const openOpportunityDetails = async (opp: any) => {
    setSelectedOpportunity(opp);
    setActiveDrawerTab("revival");
    setRevivalPlan(null);
    setSummarizedDraft("");
    setRawTranscript("");
    setCompletedSteps({});

    // Load existing notes
    setLoadingNotes(true);
    setNotesList([]);
    try {
      const res = await getContactNotesAction(opp.contactId);
      if (res.success && "notes" in res) {
        setNotesList(res.notes);
      }
    } catch (err) {
      console.error("Failed to load notes", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Add contact note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity || !newNoteBody.trim()) return;

    setPostingNote(true);
    try {
      const res = await addGhlContactNoteAction(
        selectedOpportunity.contactId,
        newNoteBody,
      );
      if (res.success) {
        toast.success("Note saved to GoHighLevel contact file.");
        setNewNoteBody("");
        // Reload notes list
        const reloadRes = await getContactNotesAction(
          selectedOpportunity.contactId,
        );
        if (reloadRes.success && "notes" in reloadRes) {
          setNotesList(reloadRes.notes);
        }
      } else {
        toast.error(res.error || "Failed to post note.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setPostingNote(false);
    }
  };

  // Generate Revival Plan via Gemini
  const handleGenerateRevivalPlan = async () => {
    if (!selectedOpportunity) return;
    setLoadingRevival(true);
    try {
      const stageName =
        data.stages.find((s) => s.id === selectedOpportunity.stageId)?.name ||
        "Lead";
      const res = await generateRevivalPlanAction(selectedOpportunity.id, {
        name: selectedOpportunity.name,
        contactName: selectedOpportunity.contactName,
        stageName,
        value: selectedOpportunity.monetaryValue || 0,
        daysStalled: selectedOpportunity.daysStalled || 0,
        ownerName: selectedOpportunity.ownerName,
      });

      if (res.success && "plan" in res) {
        setRevivalPlan(res.plan);
        if (res.usageAlert) {
          toast.warning(res.usageAlert, { duration: 6000 });
        }
      } else {
        toast.error((res as any).error || "Failed to generate revival plan.");
      }
    } catch (err: any) {
      toast.error(err.message || "AI service error.");
    } finally {
      setLoadingRevival(false);
    }
  };

  // Generate AI summary for pasted transcript
  const handleGenerateSummary = async () => {
    if (!rawTranscript.trim()) return;
    setSummarizing(true);
    try {
      const res = await generateTranscriptSummaryAction(rawTranscript);
      if (res.success && "summary" in res) {
        setSummarizedDraft(res.summary);
        if (res.usageAlert) {
          toast.warning(res.usageAlert, { duration: 6000 });
        }
      } else {
        toast.error((res as any).error || "Failed to summarize transcript.");
      }
    } catch (err: any) {
      toast.error(err.message || "AI service error.");
    } finally {
      setSummarizing(false);
    }
  };

  // Post summarized meeting script as a note to GHL
  const handlePostSummaryToGhl = async () => {
    if (!selectedOpportunity || !summarizedDraft.trim()) return;

    setPostingNote(true);
    try {
      const res = await addGhlContactNoteAction(
        selectedOpportunity.contactId,
        summarizedDraft,
      );
      if (res.success) {
        toast.success("AI Summary posted to GoHighLevel Notes.");
        setSummarizedDraft("");
        setRawTranscript("");
        setActiveDrawerTab("notes");
        // Reload notes list
        const reloadRes = await getContactNotesAction(
          selectedOpportunity.contactId,
        );
        if (reloadRes.success && "notes" in reloadRes) {
          setNotesList(reloadRes.notes);
        }
      } else {
        toast.error(res.error || "Failed to post AI Summary.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setPostingNote(false);
    }
  };

  // Toggle checklist step
  const toggleStep = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copying outreach script to clipboard.");
  };

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800">Connection Error</h3>
        <p className="text-sm text-slate-500 mt-2">{error}</p>
        <p className="text-xs text-slate-400 mt-1 italic">
          Verify that your GHL_LOCATION_ID and GHL_API_KEY environment variables
          are correct in your configuration.
        </p>
      </div>
    );
  }

  // Filter deals by search query? (Optional, let's keep it simple)
  const metrics = data.metrics || {
    totalValue: 0,
    activeCount: 0,
    stalledCount: 0,
    stalledValue: 0,
  };
  const stalledOpportunities = data.opportunities
    .filter((o) => o.isStalled)
    .sort((a, b) => b.daysStalled - a.daysStalled);

  return (
    <div className="w-full h-full p-8 font-sans bg-slate-50/50 relative">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            GoHighLevel Sales Pipeline
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time pipeline ingestion and automated AI revival strategies.
          </p>
        </div>

        {/* Pipeline Selector Switcher & Settings */}
        <div className="flex items-center gap-3">
          {data.pipelines.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                Pipeline:
              </span>
              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={selectedPipelineId}
                onChange={(e) => handlePipelineChange(e.target.value)}
                disabled={isSwitchingPipeline}
              >
                {data.pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {isSwitchingPipeline && (
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditRecipients(settings.recipients);
              setEditSendTime(settings.sendTime);
              setEditIsActive(settings.isActive);
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer h-9 px-3"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Reminder Settings
          </Button>
        </div>
      </div>

      {/* METRICS DASHBOARD SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Total Deal Value
            </CardTitle>
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-black text-slate-800">
              ${metrics.totalValue.toLocaleString()} USD
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Weighted potential of active deals
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Active Prospects
            </CardTitle>
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <User className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-black text-slate-800">
              {metrics.activeCount} deals
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Opportunities open in stages
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-rose-100 bg-rose-50/20">
          <CardHeader className="py-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-rose-600 uppercase tracking-wide">
              Stalled Deals (&gt;7d)
            </CardTitle>
            <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-black text-rose-600">
              {metrics.stalledCount} warnings
            </div>
            <p className="text-[10px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" /> Requires immediate action plans
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Stalled Value
            </CardTitle>
            <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-black text-slate-800">
              ${metrics.stalledValue.toLocaleString()} USD
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              Capital currently bleeding or stagnant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* VIEW TAB SELECTOR */}
      <div className="flex gap-4 mt-8 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab("board")}
          className={`pb-1 text-sm font-bold flex items-center gap-1.5 transition-colors border-b-2 px-1 ${
            activeMainTab === "board"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Pipeline Stage Board
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("stalled")}
          className={`pb-1 text-sm font-bold flex items-center gap-1.5 transition-colors border-b-2 px-1 relative ${
            activeMainTab === "stalled"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          Stalled / Warning Leads
          {metrics.stalledCount > 0 && (
            <Badge className="ml-1 bg-rose-500 text-white rounded-full px-1.5 py-0.5 text-[9px] hover:bg-rose-600">
              {metrics.stalledCount}
            </Badge>
          )}
        </button>
      </div>

      {/* KANBAN BOARD VIEW */}
      {activeMainTab === "board" && (
        <div className="flex gap-4 mt-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          {data.stages.map((stage) => {
            const stageDeals = data.opportunities.filter(
              (o) => o.stageId === stage.id,
            );
            const totalStageValue = stageDeals.reduce(
              (sum, o) => sum + (o.monetaryValue || 0),
              0,
            );

            return (
              <div
                key={stage.id}
                className="min-w-[280px] max-w-[320px] w-full flex-shrink-0 flex flex-col h-[600px] rounded-xl bg-slate-100/60 border border-slate-200/80 p-3.5"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 truncate max-w-[180px]">
                      {stage.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      ${totalStageValue.toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold px-2 py-0.5 bg-white border-slate-200"
                  >
                    {stageDeals.length}
                  </Badge>
                </div>

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto mt-3.5 space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                  {stageDeals.length > 0 ? (
                    stageDeals.map((opp) => (
                      <Card
                        key={opp.id}
                        className={`shadow-sm border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer relative overflow-hidden group ${
                          opp.isStalled ? "border-l-4 border-l-rose-500" : ""
                        }`}
                        onClick={() => openOpportunityDetails(opp)}
                      >
                        <CardContent className="p-3">
                          {opp.isStalled && (
                            <Badge className="absolute top-2.5 right-2.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 text-[9px] px-1.5 py-0">
                              Stalled {opp.daysStalled}d
                            </Badge>
                          )}
                          <p className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors pr-10 truncate">
                            {opp.name}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                            <span className="text-slate-700 font-bold">
                              ${(opp.monetaryValue || 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 max-w-[120px] truncate">
                              <User className="w-3 h-3 text-slate-300 shrink-0" />
                              {opp.ownerName}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
                      <p className="text-[10px] font-semibold">
                        No prospects in stage
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STALLED WARNING LIST VIEW */}
      {activeMainTab === "stalled" && (
        <Card className="mt-6 border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800">
              Critical Stalled Warning Board
            </CardTitle>
            <CardDescription className="text-[11px]">
              Leads without CRM activity in the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {stalledOpportunities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                      <th className="text-xs font-bold text-slate-600 pl-6 py-3">
                        Prospect
                      </th>
                      <th className="text-xs font-bold text-slate-600 py-3">
                        Deal Value
                      </th>
                      <th className="text-xs font-bold text-slate-600 py-3">
                        Stage
                      </th>
                      <th className="text-xs font-bold text-slate-600 py-3">
                        Assigned Owner
                      </th>
                      <th className="text-xs font-bold text-slate-600 py-3">
                        Days Stalled
                      </th>
                      <th className="text-xs font-bold text-slate-600 text-right pr-6 py-3">
                        Revive
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stalledOpportunities.map((opp) => (
                      <tr
                        key={opp.id}
                        className="hover:bg-slate-50/30 border-b border-slate-100 group cursor-pointer transition-colors"
                        onClick={() => openOpportunityDetails(opp)}
                      >
                        <td className="pl-6 py-3">
                          <p className="text-xs font-bold text-slate-800 pr-4">
                            {opp.name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            {opp.contactName} • {opp.contactEmail}
                          </span>
                        </td>
                        <td className="text-xs font-semibold text-slate-800 py-3">
                          ${(opp.monetaryValue || 0).toLocaleString()}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold px-2 py-0.5 border-slate-200"
                          >
                            {data.stages.find((s) => s.id === opp.stageId)
                              ?.name || "Lead"}
                          </Badge>
                        </td>
                        <td className="text-xs text-slate-600 font-medium py-3">
                          {opp.ownerName}
                        </td>
                        <td className="py-3">
                          <span className="text-xs font-extrabold text-rose-600 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {opp.daysStalled} days
                          </span>
                        </td>
                        <td className="text-right pr-6 py-3">
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold h-7 flex items-center gap-1 ml-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOpportunityDetails(opp);
                            }}
                          >
                            <BrainCircuit className="w-3.5 h-3.5" />
                            Plan Revival
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 italic">
                Awesome! You have zero stalled sales opportunities. Every
                prospect has been followed up with.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DRAWER SLIDE-OVER DRAWER (Selected Opportunity details & CRM Utilities) */}
      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
            onClick={() => setSelectedOpportunity(null)}
          />

          {/* Slider Container */}
          <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Header info */}
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div className="space-y-1 max-w-[420px]">
                <Badge
                  className={
                    selectedOpportunity.isStalled
                      ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 mb-1"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 mb-1"
                  }
                >
                  {selectedOpportunity.isStalled
                    ? `Warning: Stalled for ${selectedOpportunity.daysStalled} days`
                    : "Active Deal"}
                </Badge>
                <h2 className="text-base font-extrabold text-slate-800 truncate">
                  {selectedOpportunity.name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-semibold pt-1">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-300" />
                    Owner: {selectedOpportunity.ownerName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-700 font-bold">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    Value: $
                    {(selectedOpportunity.monetaryValue || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-7 h-7 p-0 rounded-full border-slate-200 text-slate-400 hover:text-slate-700"
                onClick={() => setSelectedOpportunity(null)}
              >
                ✕
              </Button>
            </div>

            {/* Contact details sub-panel */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                {selectedOpportunity.contactName}
              </span>
              {selectedOpportunity.contactEmail && (
                <span className="flex items-center gap-1 truncate max-w-[180px]">
                  <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  {selectedOpportunity.contactEmail}
                </span>
              )}
              {selectedOpportunity.contactPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  {selectedOpportunity.contactPhone}
                </span>
              )}
            </div>

            {/* Utility Tabs Selector */}
            <div className="flex gap-4 border-b border-slate-200 bg-white px-6 pt-3 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveDrawerTab("revival")}
                className={`pb-1 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 px-0.5 ${
                  activeDrawerTab === "revival"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <BrainCircuit className="w-4 h-4 text-indigo-600" />
                AI Revival Plan
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerTab("notes")}
                className={`pb-1 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 px-0.5 ${
                  activeDrawerTab === "notes"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Clipboard className="w-4 h-4 text-slate-500" />
                Notes History ({notesList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerTab("fathom")}
                className={`pb-1 text-xs font-bold flex items-center gap-1.5 transition-colors border-b-2 px-0.5 ${
                  activeDrawerTab === "fathom"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                AI Call Summarizer
              </button>
            </div>

            {/* TAB PANELS CONTAINER */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {/* REVIVAL PLAN PANEL */}
              {activeDrawerTab === "revival" && (
                <div className="space-y-4">
                  {revivalPlan ? (
                    <div className="space-y-4">
                      {/* Strategy Summary */}
                      <Card className="border-indigo-100 shadow-sm bg-indigo-50/20">
                        <CardHeader className="py-3">
                          <CardTitle className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                            <BrainCircuit className="w-4 h-4" /> Recommended
                            Outreach Strategy
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-1 text-xs text-slate-600 leading-relaxed font-semibold">
                          {revivalPlan.strategy}
                        </CardContent>
                      </Card>

                      {/* Action Steps Checklist */}
                      <div className="space-y-2 mt-4">
                        <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                          Revival Action Steps
                        </h4>
                        {revivalPlan.steps?.map((step: string, idx: number) => (
                          <div
                            key={step}
                            onClick={() => toggleStep(idx)}
                            className={`flex items-start gap-3 p-3 rounded-lg border bg-white shadow-sm cursor-pointer transition-all hover:bg-slate-50/50 ${
                              completedSteps[idx]
                                ? "border-emerald-200 bg-emerald-50/10 opacity-70"
                                : "border-slate-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={completedSteps[idx] || false}
                              readOnly
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0"
                            />
                            <span
                              className={`text-xs font-medium ${completedSteps[idx] ? "line-through text-slate-400" : "text-slate-700"}`}
                            >
                              {step}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Copiable Outreach script */}
                      {revivalPlan.outreachScript && (
                        <div className="space-y-2 mt-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                              Outreach Message Draft
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] font-bold flex items-center gap-1 border-slate-200"
                              onClick={() =>
                                copyToClipboard(revivalPlan.outreachScript)
                              }
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              Copy Script
                            </Button>
                          </div>
                          <div className="p-3.5 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono whitespace-pre-line leading-relaxed shadow-sm">
                            {revivalPlan.outreachScript}
                          </div>
                        </div>
                      )}

                      {/* Follow-up advisory */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold italic pt-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Remind follow-up inside{" "}
                        {revivalPlan.recommendedFollowUpDays || 3} days.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white shadow-sm">
                      <BrainCircuit className="w-10 h-10 text-indigo-500 mb-2" />
                      <h4 className="text-xs font-bold text-slate-700">
                        Need a strategy to revive this lead?
                      </h4>
                      <p className="text-[10px] text-slate-400 max-w-[280px] mt-1">
                        Gemini will evaluate the deal details, days stalled, and
                        current stage to draft custom outreach scripts and
                        action steps.
                      </p>
                      <Button
                        size="sm"
                        disabled={loadingRevival}
                        onClick={handleGenerateRevivalPlan}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs mt-4 flex items-center gap-1.5"
                      >
                        {loadingRevival ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Analyzing Deal...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Revival Plan
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* NOTES HISTORY TIMELINE */}
              {activeDrawerTab === "notes" && (
                <div className="space-y-4">
                  {/* New Note Form */}
                  <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-4">
                      <form onSubmit={handleAddNote} className="space-y-3">
                        <Label
                          htmlFor="noteBody"
                          className="text-xs font-bold text-slate-600 block"
                        >
                          Add Call / Meeting Note
                        </Label>
                        <textarea
                          id="noteBody"
                          rows={3}
                          value={newNoteBody}
                          onChange={(e) => setNewNoteBody(e.target.value)}
                          placeholder="Log meeting details, pricing notes, or phone follow-up results..."
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                          disabled={postingNote}
                        />
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={postingNote || !newNoteBody.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8 flex items-center gap-1"
                          >
                            {postingNote ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving Note...
                              </>
                            ) : (
                              <>
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                Sync to GHL Notes
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Notes Timeline List */}
                  <div className="space-y-3 mt-4">
                    <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                      Contact Activity History
                    </h4>

                    {loadingNotes ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      </div>
                    ) : notesList.length > 0 ? (
                      <div className="relative pl-4 border-l-2 border-slate-200 space-y-4">
                        {notesList.map((note) => (
                          <div key={note.id} className="relative group">
                            {/* Marker dot */}
                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border bg-white border-slate-300 group-hover:border-indigo-500 transition-colors" />

                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-1.5">
                              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                <span>{note.creatorName}</span>
                                <span>
                                  {new Date(note.createdAt).toLocaleString(
                                    "en-AU",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {note.body}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 italic bg-white border border-slate-200 rounded-lg">
                        No logs or notes recorded for this contact in
                        GoHighLevel yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TRANSCRIPT SUMMARIZER PANEL */}
              {activeDrawerTab === "fathom" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="transcriptArea"
                      className="text-xs font-bold text-slate-600"
                    >
                      Paste Fathom Summary or Call Transcript
                    </Label>
                    <textarea
                      id="transcriptArea"
                      rows={5}
                      value={rawTranscript}
                      onChange={(e) => setRawTranscript(e.target.value)}
                      placeholder="Paste the meeting transcript or raw text notes here..."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white shadow-inner"
                      disabled={summarizing || postingNote}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={summarizing || !rawTranscript.trim()}
                        onClick={handleGenerateSummary}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold h-8 flex items-center gap-1.5"
                      >
                        {summarizing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Summarizing Call...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Draft Note (AI)
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {summarizedDraft && (
                    <div className="space-y-3 mt-4 border-t border-slate-200 pt-4">
                      <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                        Structured CRM Note Draft
                      </h4>

                      <textarea
                        rows={8}
                        value={summarizedDraft}
                        onChange={(e) => setSummarizedDraft(e.target.value)}
                        className="w-full text-xs p-3 font-mono border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                        disabled={postingNote}
                      />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs font-bold border-slate-200"
                          onClick={() => setSummarizedDraft("")}
                          disabled={postingNote}
                        >
                          Discard Draft
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={postingNote}
                          onClick={handlePostSummaryToGhl}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8 flex items-center gap-1 justify-center"
                        >
                          {postingNote ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                              Post to GHL Notes
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* SALES REMINDER CONFIGURATION DIALOG */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl text-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              GHL Sales Reminder Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Configure daily email warnings for stalled opportunities
              independently of Google Ads morning briefings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Status Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-lg">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">
                  Enable Daily Reminders
                </span>
                <span className="text-[11px] text-slate-400">
                  Send morning digest of stagnant leads
                </span>
              </div>
              <Switch
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>

            {/* Time of Day */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">
                Send Time (Melbourne Time)
              </Label>
              <input
                type="time"
                value={editSendTime}
                onChange={(e) => setEditSendTime(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Target Recipients */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">
                Notification Recipients
              </Label>

              {/* Select Team Members */}
              {teamMembers.length > 0 && (
                <div className="space-y-1.5 border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block mb-1">
                    Select Team Members:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {teamMembers.map((member) => {
                      if (!member.email) return null;
                      const isSelected = editRecipients.includes(member.email);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveRecipient(member.email!);
                            } else {
                              setEditRecipients([
                                ...editRecipients,
                                member.email!,
                              ]);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left text-xs font-semibold cursor-pointer transition-all ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {member.name || member.email}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Custom Email */}
              <div className="flex gap-2 mt-2">
                <input
                  type="email"
                  placeholder="custom-recipient@domain.com"
                  value={customEmailInput}
                  onChange={(e) => setCustomEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomEmail();
                    }
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Button
                  type="button"
                  onClick={handleAddCustomEmail}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs h-8 px-3 cursor-pointer"
                >
                  Add
                </Button>
              </div>

              {/* Selected Recipients Tags */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                {editRecipients.length === 0 ? (
                  <span className="text-[11px] text-amber-600 font-semibold italic flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    No recipients (falls back to entire team)
                  </span>
                ) : (
                  editRecipients.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="flex items-center gap-1 bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-[10px] font-semibold py-0.5 px-2 rounded-full"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(email)}
                        className="text-indigo-400 hover:text-indigo-600 font-bold ml-1 text-xs shrink-0 cursor-pointer"
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(false)}
                disabled={savingSettings}
                className="text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 px-5 flex items-center gap-1.5 cursor-pointer"
              >
                {savingSettings && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Save Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
