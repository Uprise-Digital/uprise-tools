"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  Check,
  Flame,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addManualNegativeKeywordAction,
  deduplicateSuggestionsAction,
  fetchActiveNegativeKeywordsAction,
  generateNegativeSuggestionsAction,
  getAccountCampaignsAction,
  getSuggestionsAction,
  saveAccountPersonaAction,
  toggleTurboModeAction,
  updateSuggestionStatusAction,
} from "@/actions/negative-keywords.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface NegativesClientWorkspaceProps {
  account: {
    id: number;
    googleAccountId: string;
    name: string;
    negativeKeywordTurboMode: boolean;
    targetNotes?: string | null;
    isActive: boolean;
    googleStatus: string;
  };
}

export default function NegativesClientWorkspace({
  account,
}: NegativesClientWorkspaceProps) {
  const router = useRouter();

  // Date Range (default to rolling 14 days)
  const today = new Date();
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(
    fourteenDaysAgo.toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  // UI States
  const [activeTab, setActiveTab] = useState<
    "pending" | "active" | "history" | "persona"
  >("pending");

  // Buyer Persona State (parsed from JSON or fallback to raw notes)
  const initialPersona = (() => {
    if (account.targetNotes) {
      try {
        const parsed = JSON.parse(account.targetNotes);
        if (typeof parsed === "object" && parsed !== null) {
          return {
            targetBuyer: parsed.targetBuyer || "",
            notTargetBuyer: parsed.notTargetBuyer || "",
            serviceScope: Array.isArray(parsed.serviceScope)
              ? parsed.serviceScope.join("\n")
              : parsed.serviceScope || "",
            outOfScope: Array.isArray(parsed.outOfScope)
              ? parsed.outOfScope.join("\n")
              : parsed.outOfScope || "",
            convertingIntentSignals: Array.isArray(
              parsed.convertingIntentSignals,
            )
              ? parsed.convertingIntentSignals.join("\n")
              : parsed.convertingIntentSignals || "",
            researchIntentSignals: Array.isArray(parsed.researchIntentSignals)
              ? parsed.researchIntentSignals.join("\n")
              : parsed.researchIntentSignals || "",
          };
        }
      } catch {
        return {
          targetBuyer: account.targetNotes || "",
          notTargetBuyer: "",
          serviceScope: "",
          outOfScope: "",
          convertingIntentSignals: "",
          researchIntentSignals: "",
        };
      }
    }
    return {
      targetBuyer: "",
      notTargetBuyer: "",
      serviceScope: "",
      outOfScope: "",
      convertingIntentSignals: "",
      researchIntentSignals: "",
    };
  })();

  const [persona, setPersona] = useState(initialPersona);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isLoadingLiveNegs, setIsLoadingLiveNegs] = useState(true);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // Data States
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeNegatives, setActiveNegatives] = useState<any[]>([]);
  const [activeSearch, setActiveSearch] = useState("");

  // Turbo Mode Warning Modal
  const [turboMode, setTurboMode] = useState(account.negativeKeywordTurboMode);
  const [showTurboModal, setShowTurboModal] = useState(false);
  const [isUpdatingTurbo, setIsUpdatingTurbo] = useState(false);

  // Manual Add Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualMatchType, setManualMatchType] = useState<
    "broad" | "phrase" | "exact"
  >("phrase");
  const [manualCampaignId, setManualCampaignId] = useState("ALL");
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [campaignList, setCampaignList] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  // Status Action Loader mapping (stores suggestionId -> true/false)
  const [statusLoaders, setStatusLoaders] = useState<Record<number, boolean>>(
    {},
  );

  // Reload DB saved suggestions
  const loadDBSuggestions = useCallback(async () => {
    setIsLoadingDB(true);
    const res = await getSuggestionsAction(account.id);
    if (res.success && res.data) {
      setSuggestions(res.data);
    } else {
      toast.error(res.error || "Failed to load keyword suggestions");
    }
    setIsLoadingDB(false);
  }, [account.id]);

  // Reload Google Ads active negative keywords
  const loadLiveActiveNegatives = useCallback(async () => {
    setIsLoadingLiveNegs(true);
    const res = await fetchActiveNegativeKeywordsAction(account.id);
    if (res.success && res.data) {
      setActiveNegatives(res.data);
    } else {
      toast.error(res.error || "Failed to fetch live active negative keywords");
    }
    setIsLoadingLiveNegs(false);
  }, [account.id]);

  useEffect(() => {
    loadDBSuggestions();
    if (account.isActive) {
      loadLiveActiveNegatives();
    }
  }, [loadDBSuggestions, loadLiveActiveNegatives, account.isActive]);

  // Handle Toggle Turbo Mode
  const handleTurboToggleClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      // Show warning modal instead of applying directly
      setShowTurboModal(true);
    } else {
      // Disabling can be done directly
      confirmDisableTurbo();
    }
  };

  const confirmEnableTurbo = async () => {
    setIsUpdatingTurbo(true);
    const res = await toggleTurboModeAction(account.id, true);
    if (res.success) {
      setTurboMode(true);
      toast.success(
        "Turbo Mode Activated! Negative keywords will be auto-applied nightly.",
      );
      setShowTurboModal(false);
    } else {
      toast.error(res.error || "Failed to activate Turbo Mode");
    }
    setIsUpdatingTurbo(false);
  };

  const confirmDisableTurbo = async () => {
    setIsUpdatingTurbo(true);
    const res = await toggleTurboModeAction(account.id, false);
    if (res.success) {
      setTurboMode(false);
      toast.success("Turbo Mode deactivated. Manual reviews required.");
    } else {
      toast.error(res.error || "Failed to deactivate Turbo Mode");
    }
    setIsUpdatingTurbo(false);
  };

  // Trigger Gemini waste generation on-demand
  const handleGenerateSuggestions = async () => {
    setIsGenerating(true);
    toast.info(
      "Analyzing search queries and active exclusions using Gemini...",
    );

    const res = (await generateNegativeSuggestionsAction(
      account.id,
      startDate,
      endDate,
    )) as any;
    if (res.success) {
      if (turboMode) {
        toast.success(
          `Success! Generated and automatically pushed ${res.pushedDirectly} negative keywords.`,
        );
      } else {
        toast.success(
          `Success! Generated ${res.newSuggestionsAdded} new suggestions for review.`,
        );
      }
      // Reload both lists
      await Promise.all([loadDBSuggestions(), loadLiveActiveNegatives()]);
    } else {
      toast.error(res.error || "Generation pipeline failed");
    }
    setIsGenerating(false);
  };

  // Trigger deduplication on-demand
  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    toast.info("Cleaning up duplicate suggestions in database...");
    const res = await deduplicateSuggestionsAction(account.id);
    if (res.success) {
      toast.success(
        `Successfully deduplicated suggestions! Removed ${res.removedCount} redundant entries.`,
      );
      await loadDBSuggestions();
    } else {
      toast.error(res.error || "Failed to run deduplication.");
    }
    setIsDeduplicating(false);
  };

  // Load campaigns list asynchronously
  const loadCampaigns = async () => {
    setIsLoadingCampaigns(true);
    const res = await getAccountCampaignsAction(account.id);
    if (res.success && res.data) {
      setCampaignList(res.data);
    } else {
      toast.error(res.error || "Failed to load campaigns list.");
    }
    setIsLoadingCampaigns(false);
  };

  // Open the Manual Add Modal and load campaign drop-down list
  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    if (campaignList.length === 0) {
      await loadCampaigns();
    }
  };

  // Submit manual negative keyword addition
  const handleAddManual = async () => {
    if (!manualKeyword.trim()) {
      toast.error("Please enter a keyword.");
      return;
    }
    setIsAddingManual(true);
    const res = await addManualNegativeKeywordAction(
      account.id,
      manualCampaignId,
      manualKeyword,
      manualMatchType,
    );
    if (res.success) {
      toast.success(`Successfully added negative keyword "${manualKeyword}"!`);
      setShowAddModal(false);
      setManualKeyword("");
      setManualMatchType("phrase");
      setManualCampaignId("ALL");
      // Reload the data tables
      await Promise.all([loadDBSuggestions(), loadLiveActiveNegatives()]);
    } else {
      toast.error(res.error || "Failed to add negative keyword.");
    }
    setIsAddingManual(false);
  };

  // Perform decision updates (Approve, Deny, Archive)
  const handleUpdateStatus = async (
    suggestionId: number,
    status: "approved" | "denied" | "archived",
    customMatchType?: "broad" | "phrase" | "exact",
  ) => {
    setStatusLoaders((prev) => ({ ...prev, [suggestionId]: true }));
    const res = await updateSuggestionStatusAction(
      suggestionId,
      status,
      customMatchType,
    );
    if (res.success) {
      toast.success(`Keyword marked as ${status}`);
      // Reload lists
      await Promise.all([loadDBSuggestions(), loadLiveActiveNegatives()]);
    } else {
      toast.error(res.error || `Failed to update keyword to ${status}`);
    }
    setStatusLoaders((prev) => ({ ...prev, [suggestionId]: false }));
  };

  // Match Type selector helper for UI card
  const handleMatchTypeChange = (
    suggestionId: number,
    newMatchType: "broad" | "phrase" | "exact",
  ) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId ? { ...s, matchType: newMatchType } : s,
      ),
    );
  };

  // Grouped suggestions
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const processedSuggestions = suggestions.filter(
    (s) => s.status !== "pending",
  );

  // Filtered live negative keywords in Google Ads
  const filteredActiveNegatives = activeNegatives.filter((neg) => {
    const searchVal = activeSearch.toLowerCase();
    return (
      neg.keyword.toLowerCase().includes(searchVal) ||
      neg.campaignName.toLowerCase().includes(searchVal) ||
      neg.matchType.toLowerCase().includes(searchVal)
    );
  });

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto min-h-screen">
      {!account.isActive && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Archived Account</p>
            <p className="text-amber-700 leading-relaxed">
              This account has been delinked from Google Ads or deactivated.
              Suggestion generation, Turbo Mode, and live mutations are
              disabled. You can still view historical database records and
              suggestions.
            </p>
          </div>
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/accounts/${account.id}`)}
            className="rounded-lg border-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
              Negative Keywords Automation
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Client:{" "}
              <span className="text-slate-800 font-semibold">
                {account.name}
              </span>{" "}
              (ID: {account.googleAccountId})
            </p>
          </div>
        </div>

        {/* Turbo Mode & Date picker controls */}
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2 shrink-0">
          {/* Turbo Mode Toggle */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 shadow-sm shrink-0">
            <div className="flex items-center gap-1">
              <Flame
                className={`h-4 w-4 ${turboMode ? "text-amber-500 fill-amber-400" : "text-slate-400"}`}
              />
              <span className="text-xs font-bold text-slate-700">Turbo</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={turboMode}
                onChange={handleTurboToggleClick}
                disabled={isUpdatingTurbo || !account.isActive}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Date Picker Container */}
          <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm px-2.5 h-10 gap-1 shrink-0">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none h-8 w-[95px] p-0 text-xs focus-visible:ring-0 shadow-none [color-scheme:light]"
            />
            <span className="text-slate-300 font-light">—</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none h-8 w-[95px] p-0 text-xs focus-visible:ring-0 shadow-none [color-scheme:light]"
            />
          </div>

          <Button
            type="button"
            onClick={handleOpenAddModal}
            disabled={isGenerating || isDeduplicating || !account.isActive}
            variant="outline"
            className="rounded-xl shadow-sm text-xs px-3 h-10 flex items-center gap-1 font-bold transition-all border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-slate-500" />
            Manual
          </Button>

          <Button
            type="button"
            onClick={handleDeduplicate}
            disabled={isDeduplicating || isGenerating || !account.isActive}
            variant="outline"
            className="rounded-xl shadow-sm text-xs px-3 h-10 flex items-center gap-1 font-bold transition-all border-slate-200 hover:bg-slate-50 text-slate-700 bg-white shrink-0"
          >
            {isDeduplicating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cleaning...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Deduplicate
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleGenerateSuggestions}
            disabled={isGenerating || isDeduplicating || !account.isActive}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm text-xs px-3 h-10 flex items-center gap-1 font-bold transition-all shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. TAB TOGGLE */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "pending"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Pending Review
          {pendingSuggestions.length > 0 && (
            <span className="ml-2 bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
              {pendingSuggestions.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "active"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Active Negative Keywords
          {activeNegatives.length > 0 && (
            <span className="ml-2 bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
              {activeNegatives.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "history"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Review History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("persona")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "persona"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Targeting Persona & Scope
        </button>
      </div>

      {/* 3. WORKSPACE CONTENT */}
      <div className="mt-4">
        {/* TAB 1: PENDING SUGGESTIONS */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            {isLoadingDB ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 bg-white border rounded-2xl border-slate-150">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-xs font-medium">
                  Loading saved suggestions...
                </p>
              </div>
            ) : pendingSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 bg-white border border-dashed rounded-2xl border-slate-200 shadow-inner">
                <Ban className="h-10 w-10 text-slate-300" />
                <div className="text-center">
                  <p className="font-bold text-slate-700 text-sm">
                    No Pending Suggestions
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Click "Generate Exclusions" above to trigger Gemini to
                    analyze recent search term waste.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingSuggestions.map((item) => {
                  const loader = statusLoaders[item.id] || false;
                  return (
                    <Card
                      key={item.id}
                      className="bg-white border-slate-200 hover:border-slate-300 transition-all shadow-sm rounded-xl overflow-hidden flex flex-col justify-between"
                    >
                      <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Suggested Negative
                            </div>
                            <div className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded mt-1 inline-block">
                              {item.matchType === "exact"
                                ? `[${item.keyword}]`
                                : item.matchType === "phrase"
                                  ? `"${item.keyword}"`
                                  : item.keyword}
                            </div>
                          </div>

                          {/* Match Type Dropdown selector */}
                          <select
                            value={item.matchType}
                            onChange={(e) =>
                              handleMatchTypeChange(
                                item.id,
                                e.target.value as any,
                              )
                            }
                            className="text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-600 font-semibold focus:outline-none"
                          >
                            <option value="phrase">Phrase Match</option>
                            <option value="exact">Exact Match</option>
                            <option value="broad">Broad Match</option>
                          </select>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 space-y-4 flex-1">
                        {/* Search term source query & Campaign context */}
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Trigger Query
                          </span>
                          <p
                            className="text-xs text-slate-800 font-mono mt-0.5 bg-slate-50 px-2 py-1 rounded truncate"
                            title={item.searchQuery}
                          >
                            {item.searchQuery || "N/A"}
                          </p>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                          <div className="text-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Spend
                            </span>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">
                              AUD ${Number(item.spend || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-center border-x border-slate-200">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Clicks
                            </span>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">
                              {item.clicks || 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Convs
                            </span>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">
                              {Number(item.conversions || 0)}
                            </p>
                          </div>
                        </div>

                        {/* Gemini Rationale */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                            <Info className="h-3 w-3 text-indigo-400" />
                            AI Rationale
                          </div>
                          <p className="text-xs text-slate-600 italic bg-indigo-50/20 p-2 rounded border border-indigo-50/50 leading-relaxed">
                            {item.rationale}
                          </p>
                        </div>

                        {/* Campaign scope info */}
                        <div
                          className="text-[10px] text-slate-400 font-semibold truncate"
                          title={item.campaignName}
                        >
                          Campaign:{" "}
                          <span className="text-slate-600">
                            {item.campaignName}
                          </span>
                        </div>

                        {/* Error logging (if a prior auto-push failed) */}
                        {item.error && (
                          <div className="flex items-start gap-1.5 p-2 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[10px] leading-relaxed">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                            <span>Error: {item.error}</span>
                          </div>
                        )}
                      </CardContent>

                      {/* Card Actions Footer */}
                      <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loader}
                          onClick={() => handleUpdateStatus(item.id, "denied")}
                          className="text-xs hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center gap-1 rounded-lg"
                        >
                          <X className="h-3.5 w-3.5" />
                          Deny
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loader}
                          onClick={() =>
                            handleUpdateStatus(item.id, "archived")
                          }
                          className="text-xs hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center gap-1 rounded-lg"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          disabled={loader || !account.isActive}
                          onClick={() =>
                            handleUpdateStatus(
                              item.id,
                              "approved",
                              item.matchType,
                            )
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 px-3 py-1.5"
                        >
                          {loader ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE EXCLUSIONS IN GOOGLE ADS */}
        {activeTab === "active" && (
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Ban className="h-4 w-4 text-rose-500" />
                  Live Campaign Exclusions
                </CardTitle>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  These negative keywords are currently active on campaign
                  criteria inside your Google Ads account.
                </p>
              </div>

              {/* Live search filter and refresh */}
              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search exclusions..."
                    value={activeSearch}
                    onChange={(e) => setActiveSearch(e.target.value)}
                    className="pl-8 text-xs h-9 bg-white border-slate-200"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={loadLiveActiveNegatives}
                  disabled={isLoadingLiveNegs}
                  className="rounded-lg h-9 w-9 border-slate-200 text-slate-500 hover:text-indigo-600"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isLoadingLiveNegs ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingLiveNegs ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-xs">
                    Fetching active negative keywords from Google Ads API...
                  </p>
                </div>
              ) : filteredActiveNegatives.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-1.5">
                  <p className="font-bold text-slate-700 text-sm">
                    No Active Exclusions Found
                  </p>
                  <p className="text-xs text-slate-400">
                    No negative keywords matched your filter or are defined in
                    this account.
                  </p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="font-bold text-slate-600">
                        Keyword
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Match Type
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Campaign Scope
                      </TableHead>
                      <TableHead className="font-bold text-slate-600 text-right">
                        Criterion ID
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActiveNegatives.map((neg, idx) => (
                      <TableRow
                        key={`${neg.criterionId}-${idx}`}
                        className="hover:bg-slate-50 border-b border-slate-50"
                      >
                        <TableCell className="font-mono font-bold text-slate-800">
                          {neg.matchType === "EXACT"
                            ? `[${neg.keyword}]`
                            : neg.matchType === "PHRASE"
                              ? `"${neg.keyword}"`
                              : neg.keyword}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                            {neg.matchType.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 font-medium">
                          {neg.campaignName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-400">
                          {neg.criterionId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: REVIEW HISTORY */}
        {activeTab === "history" && (
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 p-4 bg-slate-50/30">
              <CardTitle className="text-sm font-bold text-slate-800">
                Audit History Log
              </CardTitle>
              <p className="text-[11px] text-slate-400">
                A historical audit log of all negative keyword recommendations
                that have been approved, denied, or archived.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingDB ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-xs">Loading records...</p>
                </div>
              ) : processedSuggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-1.5">
                  <p className="font-bold text-slate-700 text-sm">
                    No Action History
                  </p>
                  <p className="text-xs text-slate-400">
                    No suggestions have been approved, denied, or archived yet.
                  </p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="font-bold text-slate-600">
                        Keyword
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Match Type
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Status
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Spend Blocked
                      </TableHead>
                      <TableHead className="font-bold text-slate-600">
                        Campaign
                      </TableHead>
                      <TableHead className="font-bold text-slate-600 text-right">
                        Processed At
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedSuggestions.map((item) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-slate-50 border-b border-slate-50"
                      >
                        <TableCell className="font-mono font-bold text-slate-800">
                          {item.keyword}
                        </TableCell>
                        <TableCell className="capitalize text-slate-500 font-medium">
                          {item.matchType}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : item.status === "denied"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-600">
                          AUD ${Number(item.spend || 0).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className="text-slate-400 font-medium truncate max-w-[200px]"
                          title={item.campaignName}
                        >
                          {item.campaignName}
                        </TableCell>
                        <TableCell className="text-right text-slate-400 font-mono">
                          {item.processedAt
                            ? new Date(item.processedAt).toLocaleString()
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 4: TARGETING PERSONA & SCOPE */}
        {activeTab === "persona" && (
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800">
                  Targeting Persona & Business Scope
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Define the ideal buyer persona, service boundaries, and intent
                  signals. Gemini uses this to reason about negative keyword
                  suggestions.
                </p>
              </div>
              <Button
                type="button"
                disabled={isSavingPersona}
                onClick={async () => {
                  setIsSavingPersona(true);
                  try {
                    const payload = {
                      targetBuyer: persona.targetBuyer,
                      notTargetBuyer: persona.notTargetBuyer,
                      serviceScope: persona.serviceScope
                        .split("\n")
                        .map((s: any) => s.trim())
                        .filter(Boolean),
                      outOfScope: persona.outOfScope
                        .split("\n")
                        .map((s: any) => s.trim())
                        .filter(Boolean),
                      convertingIntentSignals: persona.convertingIntentSignals
                        .split("\n")
                        .map((s: any) => s.trim())
                        .filter(Boolean),
                      researchIntentSignals: persona.researchIntentSignals
                        .split("\n")
                        .map((s: any) => s.trim())
                        .filter(Boolean),
                    };
                    const res = await saveAccountPersonaAction(
                      account.id,
                      JSON.stringify(payload),
                    );
                    if (res.success) {
                      toast.success(
                        "Targeting persona saved successfully. Gemini will use these parameters for the next generation run.",
                      );
                    } else {
                      toast.error(res.error || "Failed to save persona.");
                    }
                  } catch (error: any) {
                    toast.error(error.message || "Failed to save persona.");
                  } finally {
                    setIsSavingPersona(false);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm flex items-center gap-1.5"
              >
                {isSavingPersona ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save Configuration
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Buyer profiles */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target Buyer Profile
                    </label>
                    <textarea
                      value={persona.targetBuyer}
                      onChange={(e) =>
                        setPersona({ ...persona, targetBuyer: e.target.value })
                      }
                      placeholder="e.g. IT managers, CISOs, compliance officers at Australian businesses needing ASD Essential Eight compliance."
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 text-xs p-3 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      NOT the Target Buyer
                    </label>
                    <textarea
                      value={persona.notTargetBuyer}
                      onChange={(e) =>
                        setPersona({
                          ...persona,
                          notTargetBuyer: e.target.value,
                        })
                      }
                      placeholder="e.g. Students, researchers, seekers of free templates or self-service checklists, government portal seekers."
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 text-xs p-3 focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                  </div>
                </div>

                {/* Right Column: Signals */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Services in Scope (one per line)
                    </label>
                    <textarea
                      value={persona.serviceScope}
                      onChange={(e) =>
                        setPersona({ ...persona, serviceScope: e.target.value })
                      }
                      placeholder="e.g.\nEssential Eight assessment\ncompliance implementation\nconsultancy"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 text-xs p-3 font-mono focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Out-of-Scope Services / Excluded (one per line)
                    </label>
                    <textarea
                      value={persona.outOfScope}
                      onChange={(e) =>
                        setPersona({ ...persona, outOfScope: e.target.value })
                      }
                      placeholder="e.g.\ntraining courses\ncertifications\nfree resources"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 text-xs p-3 font-mono focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Converting Intent Signals (one per line)
                  </label>
                  <textarea
                    value={persona.convertingIntentSignals}
                    onChange={(e) =>
                      setPersona({
                        ...persona,
                        convertingIntentSignals: e.target.value,
                      })
                    }
                    placeholder="e.g.\nprovider\nconsultant\nservices\nagency\nhelp"
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 text-xs p-3 font-mono focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Research / Informational Signals (one per line)
                  </label>
                  <textarea
                    value={persona.researchIntentSignals}
                    onChange={(e) =>
                      setPersona({
                        ...persona,
                        researchIntentSignals: e.target.value,
                      })
                    }
                    placeholder="e.g.\nwhat is\nexplained\nmaturity model\nchecklist\nrequirements"
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 text-xs p-3 font-mono focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. TURBO MODE SAFETY WARNING MODAL */}
      {showTurboModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 p-6 flex items-start gap-4">
              <div className="bg-amber-100 text-amber-600 rounded-full p-2.5 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Activate Turbo Auto-Apply?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to enable **Turbo Mode** for{" "}
                  <span className="font-bold text-slate-800">
                    {account.name}
                  </span>
                  .
                </p>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                By enabling Turbo Mode:
              </p>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-2">
                <li>
                  Gemini will run daily keyword audits on a nightly basis
                  automatically.
                </li>
                <li>
                  Any generated negative keyword suggestions will **bypass
                  manual review** and immediately be pushed live to your Google
                  Ads campaigns.
                </li>
                <li>
                  We highly recommend ensuring campaign target names and website
                  URLs are correct to ensure brand safety exclusions are
                  respected.
                </li>
              </ul>
            </CardContent>

            <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isUpdatingTurbo}
                onClick={() => {
                  setShowTurboModal(false);
                  setTurboMode(false); // Reset checkbox state in header
                }}
                className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isUpdatingTurbo}
                onClick={confirmEnableTurbo}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm flex items-center gap-1.5"
              >
                {isUpdatingTurbo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Flame className="h-3.5 w-3.5" />
                )}
                Activate Auto-Push
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 5. MANUAL ADD EXCLUSION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden gap-0">
            <div className="border-b border-slate-100 p-5 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600 animate-pulse" />
                Add Negative Keyword
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="manual-keyword-input"
                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                >
                  Negative Keyword Text
                </label>
                <Input
                  id="manual-keyword-input"
                  type="text"
                  placeholder="e.g. cheap, free, helper"
                  value={manualKeyword}
                  onChange={(e) => setManualKeyword(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs h-10 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="manual-match-type-select"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Match Type
                  </label>
                  <select
                    id="manual-match-type-select"
                    value={manualMatchType}
                    onChange={(e) => setManualMatchType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs h-10 px-3 shadow-none focus:outline-none focus:border-indigo-500"
                  >
                    <option value="phrase">Phrase Match</option>
                    <option value="exact">Exact Match</option>
                    <option value="broad">Broad Match</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="manual-campaign-select"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    Scope Campaign
                  </label>
                  <select
                    id="manual-campaign-select"
                    disabled={isLoadingCampaigns}
                    value={manualCampaignId}
                    onChange={(e) => setManualCampaignId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs h-10 px-3 shadow-none focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {isLoadingCampaigns ? (
                      <option>Loading campaigns...</option>
                    ) : (
                      <>
                        <option value="ALL">All Campaigns (Global)</option>
                        {campaignList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </CardContent>

            <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isAddingManual}
                onClick={() => setShowAddModal(false)}
                className="text-xs rounded-xl h-10 px-4 border-slate-200 font-bold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isAddingManual || isLoadingCampaigns}
                onClick={handleAddManual}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-10 px-4 shadow-sm flex items-center gap-1.5"
              >
                {isAddingManual ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Add Keyword
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
