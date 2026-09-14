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
import { Spinner } from "@/components/ui/loading";
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
          toast.error(res.error || "Failed to load standup pulse board");
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
      // Default to team sentiment or automated score as starting point
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
        toast.success(`Standup sentiment saved for ${selectedClient.name}!`);
        setLogModalOpen(false);
        // Refresh silently
        await loadData(weekOffset, true);
      } else {
        toast.error(res.error || "Failed to save pulse rating");
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
        toast.error("Could not fetch history");
      }
    } catch {
      toast.error("Error fetching pulse history");
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
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6">
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Morning Standup Pulse
                </h1>
                <Badge
                  variant="outline"
                  className="bg-indigo-950/60 border-indigo-700/50 text-indigo-300 font-mono text-[11px] uppercase"
                >
                  Weekly Retention
                </Badge>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Real-time client churn risk index, team sentiment consensus, and
                automated lead velocity.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-semibold text-slate-200">
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
              className="p-1.5 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg text-slate-400 hover:text-white transition-colors"
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
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs gap-1.5 shadow-lg shadow-indigo-600/20"
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
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs gap-1.5"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* 2. EXECUTIVE KPI SUMMARY RIBBON */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-slate-900/50 border border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
      ) : boardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Critical Watchlist */}
          <Card className="bg-slate-900/70 border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  Critical Watchlist (&gt;60% Risk)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white">
                    {boardData.summary.highRiskCount}
                  </span>
                  <span className="text-xs text-slate-400">
                    of {boardData.summary.totalClients} clients
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Requires immediate retention intervention
                </p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Moderate Risk Accounts */}
          <Card className="bg-slate-900/70 border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Moderate Risk (31–60%)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white">
                    {boardData.summary.moderateRiskCount}
                  </span>
                  <span className="text-xs text-slate-400">
                    clients monitor closely
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Performance or communication friction
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Flame className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Portfolio Retention Index */}
          <Card className="bg-slate-900/70 border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Avg Portfolio Churn Risk
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white">
                    {boardData.summary.avgPortfolioRisk}%
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      boardData.summary.avgPortfolioRisk > 40
                        ? "text-amber-400"
                        : "text-emerald-400",
                    )}
                  >
                    {boardData.summary.avgPortfolioRisk <= 30
                      ? "Healthy"
                      : boardData.summary.avgPortfolioRisk <= 50
                        ? "Caution"
                        : "High Alert"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Consensus across automated & team signals
                </p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Activity className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Team Pulse Coverage */}
          <Card className="bg-slate-900/70 border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Team Review Coverage
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-white">
                    {boardData.summary.pulseCoveragePercent}%
                  </span>
                  <span className="text-xs text-slate-400">reviewed</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${boardData.summary.pulseCoveragePercent}%`,
                    }}
                  />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Users className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* 3. SEARCH & FILTERS BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search clients, industries, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/80 border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 h-9 rounded-xl"
            />
          </div>

          {/* Risk Filter Chips */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setRiskFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors",
                riskFilter === "all"
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-white",
              )}
            >
              All ({boardData?.clients.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("high")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                riskFilter === "high"
                  ? "bg-red-500 text-white font-semibold"
                  : "text-slate-400 hover:text-red-400",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Critical ({boardData?.summary.highRiskCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("moderate")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                riskFilter === "moderate"
                  ? "bg-amber-500 text-white font-semibold"
                  : "text-slate-400 hover:text-amber-400",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Moderate ({boardData?.summary.moderateRiskCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setRiskFilter("low")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1",
                riskFilter === "low"
                  ? "bg-emerald-500 text-white font-semibold"
                  : "text-slate-400 hover:text-emerald-400",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Healthy ({boardData?.summary.healthyCount || 0})
            </button>
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="risk_desc">Highest Risk First</option>
            <option value="risk_asc">Lowest Risk First</option>
            <option value="leads_drop">Biggest Lead Drop (WoW)</option>
            <option value="name">Client Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* 4. CLIENT STANDUP TABLE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner className="h-8 w-8 text-indigo-500" />
          <p className="text-xs text-slate-500 mt-3">
            Computing churn risk & pulling team sentiment...
          </p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/30 rounded-2xl border border-slate-800">
          <HeartPulse className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">No clients found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery
              ? "No clients match your search criteria. Try clearing the filter."
              : "No active clients found in this organization. Onboard clients to start morning standup pulse checks."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const isHigh = client.riskTier === "high";
            const isModerate = client.riskTier === "moderate";

            return (
              <div
                key={client.id}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-slate-900/50 hover:bg-slate-900/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5",
                  isHigh
                    ? "border-red-500/30 hover:border-red-500/60 shadow-lg shadow-red-950/10"
                    : isModerate
                      ? "border-amber-500/30 hover:border-amber-500/60"
                      : "border-slate-800 hover:border-slate-700",
                )}
              >
                {/* Column 1: Client Overview & Status */}
                <div className="min-w-[220px] lg:max-w-xs">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-bold text-white hover:text-indigo-400 text-base transition-colors flex items-center gap-1.5 group"
                    >
                      <span>{client.name}</span>
                      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono uppercase bg-slate-800/80 border-slate-700 text-slate-300"
                    >
                      {client.industry}
                    </Badge>
                    <div className="flex items-center gap-1">
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

                {/* Column 2: Composite Churn Risk Score Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border font-mono",
                      isHigh
                        ? "bg-red-950/40 border-red-500/40 text-red-200"
                        : isModerate
                          ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                          : "bg-emerald-950/40 border-emerald-500/40 text-emerald-200",
                    )}
                  >
                    <div className="text-2xl font-black tracking-tight">
                      {client.compositeRiskScore}%
                    </div>
                    <div className="flex flex-col text-[10px] uppercase font-bold tracking-wider leading-tight">
                      <span>
                        {isHigh
                          ? "Critical Risk"
                          : isModerate
                            ? "Moderate Risk"
                            : "Healthy"}
                      </span>
                      {client.awaitingTeamPulse && (
                        <span className="text-[9px] text-amber-400 font-normal lowercase">
                          (auto score only)
                        </span>
                      )}
                    </div>

                    {/* WoW Trend */}
                    {client.wowTrend !== null && client.wowTrend !== 0 && (
                      <div
                        className={cn(
                          "ml-1 flex items-center text-xs font-bold",
                          client.wowTrend > 0
                            ? "text-red-400"
                            : "text-emerald-400",
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

                {/* Column 3: Automated Performance Radar (7-Day Leads & CPA) */}
                <div className="flex-1 min-w-[240px] bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Target className="h-3.5 w-3.5 text-indigo-400" />
                      7-Day Performance
                    </span>
                    <span>
                      Spend:{" "}
                      <strong className="text-white">
                        ${client.recentSpend}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Leads: </span>
                      <strong className="text-white font-semibold">
                        {client.recentLeads}
                      </strong>
                      {client.leadsWowChange !== null && (
                        <span
                          className={cn(
                            "ml-1 font-bold",
                            client.leadsWowChange < 0
                              ? "text-red-400"
                              : client.leadsWowChange > 0
                                ? "text-emerald-400"
                                : "text-slate-400",
                          )}
                        >
                          ({client.leadsWowChange > 0 ? "+" : ""}
                          {client.leadsWowChange}% WoW)
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400">CPA: </span>
                      <strong className="text-white font-semibold">
                        ${client.recentCpa}
                      </strong>
                      {client.targetCpa ? (
                        <span
                          className={cn(
                            "ml-1",
                            client.cpaVariance && client.cpaVariance > 15
                              ? "text-red-400 font-semibold"
                              : "text-slate-400",
                          )}
                        >
                          (Tgt: ${client.targetCpa})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Automated reason flags chips */}
                  {client.automatedFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {client.automatedFlags.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 text-[10px] font-medium border border-slate-700/50"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column 4: Team Sentiment Consensus & Staff Pills */}
                <div className="flex-1 min-w-[220px] bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      <Users className="h-3.5 w-3.5 text-indigo-400" />
                      Team Consensus
                    </span>
                    {client.teamSentimentScore !== null ? (
                      <span className="font-bold text-white">
                        {client.teamSentimentScore}% Risk
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 italic">
                        Awaiting Pulse
                      </span>
                    )}
                  </div>

                  {/* Staff Pills */}
                  {client.staffRatings.length > 0 ? (
                    <div className="space-y-1.5">
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
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px]"
                              title={`${rating.userName} (${rating.userRole || "Staff"}): ${rating.riskScore}% risk - "${rating.notes || "No notes"}"`}
                            >
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {initials}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {rating.riskScore}%
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Latest note snippet */}
                      {client.staffRatings[0]?.notes && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-1">
                          &ldquo;{client.staffRatings[0].notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      No team members have logged ratings for this week yet.
                    </p>
                  )}
                </div>

                {/* Column 5: Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleOpenLogModal(client)}
                    className={cn(
                      "text-xs font-semibold gap-1.5 shadow-sm",
                      client.currentUserRating
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    {client.currentUserRating ? "Edit My Pulse" : "Log Pulse"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenHistory(client)}
                    className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs px-2.5"
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

      {/* 5. LOG PULSE MODAL */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <HeartPulse className="h-5 w-5 text-indigo-400" />
              Log Morning Standup Pulse
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {selectedClient?.name} &bull; Week of {boardData?.pulseDate}
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <form onSubmit={handleSubmitRating} className="space-y-4 py-2">
              {/* Performance Context Pill */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Automated Performance Risk:</span>
                  <strong className="text-white">
                    {selectedClient.automatedRiskScore}%
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>7-Day Leads:</span>
                  <strong className="text-white">
                    {selectedClient.recentLeads} leads{" "}
                    {selectedClient.leadsWowChange !== null && (
                      <span
                        className={
                          selectedClient.leadsWowChange < 0
                            ? "text-red-400"
                            : "text-emerald-400"
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
                  <Label className="text-xs font-semibold text-slate-200">
                    Client Churn Risk (%)
                  </Label>
                  <span
                    className={cn(
                      "text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border",
                      formRiskScore > 80
                        ? "bg-red-950/60 border-red-500/50 text-red-300"
                        : formRiskScore > 60
                          ? "bg-orange-950/60 border-orange-500/50 text-orange-300"
                          : formRiskScore > 30
                            ? "bg-amber-950/60 border-amber-500/50 text-amber-300"
                            : "bg-emerald-950/60 border-emerald-500/50 text-emerald-300",
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
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                />

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(15)}
                    className="py-1 px-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-emerald-950/40 hover:text-emerald-300 border border-slate-800 text-slate-400 transition-colors"
                  >
                    🟢 15% (Low)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(45)}
                    className="py-1 px-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-amber-950/40 hover:text-amber-300 border border-slate-800 text-slate-400 transition-colors"
                  >
                    🟡 45% (Med)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(75)}
                    className="py-1 px-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-orange-950/40 hover:text-orange-300 border border-slate-800 text-slate-400 transition-colors"
                  >
                    🟠 75% (High)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRiskScore(95)}
                    className="py-1 px-1.5 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-red-950/40 hover:text-red-300 border border-slate-800 text-slate-400 transition-colors"
                  >
                    🔴 95% (Crit)
                  </button>
                </div>
              </div>

              {/* Primary Factor / Driver */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">
                  Primary Driver / Tag
                </Label>
                <select
                  value={formFactor}
                  onChange={(e) => setFormFactor(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {PRIMARY_FACTORS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Standup Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-200">
                  Meeting Notes / Action Item
                </Label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Client mentioned lead quality concerns on yesterday's call. Testing new qualifier form fields today."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLogModalOpen(false)}
                  className="border-slate-800 text-slate-400 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingRating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {submittingRating ? "Saving..." : "Save Pulse"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. CLIENT PULSE HISTORY SHEET */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent className="bg-slate-950 border-slate-800 text-white w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="border-b border-slate-800 pb-4">
            <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-400" />
              Retention Pulse History &bull; {historyClient?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-400">
              Weekly sentiment timeline and meeting notes over time.
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6 text-indigo-500" />
              </div>
            ) : historyRecords.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No past standup pulse entries recorded for this client yet.
              </p>
            ) : (
              <div className="space-y-3">
                {historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          Week of {record.pulseDate}
                        </span>
                        <span className="text-slate-500">&bull;</span>
                        <span className="text-slate-400 font-medium">
                          {record.userName}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded font-mono font-bold text-[11px]",
                          record.riskScore > 60
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : record.riskScore > 30
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800",
                        )}
                      >
                        {record.riskScore}% Risk
                      </span>
                    </div>

                    {record.primaryFactor && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-800/60 border-slate-700 text-slate-300 font-normal"
                      >
                        {PRIMARY_FACTORS.find(
                          (f) => f.value === record.primaryFactor,
                        )?.label || record.primaryFactor}
                      </Badge>
                    )}

                    {record.notes && (
                      <p className="text-slate-300 text-xs bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 mt-1">
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

      {/* 7. MEETING PRESENTATION MODE MODAL */}
      <Dialog open={meetingModeOpen} onOpenChange={setMeetingModeOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-2xl p-6 sm:p-8">
          {activeMeetingClient ? (
            <div className="space-y-6">
              {/* Standup Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white font-mono text-xs">
                    Client {meetingClientIndex + 1} of {filteredClients.length}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Standup Meeting Focus
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={meetingClientIndex === 0}
                    onClick={handlePrevMeetingClient}
                    className="border-slate-800 bg-slate-900 text-slate-300 text-xs gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    disabled={meetingClientIndex >= filteredClients.length - 1}
                    onClick={handleNextMeetingClient}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Main Client Profile in Meeting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {activeMeetingClient.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeMeetingClient.industry} &bull;{" "}
                    {activeMeetingClient.googleEnabled ? "Google Ads " : ""}
                    {activeMeetingClient.metaEnabled ? "Meta Ads" : ""}
                  </p>
                </div>

                {/* Big Risk Gauge */}
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl border text-center font-mono",
                    activeMeetingClient.riskTier === "high"
                      ? "bg-red-950/60 border-red-500/50 text-red-200"
                      : activeMeetingClient.riskTier === "moderate"
                        ? "bg-amber-950/60 border-amber-500/50 text-amber-200"
                        : "bg-emerald-950/60 border-emerald-500/50 text-emerald-200",
                  )}
                >
                  <div className="text-3xl font-black">
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
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-indigo-400" />
                    Automated 7-Day Numbers
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Leads:</span>
                      <strong className="text-white font-bold">
                        {activeMeetingClient.recentLeads} leads{" "}
                        {activeMeetingClient.leadsWowChange !== null && (
                          <span
                            className={
                              activeMeetingClient.leadsWowChange < 0
                                ? "text-red-400"
                                : "text-emerald-400"
                            }
                          >
                            ({activeMeetingClient.leadsWowChange > 0 ? "+" : ""}
                            {activeMeetingClient.leadsWowChange}% WoW)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current CPA:</span>
                      <strong className="text-white font-bold">
                        ${activeMeetingClient.recentCpa}
                        {activeMeetingClient.targetCpa && (
                          <span className="text-slate-400 font-normal ml-1">
                            (Target: ${activeMeetingClient.targetCpa})
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">7-Day Spend:</span>
                      <strong className="text-white font-bold">
                        ${activeMeetingClient.recentSpend}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    Team Sentiment Check-In
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Consensus Score:</span>
                      <strong className="text-white font-bold">
                        {activeMeetingClient.teamSentimentScore !== null
                          ? `${activeMeetingClient.teamSentimentScore}%`
                          : "Not yet reviewed"}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Staff Reviews:</span>
                      <strong className="text-white font-bold">
                        {activeMeetingClient.staffRatingsCount} member(s)
                      </strong>
                    </div>
                    {activeMeetingClient.staffRatings[0]?.notes && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-2 pt-1 border-t border-slate-800">
                        &ldquo;{activeMeetingClient.staffRatings[0].notes}
                        &rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions in Meeting Mode */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <Button
                  size="sm"
                  onClick={() => handleOpenLogModal(activeMeetingClient)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Log / Update Sentiment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMeetingModeOpen(false)}
                  className="border-slate-800 text-slate-400 text-xs"
                >
                  Exit Standup Mode
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
