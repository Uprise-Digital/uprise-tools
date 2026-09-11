"use client";

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Flame,
  Globe,
  Grid,
  Info,
  Layers,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type AgencyNegativeKeywordsData,
  type BatchItemUpdate,
  batchDeduplicateAgencySuggestionsAction,
  batchUpdateAgencySuggestionsAction,
  fetchAllAgencyActiveNegativesAction,
  getAgencyNegativeKeywordsDataAction,
  triggerAgencyScanAction,
} from "@/actions/agency-negatives.actions";
import {
  addManualNegativeKeywordAction,
  getAccountCampaignsAction,
} from "@/actions/negative-keywords.actions";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AgencyNegativesClient() {
  const router = useRouter();

  // Loading States
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [isBatchApplying, setIsBatchApplying] = useState(false);
  const [loadingLiveActive, setLoadingLiveActive] = useState(false);

  // Main Data Store
  const [data, setData] = useState<AgencyNegativeKeywordsData | null>(null);
  const [liveActiveNegatives, setLiveActiveNegatives] = useState<
    Array<{
      adAccountId: number;
      accountName: string;
      criterionId: string;
      keyword: string;
      matchType: string;
      campaignId: string;
      campaignName: string;
    }>
  >([]);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    "matrix" | "queue" | "conflicts" | "live"
  >("matrix");

  // View Mode: 'cards' | 'table'
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>("ALL");

  // Pagination for Live Active Exclusions
  const [livePage, setLivePage] = useState<number>(1);
  const [liveLimit, setLiveLimit] = useState<number>(50);

  // Reset live page on filter change
  useEffect(() => {
    setLivePage(1);
  }, [accountFilter, searchQuery]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // In-line overrides for suggestions
  const [itemOverrides, setItemOverrides] = useState<
    Record<
      number,
      {
        matchType?: "broad" | "phrase" | "exact";
        scope?: "global" | "campaign" | "adgroup";
        customCampaignId?: string;
      }
    >
  >({});

  // Single Action Loaders
  const [itemLoaders, setItemLoaders] = useState<Record<number, boolean>>({});

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalAccountId, setAddModalAccountId] = useState<number | null>(
    null,
  );
  const [addModalKeyword, setAddModalKeyword] = useState("");
  const [addModalMatchType, setAddModalMatchType] = useState<
    "broad" | "phrase" | "exact"
  >("phrase");
  const [addModalCampaignId, setAddModalCampaignId] = useState("ALL");
  const [addModalCampaigns, setAddModalCampaigns] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Currency Formatter
  const fCur = (val: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(isNaN(val) ? 0 : val);

  // 1. Fetch Master Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAgencyNegativeKeywordsDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Failed to load agency negative keywords");
      }
    } catch (e: any) {
      toast.error(e.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load Live Active Negatives on tab switch
  useEffect(() => {
    if (activeTab === "live" && liveActiveNegatives.length === 0) {
      setLoadingLiveActive(true);
      fetchAllAgencyActiveNegativesAction()
        .then((res) => {
          if (res.success && res.data) {
            setLiveActiveNegatives(res.data);
          } else {
            toast.error(res.error || "Failed to fetch live negative keywords");
          }
        })
        .finally(() => setLoadingLiveActive(false));
    }
  }, [activeTab, liveActiveNegatives.length]);

  // Filtered Suggestions
  const filteredSuggestions = useMemo(() => {
    if (!data?.suggestions) return [];
    return data.suggestions.filter((s) => {
      // Account filter
      if (accountFilter !== "ALL" && s.adAccountId !== Number(accountFilter)) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }
      // Match type filter
      if (matchTypeFilter !== "ALL" && s.matchType !== matchTypeFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const kw = s.keyword.toLowerCase();
        const acc = s.accountName.toLowerCase();
        const sq = (s.searchQuery || "").toLowerCase();
        const camp = s.campaignName.toLowerCase();
        const rat = s.rationale.toLowerCase();
        return (
          kw.includes(q) ||
          acc.includes(q) ||
          sq.includes(q) ||
          camp.includes(q) ||
          rat.includes(q)
        );
      }
      return true;
    });
  }, [
    data?.suggestions,
    accountFilter,
    statusFilter,
    matchTypeFilter,
    searchQuery,
  ]);

  // Filtered Live Negatives
  const filteredLiveNegatives = useMemo(() => {
    return liveActiveNegatives.filter((neg) => {
      if (
        accountFilter !== "ALL" &&
        neg.adAccountId !== Number(accountFilter)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          neg.keyword.toLowerCase().includes(q) ||
          neg.accountName.toLowerCase().includes(q) ||
          neg.campaignName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [liveActiveNegatives, accountFilter, searchQuery]);

  // Paginated chunk for Live Active Negatives to prevent rendering tens of thousands of DOM nodes
  const liveTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredLiveNegatives.length / liveLimit));
  }, [filteredLiveNegatives.length, liveLimit]);

  const paginatedLiveNegatives = useMemo(() => {
    const start = (livePage - 1) * liveLimit;
    return filteredLiveNegatives.slice(start, start + liveLimit);
  }, [filteredLiveNegatives, livePage, liveLimit]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSuggestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSuggestions.map((s) => s.id)));
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Single Item Action Handler
  const handleSingleAction = async (
    id: number,
    status: "approved" | "denied" | "archived",
  ) => {
    setItemLoaders((prev) => ({ ...prev, [id]: true }));
    const override = itemOverrides[id] || {};
    try {
      const res = await batchUpdateAgencySuggestionsAction([
        {
          id,
          status,
          customMatchType: override.matchType,
          customScope: override.scope,
          customCampaignId: override.customCampaignId,
        },
      ]);
      if (res.success || res.succeededCount > 0) {
        toast.success(
          status === "approved"
            ? "Approved and pushed to Google Ads!"
            : `Suggestion marked as ${status}.`,
        );
        fetchData();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.error(res.errors?.[0] || `Failed to update status to ${status}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to perform action");
    } finally {
      setItemLoaders((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Batch Triage Handler
  const handleBatchAction = async (
    status: "approved" | "denied" | "archived",
  ) => {
    if (selectedIds.size === 0) return;
    setIsBatchApplying(true);

    const toastId = toast.loading(
      status === "approved"
        ? `Approving and deploying ${selectedIds.size} negative keywords to Google Ads...`
        : `Marking ${selectedIds.size} suggestions as ${status}...`,
    );

    try {
      const updates: BatchItemUpdate[] = Array.from(selectedIds).map((id) => {
        const override = itemOverrides[id] || {};
        return {
          id,
          status,
          customMatchType: override.matchType,
          customScope: override.scope,
          customCampaignId: override.customCampaignId,
        };
      });

      const res = await batchUpdateAgencySuggestionsAction(updates);

      if (res.succeededCount > 0) {
        toast.success(
          `Successfully processed ${res.succeededCount} exclusions${res.failedCount > 0 ? ` (${res.failedCount} failed)` : ""}`,
          { id: toastId },
        );
        setSelectedIds(new Set());
        fetchData();
      } else {
        toast.error(res.errors?.[0] || "Batch operation failed", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Error running batch action", { id: toastId });
    } finally {
      setIsBatchApplying(false);
    }
  };

  // Agency Scan Handler
  const handleTriggerScan = async () => {
    setIsScanning(true);
    const toastId = toast.loading(
      "Scanning search terms and waste across all agency client accounts with Gemini AI...",
    );
    try {
      const res = await triggerAgencyScanAction();
      if (res.success) {
        toast.success(
          `Scan complete! Checked ${res.scannedCount} accounts and found ${res.totalNewSuggestions} new exclusions.`,
          { id: toastId },
        );
        fetchData();
      } else {
        toast.error(res.errors?.[0] || "Failed to complete agency scan", {
          id: toastId,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to trigger scan", { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  // Deduplicate Handler
  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    const toastId = toast.loading(
      "Deduplicating redundant and superseded suggestions across accounts...",
    );
    try {
      const res = await batchDeduplicateAgencySuggestionsAction();
      if (res.success) {
        toast.success(
          `Cleaned up ${res.totalRemoved} redundant suggestions across the agency.`,
          { id: toastId },
        );
        fetchData();
      } else {
        toast.error(res.error || "Failed to clean suggestions", {
          id: toastId,
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to deduplicate", { id: toastId });
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Open Manual Modal
  const openManualModal = (accountId?: number) => {
    const targetId = accountId || data?.accountsList?.[0]?.id || null;
    setAddModalAccountId(targetId);
    setAddModalKeyword("");
    setAddModalMatchType("phrase");
    setAddModalCampaignId("ALL");
    setAddModalCampaigns([]);
    setShowAddModal(true);

    if (targetId) {
      getAccountCampaignsAction(targetId).then((res) => {
        if (res.success && res.data) {
          setAddModalCampaigns(res.data);
        }
      });
    }
  };

  // Submit Manual Negative
  const handleSubmitManual = async () => {
    if (!addModalAccountId || !addModalKeyword.trim()) {
      toast.error("Please enter a keyword and select a client account");
      return;
    }
    setIsSubmittingManual(true);
    try {
      const res = await addManualNegativeKeywordAction(
        addModalAccountId,
        addModalCampaignId,
        addModalKeyword.trim(),
        addModalMatchType,
      );
      if (res.success) {
        toast.success("Negative keyword pushed live to Google Ads!");
        setShowAddModal(false);
        fetchData();
      } else {
        toast.error(res.error || "Failed to add negative keyword");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to add negative keyword");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const stats = data?.stats;

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto relative min-h-screen">
      <TopProgressBar
        loading={loading || isScanning || isDeduplicating || isBatchApplying}
        color="indigo"
      />

      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
              Agency Operations / Waste Prevention
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Ban className="h-7 w-7 text-indigo-600" /> Negative Keywords
            Command Centre
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cross-client negative keyword discovery, shared waste detection, and
            portfolio-wide 1-click batch triage.
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => openManualModal()}
            disabled={loading || !data?.accountsList?.length}
            className="rounded-xl border-slate-200 bg-white text-xs font-bold h-10 px-3.5 shadow-2xs hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4 text-indigo-600" />
            Add Manual
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDeduplicate}
            disabled={isDeduplicating || loading}
            className="rounded-xl border-slate-200 bg-white text-xs font-bold h-10 px-3.5 shadow-2xs hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            {isDeduplicating ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            )}
            Deduplicate
          </Button>

          <Button
            type="button"
            onClick={handleTriggerScan}
            disabled={isScanning || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-10 px-4 shadow-sm flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning All Accounts...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Scan All Accounts
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── 2. AGENCY KPI STATS CARDS ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Wasted Spend Identified */}
          <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-white to-rose-50/20 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600/90">
                Pending Waste
              </span>
              <DollarSign className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                {fCur(stats.totalWastedSpend)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                From {stats.pendingCount} zero-conv queries
              </p>
            </div>
          </Card>

          {/* Card 2: Spend Blocked / Saved */}
          <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-white to-emerald-50/20 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600/90">
                Spend Blocked
              </span>
              <ShieldAlert className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                {fCur(stats.blockedSpendApproved)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Saved across {stats.approvedCount} approved rules
              </p>
            </div>
          </Card>

          {/* Card 3: Pending Triage Queue */}
          <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-white to-indigo-50/20 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                Pending Triage
              </span>
              <Zap className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                {stats.pendingCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Awaiting team review
              </p>
            </div>
          </Card>

          {/* Card 4: Cross-Account Conflicts */}
          <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-white to-amber-50/20 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                Shared Waste
              </span>
              <Layers className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                {stats.crossAccountConflictsCount}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Queries in &ge; 2 clients
              </p>
            </div>
          </Card>

          {/* Card 5: Turbo Mode Coverage */}
          <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-white to-slate-50/40 p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                Turbo Auto-Pilot
              </span>
              <Flame className="h-4 w-4 text-amber-500 fill-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
                {stats.turboActiveAccounts} / {stats.totalAccounts}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clients running nightly auto-push
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── 3. WORKSPACE TABS ── */}
      <div className="flex items-center justify-between border-b border-slate-200/90">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "matrix"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Overview
            {stats && (
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono">
                {stats.totalAccounts} Clients
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "queue"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Master Review Queue
            {stats && stats.pendingCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono">
                {stats.pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("conflicts")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "conflicts"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Shared Waste & Conflicts
            {stats && stats.crossAccountConflictsCount > 0 && (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono">
                {stats.crossAccountConflictsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "live"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Live Active Exclusions
            {liveActiveNegatives.length > 0 && (
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono">
                {new Intl.NumberFormat("en-AU").format(
                  liveActiveNegatives.length,
                )}
              </span>
            )}
          </button>
        </div>

        {/* View mode toggle (only on queue) */}
        {activeTab === "queue" && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg mb-2">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "cards"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Grid Card View"
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="High-Density Table View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── 4. FILTER CONTROLS TOOLBAR ── */}
      {activeTab !== "matrix" && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search negative, client, query, or rationale..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
              />
            </div>

            {/* Client Account Filter */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="text-xs h-9 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Client Accounts</option>
              {data?.accountsList?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{" "}
                  {a.pendingCount > 0 ? `(${a.pendingCount} pending)` : ""}
                </option>
              ))}
            </select>

            {/* Status Filter (Queue only) */}
            {activeTab === "queue" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs h-9 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
              >
                <option value="pending">Status: Pending Review</option>
                <option value="approved">Status: Approved</option>
                <option value="denied">Status: Denied</option>
                <option value="archived">Status: Archived</option>
                <option value="ALL">All Statuses</option>
              </select>
            )}

            {/* Match Type Filter */}
            {activeTab === "queue" && (
              <select
                value={matchTypeFilter}
                onChange={(e) => setMatchTypeFilter(e.target.value)}
                className="text-xs h-9 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Match Types</option>
                <option value="phrase">Phrase Match</option>
                <option value="exact">Exact Match</option>
                <option value="broad">Broad Match</option>
              </select>
            )}
          </div>

          {/* Selection Stats */}
          {activeTab === "queue" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs rounded-xl h-9 border-slate-200 font-bold"
              >
                {selectedIds.size === filteredSuggestions.length &&
                filteredSuggestions.length > 0
                  ? "Deselect All"
                  : `Select All (${filteredSuggestions.length})`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 5. FLOATING BATCH ACTION BAR ── */}
      {selectedIds.size > 0 && activeTab === "queue" && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white p-3 px-5 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 font-extrabold text-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold">
              Keywords Selected for Batch Action
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-400 hover:text-white rounded-xl h-8 px-3"
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBatchApplying}
              onClick={() => handleBatchAction("denied")}
              className="text-xs rounded-xl h-8 px-3 border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Deny
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBatchApplying}
              onClick={() => handleBatchAction("archived")}
              className="text-xs rounded-xl h-8 px-3 border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive
            </Button>
            <Button
              size="sm"
              disabled={isBatchApplying}
              onClick={() => handleBatchAction("approved")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8 px-4 shadow-sm flex items-center gap-1.5"
            >
              {isBatchApplying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Approve & Deploy to Google
            </Button>
          </div>
        </div>
      )}

      {/* ── 6. TAB 1: MASTER REVIEW QUEUE ── */}
      {activeTab === "queue" && (
        <div>
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3 bg-white border rounded-2xl border-slate-200/90 shadow-2xs">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">
                Loading agency suggestions...
              </p>
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white border border-dashed rounded-2xl border-slate-200">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-bold text-slate-800 mt-2">
                Queue is Clear!
              </p>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                No suggestions match your current filter settings. Click "Scan
                All Accounts" to trigger fresh discovery.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            /* Card Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuggestions.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isWorking = itemLoaders[item.id] || false;
                const override = itemOverrides[item.id] || {};
                const currentMatchType = override.matchType || item.matchType;
                const currentScope =
                  override.scope ||
                  (item.campaignId === "ALL" ? "global" : "campaign");

                return (
                  <Card
                    key={item.id}
                    className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs ${
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10"
                        : "border-slate-200/90 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <Link
                              href={`/accounts/${item.adAccountId}/negatives`}
                              className="text-xs font-extrabold text-slate-800 hover:text-indigo-600 flex items-center gap-1 group"
                            >
                              {item.accountName}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {item.googleAccountId}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                            item.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : item.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "denied"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Keyword Tag */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50/60 border border-indigo-100 px-2.5 py-1 rounded-lg">
                          {currentMatchType === "exact"
                            ? `[${item.keyword}]`
                            : currentMatchType === "phrase"
                              ? `"${item.keyword}"`
                              : item.keyword}
                        </div>

                        {/* Match Type Selector */}
                        <select
                          value={currentMatchType}
                          onChange={(e) =>
                            setItemOverrides((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...prev[item.id],
                                matchType: e.target.value as any,
                              },
                            }))
                          }
                          className="text-[11px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
                        >
                          <option value="phrase">Phrase</option>
                          <option value="exact">Exact</option>
                          <option value="broad">Broad</option>
                        </select>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Wasted Query Metadata */}
                        {item.searchQuery && (
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Triggering Query
                            </span>
                            <span className="text-xs font-medium text-slate-800 font-sans">
                              "{item.searchQuery}"
                            </span>
                          </div>
                        )}

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-center">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Spend
                            </span>
                            <p className="text-xs font-extrabold font-mono text-slate-800 mt-0.5">
                              {fCur(item.spend)}
                            </p>
                          </div>
                          <div className="border-x border-slate-200/80">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Clicks
                            </span>
                            <p className="text-xs font-extrabold font-mono text-slate-800 mt-0.5">
                              {item.clicks}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              Convs
                            </span>
                            <p className="text-xs font-extrabold font-mono text-slate-800 mt-0.5">
                              {item.conversions}
                            </p>
                          </div>
                        </div>

                        {/* Rationale */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                            <Info className="h-3 w-3 text-indigo-400" />
                            AI Rationale
                          </span>
                          <p className="text-xs text-slate-600 bg-indigo-50/20 p-2 rounded-lg border border-indigo-50 leading-relaxed italic">
                            {item.rationale}
                          </p>
                        </div>

                        {/* Target Scope */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">
                            Target Scope
                          </span>
                          <select
                            value={currentScope}
                            onChange={(e) =>
                              setItemOverrides((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  scope: e.target.value as any,
                                },
                              }))
                            }
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-semibold focus:outline-none w-full"
                          >
                            <option value="global">
                              Global (Account-wide)
                            </option>
                            <option value="campaign">
                              Campaign: {item.campaignName}
                            </option>
                          </select>
                        </div>

                        {/* Prior Error */}
                        {item.error && (
                          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-[10px] flex items-start gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span>{item.error}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5 mt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isWorking}
                          onClick={() => handleSingleAction(item.id, "denied")}
                          className="text-xs text-slate-500 hover:text-slate-800 rounded-lg h-8 px-2.5"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Deny
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isWorking}
                          onClick={() =>
                            handleSingleAction(item.id, "archived")
                          }
                          className="text-xs text-slate-400 hover:text-slate-600 rounded-lg h-8 px-2"
                        >
                          <Archive className="h-3.5 w-3.5 mr-1" />
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          disabled={isWorking}
                          onClick={() =>
                            handleSingleAction(item.id, "approved")
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg h-8 px-3 shadow-2xs flex items-center gap-1"
                        >
                          {isWorking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
              <Table className="text-xs">
                <TableHeader className="bg-slate-50/60">
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === filteredSuggestions.length &&
                          filteredSuggestions.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Client
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Suggested Negative
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Match
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Trigger Query
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Wasted Spend
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Campaign Scope
                    </TableHead>
                    <TableHead className="font-bold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="font-bold text-slate-700 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const isWorking = itemLoaders[item.id] || false;

                    return (
                      <TableRow
                        key={item.id}
                        className={`hover:bg-slate-50 border-b border-slate-50 ${
                          isSelected ? "bg-indigo-50/20" : ""
                        }`}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/accounts/${item.adAccountId}/negatives`}
                            className="font-bold text-slate-800 hover:text-indigo-600"
                          >
                            {item.accountName}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-indigo-600">
                          {item.keyword}
                        </TableCell>
                        <TableCell className="capitalize text-slate-500 font-medium">
                          {item.matchType}
                        </TableCell>
                        <TableCell
                          className="text-slate-600 max-w-[200px] truncate"
                          title={item.searchQuery || ""}
                        >
                          {item.searchQuery ? `"${item.searchQuery}"` : "—"}
                        </TableCell>
                        <TableCell className="font-extrabold font-mono text-slate-800">
                          {fCur(item.spend)}
                        </TableCell>
                        <TableCell
                          className="text-slate-500 max-w-[160px] truncate"
                          title={item.campaignName}
                        >
                          {item.campaignName}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                              item.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.status === "denied"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isWorking}
                              onClick={() =>
                                handleSingleAction(item.id, "denied")
                              }
                              className="h-7 px-2 text-slate-500 hover:text-slate-800"
                            >
                              Deny
                            </Button>
                            <Button
                              size="sm"
                              disabled={isWorking}
                              onClick={() =>
                                handleSingleAction(item.id, "approved")
                              }
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs"
                            >
                              {isWorking ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ── 7. TAB 2: SHARED WASTE & CROSS-ACCOUNT CONFLICTS ── */}
      {activeTab === "conflicts" && (
        <div className="space-y-4">
          <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
            <Layers className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cross-Client Intelligence & Repeat Waste
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                The queries below appear in search term waste across multiple
                client accounts. If a query is bleeding budget in Account A, it
                is very likely out-of-scope for Account B as well.
              </p>
            </div>
          </div>

          {data?.conflicts.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white border border-dashed rounded-2xl border-slate-200">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-bold text-slate-800 mt-2">
                No Cross-Account Waste Detected
              </p>
              <p className="text-xs text-slate-500">
                All flagged negative keywords are currently unique to their
                respective clients.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.conflicts.map((conflict, idx) => (
                <Card
                  key={idx}
                  className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs p-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-base font-extrabold text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl inline-block">
                          "{conflict.keyword}"
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Appears across{" "}
                          <span className="font-bold text-indigo-600">
                            {conflict.accountsCount} client accounts
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Total Bleed
                        </span>
                        <span className="text-sm font-extrabold font-mono text-rose-600">
                          {fCur(conflict.totalWastedSpend)}
                        </span>
                      </div>
                    </div>

                    {/* Account Occurrences Breakdown */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Affected Clients & Status:
                      </span>
                      <div className="space-y-1.5">
                        {conflict.accounts.map((acc, aIdx) => (
                          <div
                            key={aIdx}
                            className="flex items-center justify-between bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                {acc.accountName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({acc.campaignName})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">
                                {fCur(acc.spend)}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                                  acc.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : acc.status === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {acc.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => {
                        const pendingIds = conflict.accounts
                          .filter((a) => a.status === "pending")
                          .map((a) => a.suggestionId);
                        if (pendingIds.length === 0) {
                          toast.info("All instances are already reviewed.");
                          return;
                        }
                        setSelectedIds(new Set(pendingIds));
                        setActiveTab("queue");
                        toast.info(
                          `Loaded ${pendingIds.length} pending instances into review queue.`,
                        );
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-8 px-3 shadow-2xs flex items-center gap-1"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Fix Across Accounts
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 8. TAB 3: LIVE ACTIVE EXCLUSIONS IN GOOGLE ADS ── */}
      {activeTab === "live" && (
        <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              Live Deployed Negative Keywords
            </CardTitle>
            <CardDescription className="text-xs">
              Live negative keywords currently active inside connected Google
              Ads accounts via the Google Ads API.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLiveActive ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-xs">
                  Querying live campaign criteria across all client accounts...
                </p>
              </div>
            ) : filteredLiveNegatives.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <p className="font-bold text-slate-700 text-sm">
                  No Active Negative Keywords Found
                </p>
                <p className="text-xs text-slate-400">
                  No live negative keywords matched your filter.
                </p>
              </div>
            ) : (
              <>
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50/60">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="font-bold text-slate-700">
                        Client
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Negative Keyword
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Match Type
                      </TableHead>
                      <TableHead className="font-bold text-slate-700">
                        Campaign
                      </TableHead>
                      <TableHead className="font-bold text-slate-700 text-right">
                        Criterion ID
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLiveNegatives.map((row, idx) => (
                      <TableRow
                        key={`${row.criterionId}-${idx}`}
                        className="hover:bg-slate-50 border-b border-slate-50"
                      >
                        <TableCell className="font-bold text-slate-800">
                          {row.accountName}
                        </TableCell>
                        <TableCell className="font-mono font-bold text-indigo-600">
                          {row.keyword}
                        </TableCell>
                        <TableCell className="capitalize text-slate-500 font-medium">
                          {row.matchType.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {row.campaignName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-400">
                          {row.criterionId || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* PAGINATION FOOTER */}
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                  <div>
                    Showing{" "}
                    <strong className="text-slate-800 font-mono">
                      {filteredLiveNegatives.length > 0
                        ? (livePage - 1) * liveLimit + 1
                        : 0}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-slate-800 font-mono">
                      {Math.min(
                        livePage * liveLimit,
                        filteredLiveNegatives.length,
                      )}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-800 font-mono">
                      {new Intl.NumberFormat("en-AU").format(
                        filteredLiveNegatives.length,
                      )}
                    </strong>{" "}
                    active exclusions
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 bg-white shadow-2xs">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">
                        Per page:
                      </span>
                      <select
                        value={liveLimit}
                        onChange={(e) => {
                          setLiveLimit(parseInt(e.target.value, 10));
                          setLivePage(1);
                        }}
                        className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={livePage <= 1}
                        onClick={() => setLivePage(1)}
                        className="h-8 w-8 rounded-lg border-slate-200 text-xs font-bold"
                        title="First Page"
                      >
                        &laquo;
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={livePage <= 1}
                        onClick={() =>
                          setLivePage((prev) => Math.max(1, prev - 1))
                        }
                        className="h-8 w-8 rounded-lg border-slate-200"
                        title="Previous Page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <span className="text-xs px-2 font-mono font-semibold text-slate-600">
                        Page {livePage} of {liveTotalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="icon"
                        disabled={livePage >= liveTotalPages}
                        onClick={() =>
                          setLivePage((prev) =>
                            Math.min(liveTotalPages, prev + 1),
                          )
                        }
                        className="h-8 w-8 rounded-lg border-slate-200"
                        title="Next Page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={livePage >= liveTotalPages}
                        onClick={() => setLivePage(liveTotalPages)}
                        className="h-8 w-8 rounded-lg border-slate-200 text-xs font-bold"
                        title="Last Page"
                      >
                        &raquo;
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 6. TAB 1: OVERVIEW & CLIENT AUTOMATION MATRIX ── */}
      {activeTab === "matrix" && (
        <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-white overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500 fill-amber-400" />
              Client Accounts Overview & Governance Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Monitor client-level automation readiness, pending negative
              keyword suggestions, and jump into individual client workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader className="bg-slate-50/60">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="font-bold text-slate-700">
                    Client Account
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Google Ads ID
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Turbo Mode
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Target Persona
                  </TableHead>
                  <TableHead className="font-bold text-slate-700">
                    Pending Suggestions
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.accountsList?.map((acc) => (
                  <TableRow
                    key={acc.id}
                    className="hover:bg-slate-50 border-b border-slate-50"
                  >
                    <TableCell>
                      <div className="font-bold text-slate-800">{acc.name}</div>
                      {!acc.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-700 bg-amber-50 border-amber-200"
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-slate-500">
                      {acc.googleAccountId}
                    </TableCell>
                    <TableCell>
                      {acc.turboMode ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-600 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                          <Flame className="h-3.5 w-3.5 fill-amber-500" />
                          Turbo Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Manual Review
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {acc.hasTargetNotes ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          Generic Scope
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-extrabold text-slate-800">
                      {acc.pendingCount > 0 ? (
                        <span className="text-indigo-600">
                          {acc.pendingCount} pending
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          Clean
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openManualModal(acc.id)}
                          className="h-8 rounded-lg text-xs font-semibold"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(`/accounts/${acc.id}/negatives`)
                          }
                          className="h-8 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 border-indigo-200"
                        >
                          Workspace
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── 10. MANUAL ADD EXCLUSION MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <Card className="bg-white border-slate-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden">
            <div className="border-b border-slate-100 p-5 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Negative Keyword
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <CardContent className="p-6 space-y-4">
              {/* Account Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Target Client Account
                </label>
                <select
                  value={addModalAccountId || ""}
                  onChange={(e) => {
                    const accId = Number(e.target.value);
                    setAddModalAccountId(accId);
                    getAccountCampaignsAction(accId).then((res) => {
                      if (res.success && res.data) {
                        setAddModalCampaigns(res.data);
                      }
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white text-xs h-10 px-3 focus:outline-none"
                >
                  {data?.accountsList?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.googleAccountId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Keyword text */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Negative Keyword Text
                </label>
                <Input
                  type="text"
                  placeholder="e.g. cheap, free, template, portal"
                  value={addModalKeyword}
                  onChange={(e) => setAddModalKeyword(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Match Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Match Type
                  </label>
                  <select
                    value={addModalMatchType}
                    onChange={(e) =>
                      setAddModalMatchType(e.target.value as any)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs h-10 px-3 focus:outline-none"
                  >
                    <option value="phrase">Phrase Match</option>
                    <option value="exact">Exact Match</option>
                    <option value="broad">Broad Match</option>
                  </select>
                </div>

                {/* Campaign Scope */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Scope
                  </label>
                  <select
                    value={addModalCampaignId}
                    onChange={(e) => setAddModalCampaignId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white text-xs h-10 px-3 focus:outline-none"
                  >
                    <option value="ALL">All Campaigns (Global)</option>
                    {addModalCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>

            <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingManual}
                onClick={() => setShowAddModal(false)}
                className="text-xs rounded-xl h-9 px-4 border-slate-200 font-bold text-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmittingManual}
                onClick={handleSubmitManual}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl h-9 px-4 shadow-sm flex items-center gap-1.5"
              >
                {isSubmittingManual ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Deploy Negative
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
