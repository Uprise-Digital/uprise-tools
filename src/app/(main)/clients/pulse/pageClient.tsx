"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  HeartPulse,
  History,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type ClientPulseBoardData,
  type ClientPulseItem,
  getClientPulseBoardDataAction,
  getClientPulseHistoryAction,
  submitClientPulseRatingAction,
} from "@/actions/client-pulse.actions";
import { GoogleLogo, MetaLogo } from "@/components/icons/platform-logos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner, TopProgressBar } from "@/components/ui/loading";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PRIMARY_FACTORS = [
  { value: "lead_volume", label: "Lead Volume (Too Few Leads)" },
  { value: "lead_quality", label: "Lead Quality (Unqualified / Bad Leads)" },
  { value: "cpa_costs", label: "CPA / High Cost Per Lead" },
  { value: "client_communication", label: "Communication / Friction" },
  { value: "expectations", label: "Unrealistic Expectations" },
  { value: "creative_fatigue", label: "Ad Fatigue / Creative Refresh" },
  { value: "budget_friction", label: "Budget / Billing Friction" },
  { value: "other", label: "Other / General" },
];

export default function StandupPulseBoardClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boardData, setBoardData] = useState<ClientPulseBoardData | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<
    "all" | "high" | "moderate" | "low" | "unreviewed"
  >("all");
  const [sortBy, setSortBy] = useState<
    "risk_desc" | "risk_asc" | "leads_drop" | "name"
  >("risk_desc");

  // Log Pulse Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientPulseItem | null>(
    null,
  );
  const [formRiskScore, setFormRiskScore] = useState<number>(25);
  const [formFactor, setFormFactor] = useState<string>("lead_volume");
  const [formNotes, setFormNotes] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // History Sheet State
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<ClientPulseItem | null>(
    null,
  );
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Meeting Presentation Mode State
  const [meetingModeOpen, setMeetingModeOpen] = useState(false);
  const [meetingClientIndex, setMeetingClientIndex] = useState(0);

  // Fetch Board Data
  const loadData = useCallback(
    async (offset = weekOffset, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await getClientPulseBoardDataAction(offset);
        if (res.success && res.data) {
          setBoardData(res.data);
        } else {
          toast.error(res.error || "Failed to load client retention data");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [weekOffset],
  );

  useEffect(() => {
    loadData(weekOffset);
  }, [loadData, weekOffset]);

  // Open Log Modal for client
  const handleOpenLogModal = (client: ClientPulseItem) => {
    setSelectedClient(client);
    if (client.currentUserRating) {
      setFormRiskScore(client.currentUserRating.riskScore);
      setFormFactor(client.currentUserRating.primaryFactor || "lead_volume");
      setFormNotes(client.currentUserRating.notes || "");
    } else {
      const initialScore =
        client.teamSentimentScore ?? client.automatedRiskScore;
      setFormRiskScore(initialScore);
      setFormFactor(client.automatedFlags[0] ? "lead_volume" : "other");
      setFormNotes("");
    }
    setLogModalOpen(true);
  };

  // Submit Rating
  const handleSubmitRating = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedClient) return;

    setSubmittingRating(true);
    try {
      let sentimentTag:
        | "low_risk"
        | "moderate_risk"
        | "high_risk"
        | "critical" = "low_risk";
      if (formRiskScore > 80) sentimentTag = "critical";
      else if (formRiskScore > 60) sentimentTag = "high_risk";
      else if (formRiskScore > 30) sentimentTag = "moderate_risk";

      const res = await submitClientPulseRatingAction({
        clientId: selectedClient.id,
        pulseDate: boardData?.pulseDate,
        riskScore: formRiskScore,
        sentiment: sentimentTag,
        primaryFactor: formFactor,
        notes: formNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Retention sentiment saved for ${selectedClient.name}!`);
        setLogModalOpen(false);
        await loadData(weekOffset, true);
      } else {
        toast.error(res.error || "Failed to save retention rating");
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting pulse");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Open History Sheet
  const handleOpenHistory = async (client: ClientPulseItem) => {
    setHistoryClient(client);
    setHistorySheetOpen(true);
    setLoadingHistory(true);
    try {
      const res = await getClientPulseHistoryAction(client.id);
      if (res.success && res.data) {
        setHistoryRecords(res.data);
      } else {
        toast.error("Could not fetch retention history");
      }
    } catch {
      toast.error("Error fetching retention history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtered & Sorted Clients
  const filteredClients = useMemo(() => {
    if (!boardData?.clients) return [];
    let list = [...boardData.clients];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.staffRatings.some((r) => r.notes?.toLowerCase().includes(q)),
      );
    }

    // Risk Filter
    if (riskFilter === "high") {
      list = list.filter((c) => c.riskTier === "high");
    } else if (riskFilter === "moderate") {
      list = list.filter((c) => c.riskTier === "moderate");
    } else if (riskFilter === "low") {
      list = list.filter((c) => c.riskTier === "low");
    } else if (riskFilter === "unreviewed") {
      list = list.filter((c) => c.staffRatingsCount === 0);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "risk_desc")
        return b.compositeRiskScore - a.compositeRiskScore;
      if (sortBy === "risk_asc")
        return a.compositeRiskScore - b.compositeRiskScore;
      if (sortBy === "leads_drop") {
        const aChange = a.leadsWowChange ?? 0;
        const bChange = b.leadsWowChange ?? 0;
        return aChange - bChange;
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [boardData, searchQuery, riskFilter, sortBy]);

  // Meeting Mode active client
  const activeMeetingClient = filteredClients[meetingClientIndex] || null;

  const handleNextMeetingClient = () => {
    if (meetingClientIndex < filteredClients.length - 1) {
      setMeetingClientIndex((prev) => prev + 1);
    }
  };

  const handlePrevMeetingClient = () => {
    if (meetingClientIndex > 0) {
      setMeetingClientIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation in meeting mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!meetingModeOpen) return;
      if (e.key === "ArrowRight") handleNextMeetingClient();
      if (e.key === "ArrowLeft") handlePrevMeetingClient();
      if (e.key === "Escape") setMeetingModeOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [meetingModeOpen, meetingClientIndex, filteredClients.length]);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto relative">
      <TopProgressBar loading={loading || refreshing} color="indigo" />

      {/* ── 1. HEADER & CONTROLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
              Clients / Retention
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <HeartPulse className="h-7 w-7 text-indigo-600" /> Client Retention
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time client churn risk index, team sentiment consensus, and
            automated lead velocity.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Week Selector */}
          <div className="flex items-center bg-white border border-slate-200 shadow-xs rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-semibold text-slate-700">
              {weekOffset === 0
                ? "This Week"
                : weekOffset === -1
                  ? "Last Week"
                  : `${Math.abs(weekOffset)} Weeks Ago`}
            </span>
            <button
              type="button"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Standup Meeting Mode Button */}
          <Button
            onClick={() => {
              setMeetingClientIndex(0);
              setMeetingModeOpen(true);
            }}
            disabled={filteredClients.length === 0}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs gap-1.5 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Standup Mode
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(weekOffset, true)}
            disabled={refreshing}
            className="h-9 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 text-indigo-600",
                refreshing && "animate-spin",
              )}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* ── 2. EXECUTIVE KPI SUMMARY CARDS ── */}
      {loading && !boardData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white border border-slate-200/80 shadow-xs animate-pulse"
            />
          ))}
        </div>
      ) : boardData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Critical Watchlist */}
          <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-red-500 bg-white rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                  Critical Watchlist (&gt;60% Risk)
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">
                    {boardData.summary.highRiskCount}
                  </p>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {boardData.summary.totalClients} clients
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Requires immediate retention intervention
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Moderate Risk Accounts */}
          <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-amber-500 bg-white rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  Moderate Risk (31–60%)
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">
                    {boardData.summary.moderateRiskCount}
                  </p>
                  <span className="text-xs text-slate-400 font-semibold">
                    clients monitor closely
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Performance or communication friction
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                <Flame className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Portfolio Retention Index */}
          <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-indigo-500 bg-white rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Avg Portfolio Churn Risk
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">
                    {boardData.summary.avgPortfolioRisk}%
                  </p>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      boardData.summary.avgPortfolioRisk > 40
                        ? "text-amber-600"
                        : "text-emerald-600",
                    )}
                  >
                    {boardData.summary.avgPortfolioRisk <= 30
                      ? "Healthy"
                      : boardData.summary.avgPortfolioRisk <= 50
                        ? "Caution"
                        : "High Alert"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Consensus across automated &amp; team signals
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Team Pulse Coverage */}
          <Card className="py-0 m-0 shadow-sm border-slate-200 border-l-4 border-l-emerald-500 bg-white rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0 pr-2 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Team Review Coverage
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">
                    {boardData.summary.pulseCoveragePercent}%
                  </p>
                  <span className="text-xs text-slate-400 font-semibold">
                    reviewed
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${boardData.summary.pulseCoveragePercent}%`,
                    }}
                  />
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── 3. SEARCH & FILTERS BAR ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search clients, industries, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 h-9 rounded-xl"
            />
          </div>

          {/* Risk Filter Chips */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setRiskFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                riskFilter === "all"
                  ? "bg-white text-slate-900 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 font-medium",
              )}
            >
              All ({boardData?.clients.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("high")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer",
                riskFilter === "high"
                  ? "bg-white text-red-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-red-600 font-medium",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Critical ({boardData?.summary.highRiskCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("moderate")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer",
                riskFilter === "moderate"
                  ? "bg-white text-amber-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-amber-600 font-medium",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Moderate ({boardData?.summary.moderateRiskCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("low")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer",
                riskFilter === "low"
                  ? "bg-white text-emerald-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-emerald-600 font-medium",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Healthy ({boardData?.summary.healthyCount || 0})
            </button>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0 font-medium">
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="risk_desc">Highest Risk First</option>
            <option value="risk_asc">Lowest Risk First</option>
            <option value="leads_drop">Biggest Lead Drop (WoW)</option>
            <option value="name">Client Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* ── 4. CLIENT RETENTION LIST / CARDS ── */}
      {loading && !boardData ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Spinner className="h-8 w-8 text-indigo-600" />
          <p className="text-xs text-slate-500 mt-3 font-medium">
            Computing churn risk &amp; pulling team sentiment...
          </p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <HeartPulse className="h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-900">No clients found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchQuery
              ? "No clients match your search criteria. Try clearing the filter."
              : "No active clients found in this organization. Onboard clients to start tracking retention."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table Header */}
          <div className="hidden xl:grid grid-cols-[240px_160px_minmax(0,1fr)_minmax(0,1fr)_140px] gap-4 px-5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <div>Client</div>
            <div>Churn Risk</div>
            <div>7-Day Performance</div>
            <div>Team Consensus</div>
            <div className="text-right">Actions</div>
          </div>

          {filteredClients.map((client) => {
            const isHigh = client.riskTier === "high";
            const isModerate = client.riskTier === "moderate";

            return (
              <div
                key={client.id}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white hover:shadow-md grid grid-cols-1 xl:grid-cols-[240px_160px_minmax(0,1fr)_minmax(0,1fr)_140px] gap-4 items-center",
                  isHigh
                    ? "border-red-200 shadow-xs hover:border-red-300"
                    : isModerate
                      ? "border-amber-200 shadow-xs hover:border-amber-300"
                      : "border-slate-200 hover:border-slate-300 shadow-xs",
                )}
              >
                {/* Column 1: Client Overview & Status (Fixed 240px) */}
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-bold text-slate-900 hover:text-indigo-600 text-sm sm:text-base transition-colors flex items-center gap-1.5 group truncate"
                      title={client.name}
                    >
                      <span className="truncate">{client.name}</span>
                      <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold uppercase bg-slate-50 border-slate-200 text-slate-600"
                    >
                      {client.industry}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {client.googleEnabled && (
                        <div title="Google Ads Active">
                          <GoogleLogo className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {client.metaEnabled && (
                        <div title="Meta Ads Active">
                          <MetaLogo className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Composite Churn Risk Score Badge (Fixed 160px) */}
                <div className="w-full">
                  <div
                    className={cn(
                      "flex items-center justify-between px-3.5 py-2.5 rounded-xl border font-mono shadow-2xs w-full",
                      isHigh
                        ? "bg-red-50 border-red-200 text-red-800"
                        : isModerate
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800",
                    )}
                  >
                    <div className="text-xl sm:text-2xl font-black tracking-tight">
                      {client.compositeRiskScore}%
                    </div>
                    <div className="flex flex-col text-[9px] uppercase font-bold tracking-wider leading-tight text-right">
                      <span>
                        {isHigh
                          ? "Critical Risk"
                          : isModerate
                            ? "Moderate Risk"
                            : "Healthy"}
                      </span>
                      {client.awaitingTeamPulse && (
                        <span className="text-[9px] text-amber-600 font-normal lowercase">
                          (auto score only)
                        </span>
                      )}
                    </div>

                    {/* WoW Trend */}
                    {client.wowTrend !== null && client.wowTrend !== 0 && (
                      <div
                        className={cn(
                          "ml-1 flex items-center text-xs font-bold shrink-0",
                          client.wowTrend > 0
                            ? "text-red-600"
                            : "text-emerald-600",
                        )}
                        title={`Risk changed by ${client.wowTrend > 0 ? "+" : ""}${client.wowTrend}% WoW`}
                      >
                        {client.wowTrend > 0 ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                        <span>{Math.abs(client.wowTrend)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: Automated Performance Radar (Equal 1fr) */}
                <div className="w-full h-full min-h-[96px] bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Target className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      7-Day Performance
                    </span>
                    <span>
                      Spend:{" "}
                      <strong className="text-slate-900 font-bold">
                        ${client.recentSpend}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] my-1">
                    <div>
                      <span className="text-slate-500">Leads: </span>
                      <strong className="text-slate-900 font-bold">
                        {client.recentLeads}
                      </strong>
                      {client.leadsWowChange !== null && (
                        <span
                          className={cn(
                            "ml-1 font-bold",
                            client.leadsWowChange < 0
                              ? "text-red-600"
                              : client.leadsWowChange > 0
                                ? "text-emerald-600"
                                : "text-slate-500",
                          )}
                        >
                          ({client.leadsWowChange > 0 ? "+" : ""}
                          {client.leadsWowChange}% WoW)
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500">CPA: </span>
                      <strong className="text-slate-900 font-bold">
                        ${client.recentCpa}
                      </strong>
                      {client.targetCpa ? (
                        <span
                          className={cn(
                            "ml-1 text-[10px]",
                            client.cpaVariance && client.cpaVariance > 15
                              ? "text-red-600 font-bold"
                              : "text-slate-400",
                          )}
                        >
                          (Tgt: ${client.targetCpa})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Automated reason flags chips */}
                  {client.automatedFlags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {client.automatedFlags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white text-slate-700 text-[10px] font-medium border border-slate-200 shadow-2xs"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Pacing within normal targets
                    </div>
                  )}
                </div>

                {/* Column 4: Team Sentiment Consensus & Staff Pills (Equal 1fr) */}
                <div className="w-full h-full min-h-[96px] bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      Team Consensus
                    </span>
                    {client.teamSentimentScore !== null ? (
                      <span className="font-bold text-slate-900">
                        {client.teamSentimentScore}% Risk
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-semibold">
                        Awaiting Pulse
                      </span>
                    )}
                  </div>

                  {/* Staff Pills or placeholder */}
                  {client.staffRatings.length > 0 ? (
                    <div className="space-y-1 my-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {client.staffRatings.map((rating) => {
                          const initials = rating.userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <div
                              key={rating.id}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] shadow-2xs"
                              title={`${rating.userName} (${rating.userRole || "Staff"}): ${rating.riskScore}% risk - "${rating.notes || "No notes"}"`}
                            >
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {initials}
                              </span>
                              <span className="font-bold text-slate-800">
                                {rating.riskScore}%
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Latest note snippet */}
                      {client.staffRatings[0]?.notes && (
                        <p className="text-[11px] text-slate-600 italic line-clamp-1">
                          &ldquo;{client.staffRatings[0].notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic my-auto">
                      No team members have logged ratings for this week yet.
                    </p>
                  )}
                </div>

                {/* Column 5: Action Buttons (Fixed 140px) */}
                <div className="flex items-center justify-start xl:justify-end gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleOpenLogModal(client)}
                    className={cn(
                      "text-xs font-bold gap-1.5 h-8 px-3.5 rounded-xl cursor-pointer shadow-xs",
                      client.currentUserRating
                        ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    {client.currentUserRating ? "Edit" : "Log Pulse"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenHistory(client)}
                    className="h-8 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-2.5 rounded-xl cursor-pointer shadow-xs"
                    title="View historical retention trend"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. LOG PULSE SIDEBAR / SHEET (LIGHT THEME) ── */}
      <Sheet open={logModalOpen} onOpenChange={setLogModalOpen}>
        <SheetContent
          side="right"
          className="bg-white border-slate-200 text-slate-900 w-full sm:max-w-md overflow-y-auto shadow-2xl flex flex-col p-6"
        >
          <SheetHeader className="border-b border-slate-200 pb-4 pr-6">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <HeartPulse className="h-5 w-5 text-indigo-600" />
              Log Retention Pulse
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              {selectedClient?.name} &bull; Week of {boardData?.pulseDate}
            </SheetDescription>
          </SheetHeader>

          {selectedClient && (
            <form
              onSubmit={handleSubmitRating}
              className="space-y-5 py-4 flex-1 flex flex-col"
            >
              {/* Performance Context Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                <div className="flex justify-between text-slate-500">
                  <span>Automated Performance Risk:</span>
                  <strong className="text-slate-900 font-bold">
                    {selectedClient.automatedRiskScore}%
                  </strong>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>7-Day Leads:</span>
                  <strong className="text-slate-900 font-bold">
                    {selectedClient.recentLeads} leads{" "}
                    {selectedClient.leadsWowChange !== null && (
                      <span
                        className={
                          selectedClient.leadsWowChange < 0
                            ? "text-red-600 font-bold"
                            : "text-emerald-600 font-bold"
                        }
                      >
                        ({selectedClient.leadsWowChange > 0 ? "+" : ""}
                        {selectedClient.leadsWowChange}% WoW)
                      </span>
                    )}
                  </strong>
                </div>
              </div>

              {/* Risk Score Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">
                    Client Churn Risk (%)
                  </Label>
                  <span
                    className={cn(
                      "text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border",
                      formRiskScore > 80
                        ? "bg-red-50 border-red-200 text-red-700"
                        : formRiskScore > 60
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : formRiskScore > 30
                            ? "bg-amber-50/60 border-amber-200 text-amber-800"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}
                  >
                    {formRiskScore}% &bull;{" "}
                    {formRiskScore > 80
                      ? "Critical"
                      : formRiskScore > 60
                        ? "High"
                        : formRiskScore > 30
                          ? "Moderate"
                          : "Healthy"}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formRiskScore}
                  onChange={(e) =>
                    setFormRiskScore(parseInt(e.target.value, 10))
                  }
                  className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                />

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(15)}
                    className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                  >
                    🟢 15% (Low)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(45)}
                    className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-amber-50 hover:text-amber-700 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                  >
                    🟡 45% (Med)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(75)}
                    className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                  >
                    🟠 75% (High)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(95)}
                    className="py-1 px-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                  >
                    🔴 95% (Crit)
                  </button>
                </div>
              </div>

              {/* Primary Factor / Driver */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Primary Driver / Tag
                </Label>
                <select
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs"
                >
                  {PRIMARY_FACTORS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Standup Note */}
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-bold text-slate-700">
                  Meeting Notes / Action Item
                </Label>
                <textarea
                  rows={4}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Client mentioned lead quality concerns on yesterday's call. Testing new qualifier form fields today."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 mt-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogModalOpen(false)}
                  className="border-slate-200 text-slate-600 text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingRating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {submittingRating ? "Saving..." : "Save Pulse"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* ── 6. CLIENT RETENTION HISTORY SHEET (LIGHT THEME) ── */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="bg-white border-slate-200 text-slate-900 w-full sm:max-w-lg overflow-y-auto shadow-2xl">
          <SheetHeader className="border-b border-slate-200 pb-4">
            <SheetTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600" />
              Retention History &bull; {historyClient?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Weekly sentiment timeline and meeting notes over time.
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6 text-indigo-600" />
              </div>
            ) : historyRecords.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8 font-medium">
                No past retention pulse entries recorded for this client yet.
              </p>
            ) : (
              <div className="space-y-3">
                {historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          Week of {record.pulseDate}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-slate-500 font-medium">
                          {record.userName}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded font-mono font-bold text-[11px] border",
                          record.riskScore > 60
                            ? "bg-red-50 text-red-700 border-red-200"
                            : record.riskScore > 30
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200",
                        )}
                      >
                        {record.riskScore}% Risk
                      </span>
                    </div>

                    {record.primaryFactor && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-white border-slate-200 text-slate-600 font-medium"
                      >
                        {PRIMARY_FACTORS.find(
                          (f) => f.value === record.primaryFactor,
                        )?.label || record.primaryFactor}
                      </Badge>
                    )}

                    {record.notes && (
                      <p className="text-slate-700 text-xs bg-white p-2.5 rounded-lg border border-slate-200 mt-1 shadow-2xs">
                        &ldquo;{record.notes}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── 7. MEETING PRESENTATION MODE SIDEBAR / SHEET (LIGHT THEME) ── */}
      <Sheet open={meetingModeOpen} onOpenChange={setMeetingModeOpen}>
        <SheetContent
          side="right"
          className="bg-white border-slate-200 text-slate-900 w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6 sm:p-8 shadow-2xl flex flex-col"
        >
          {activeMeetingClient ? (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Standup Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 pr-6">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white font-mono text-xs px-2.5 py-1">
                    Client {meetingClientIndex + 1} of {filteredClients.length}
                  </Badge>
                  <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                    Standup Meeting Focus
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={meetingClientIndex === 0}
                    onClick={handlePrevMeetingClient}
                    className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs gap-1 rounded-xl cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    disabled={meetingClientIndex >= filteredClients.length - 1}
                    onClick={handleNextMeetingClient}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1 rounded-xl cursor-pointer font-bold shadow-2xs"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Main Client Profile in Meeting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {activeMeetingClient.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {activeMeetingClient.industry} &bull;{" "}
                    {activeMeetingClient.googleEnabled ? "Google Ads " : ""}
                    {activeMeetingClient.metaEnabled ? "Meta Ads" : ""}
                  </p>
                </div>

                {/* Big Risk Gauge */}
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl border text-center font-mono shadow-xs shrink-0",
                    activeMeetingClient.riskTier === "high"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : activeMeetingClient.riskTier === "moderate"
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800",
                  )}
                >
                  <div className="text-2xl sm:text-3xl font-black">
                    {activeMeetingClient.compositeRiskScore}%
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-widest mt-0.5">
                    {activeMeetingClient.riskTier === "high"
                      ? "CRITICAL CHURN RISK"
                      : activeMeetingClient.riskTier === "moderate"
                        ? "MODERATE RISK"
                        : "HEALTHY"}
                  </div>
                </div>
              </div>

              {/* Side-by-Side: Automated Stats vs Team Consensus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs shadow-2xs">
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-indigo-600" />
                    Automated 7-Day Numbers
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Leads:</span>
                      <strong className="text-slate-900 font-bold">
                        {activeMeetingClient.recentLeads} leads{" "}
                        {activeMeetingClient.leadsWowChange !== null && (
                          <span
                            className={
                              activeMeetingClient.leadsWowChange < 0
                                ? "text-red-600 font-bold"
                                : "text-emerald-600 font-bold"
                            }
                          >
                            ({activeMeetingClient.leadsWowChange > 0 ? "+" : ""}
                            {activeMeetingClient.leadsWowChange}% WoW)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current CPA:</span>
                      <strong className="text-slate-900 font-bold">
                        ${activeMeetingClient.recentCpa}
                        {activeMeetingClient.targetCpa && (
                          <span className="text-slate-400 font-normal ml-1">
                            (Target: ${activeMeetingClient.targetCpa})
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">7-Day Spend:</span>
                      <strong className="text-slate-900 font-bold">
                        ${activeMeetingClient.recentSpend}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs shadow-2xs">
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    Team Sentiment Check-In
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consensus Score:</span>
                      <strong className="text-slate-900 font-bold">
                        {activeMeetingClient.teamSentimentScore !== null
                          ? `${activeMeetingClient.teamSentimentScore}%`
                          : "Not yet reviewed"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Staff Reviews:</span>
                      <strong className="text-slate-900 font-bold">
                        {activeMeetingClient.staffRatingsCount} member(s)
                      </strong>
                    </div>
                    {activeMeetingClient.staffRatings[0]?.notes && (
                      <p className="text-[11px] text-slate-600 italic line-clamp-2 pt-1 border-t border-slate-200">
                        &ldquo;{activeMeetingClient.staffRatings[0].notes}
                        &rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions in Meeting Mode */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-auto">
                <Button
                  size="sm"
                  onClick={() => handleOpenLogModal(activeMeetingClient)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Log / Update Sentiment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMeetingModeOpen(false)}
                  className="border-slate-200 text-slate-600 text-xs rounded-xl cursor-pointer hover:bg-slate-50"
                >
                  Exit Standup Mode
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
