"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  ExternalLink,
  Flame,
  Gauge,
  Globe,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addCustomLandingPageAction,
  deleteCampaignLandingPageAction,
  getCampaignLandingPagesAction,
  getOrgLandingPageOverviewAction,
  type OrgOverviewData,
  runBatchLandingPageAuditsAction,
  runLandingPageAuditAction,
  saveCampaignLandingPageAction,
  syncCampaignLandingPagesAction,
} from "@/actions/lp-analysis.actions";
import { runAllLandingPageSpeedTestsAction } from "@/actions/lp-speed.actions";
import { cleanCampaignNameToSearchTerm } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner, TopProgressBar } from "@/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdAccount {
  id: number;
  googleAccountId: string;
  name: string;
}

interface CampaignLP {
  id: number;
  campaignId: string;
  campaignName: string;
  url: string;
  status: string;
  weeklySpeedCheck?: boolean;
  updatedAt: Date;
  spend30d?: number;
  conversions30d?: number;
  clicks30d?: number;
  cvr?: number;
  priority?: "CRITICAL" | "MODERATE" | "HEALTHY";
  latestAudit: {
    id: number;
    score: number;
    auditType: string;
    createdAt: Date;
  } | null;
  audits?: {
    id: number;
    score: number;
    auditType: string;
    createdAt: Date | string;
  }[];
}

interface AccountSummary {
  avgCroScore: number | null;
  coverageRatio: {
    audited: number;
    total: number;
    percent: number;
  };
  spendAtRisk: number;
  topQuickWin: string;
}

export default function LpAnalysisClientPage({
  accounts,
}: {
  accounts: AdAccount[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramAccountId = searchParams.get("accountId");

  // Selection & Search State (0 = Organization Overview)
  const [selectedAccountId, setSelectedAccountId] = useState<number>(
    paramAccountId ? Number(paramAccountId) : 0,
  );

  const selectedAccountName =
    selectedAccountId === 0
      ? "Organization Overview"
      : accounts.find((acc) => acc.id === selectedAccountId)?.name ||
        "Campaign Landing Pages";

  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignLP[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(
    null,
  );
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<
    Record<string, boolean>
  >({});

  // Org Overview State
  const [orgOverview, setOrgOverview] = useState<OrgOverviewData | null>(null);
  const [loadingOrgOverview, setLoadingOrgOverview] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<
    "all" | "audited" | "needs_audit" | "sub_70"
  >("all");
  const [syncingLps, setSyncingLps] = useState(false);

  // Batch Selection & Auditing
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<
    Record<string, boolean>
  >({});
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);

  // Edit URL State
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [editUrlValue, setEditUrlValue] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  // Single Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditCampaign, setAuditCampaign] = useState<CampaignLP | null>(null);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [auditVisual, setAuditVisual] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(1);

  // Quick Audit Modal State (Global Any URL / Standalone)
  const [isQuickAuditOpen, setIsQuickAuditOpen] = useState(false);
  const [quickAuditAccountId, setQuickAuditAccountId] = useState<number>(
    selectedAccountId > 0 ? selectedAccountId : accounts[0]?.id || 0,
  );
  const [quickAuditUrl, setQuickAuditUrl] = useState("");
  const [quickAuditKeyword, setQuickAuditKeyword] = useState("");
  const [quickAuditVisual, setQuickAuditVisual] = useState(false);
  const [isQuickAuditing, setIsQuickAuditing] = useState(false);
  const [quickAuditStep, setQuickAuditStep] = useState(1);

  // Add Custom Independent Webpage Modal State
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [addPageTitle, setAddPageTitle] = useState("");
  const [addPageUrl, setAddPageUrl] = useState("");
  const [isAddingPage, setIsAddingPage] = useState(false);

  // Deleting Landing Page State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Run PageSpeed All State
  const [isRunningPageSpeed, setIsRunningPageSpeed] = useState(false);

  const toggleExpandRow = (campaignId: string) => {
    setExpandedCampaignIds((prev) => ({
      ...prev,
      [campaignId]: !prev[campaignId],
    }));
  };

  const toggleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignIds((prev) => ({
      ...prev,
      [campaignId]: !prev[campaignId],
    }));
  };

  // Fetch Org Overview Data
  const fetchOrgOverview = useCallback(async () => {
    setLoadingOrgOverview(true);
    try {
      const res = await getOrgLandingPageOverviewAction();
      if (res.success && res.data) {
        setOrgOverview(res.data);
      } else {
        toast.error(res.error || "Failed to load organization overview.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred loading org overview.");
    } finally {
      setLoadingOrgOverview(false);
    }
  }, []);

  // Fetch Account Campaigns
  const fetchCampaigns = useCallback(async (accountId: number) => {
    if (!accountId) return;
    setLoadingCampaigns(true);
    try {
      const res = await getCampaignLandingPagesAction(accountId);
      if (res.success && res.data) {
        if (Array.isArray(res.data)) {
          setCampaigns(res.data as any);
          setAccountSummary(null);
        } else {
          setCampaigns((res.data as any).campaigns || []);
          setAccountSummary((res.data as any).accountSummary || null);
        }
        setSelectedCampaignIds({});
      } else {
        toast.error(res.error || "Failed to load campaigns.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountId === 0) {
      fetchOrgOverview();
    } else {
      fetchCampaigns(selectedAccountId);
    }
  }, [selectedAccountId, fetchOrgOverview, fetchCampaigns]);

  // Sync selectedAccountId to URL search params
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedAccountId > 0) {
      url.searchParams.set("accountId", selectedAccountId.toString());
    } else {
      url.searchParams.delete("accountId");
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedAccountId]);

  // Sync campaigns action
  const handleSyncLps = async () => {
    if (!selectedAccountId) return;
    setSyncingLps(true);
    const toastId = toast.loading("Syncing landing pages from Google Ads...");
    try {
      const res = await syncCampaignLandingPagesAction(selectedAccountId);
      if (res.success) {
        toast.success(
          `Successfully synced ${res.count} campaign landing pages!`,
          { id: toastId },
        );
        fetchCampaigns(selectedAccountId);
      } else {
        toast.error(res.error || "Failed to sync from Google Ads.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.", { id: toastId });
    } finally {
      setSyncingLps(false);
    }
  };

  // Start Editing URL
  const startEditing = (campaign: CampaignLP) => {
    setEditingCampaignId(campaign.campaignId);
    setEditUrlValue(campaign.url);
  };

  // Save Manual URL
  const saveUrl = async (campaign: CampaignLP) => {
    if (!selectedAccountId || !editUrlValue) return;
    setSavingUrl(true);
    const toastId = toast.loading("Saving landing page URL...");
    try {
      const res = await saveCampaignLandingPageAction(
        selectedAccountId,
        campaign.campaignId,
        campaign.campaignName,
        editUrlValue,
      );
      if (res.success) {
        toast.success("Landing page URL saved successfully!", { id: toastId });
        setEditingCampaignId(null);
        fetchCampaigns(selectedAccountId);
      } else {
        toast.error(res.error || "Failed to save URL.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.", { id: toastId });
    } finally {
      setSavingUrl(false);
    }
  };

  // Open Single Audit Modal
  const openAuditModal = (campaign: CampaignLP) => {
    setAuditCampaign(campaign);
    setAuditUrl(campaign.url);
    setAuditVisual(false);
    const cleaned = cleanCampaignNameToSearchTerm(campaign.campaignName);
    setAuditKeyword(cleaned || "emergency plumber sydney");
    setAuditStep(1);
    setIsAuditModalOpen(true);
  };

  // Execute Single Audit
  const handleExecuteAudit = async () => {
    if (!selectedAccountId || !auditUrl || !auditKeyword || !auditCampaign)
      return;
    setIsAuditing(true);
    setAuditStep(1);

    const stepInterval = setInterval(() => {
      setAuditStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 4500);

    try {
      const res = await runLandingPageAuditAction(
        selectedAccountId,
        auditCampaign.campaignId,
        auditCampaign.campaignName,
        auditUrl,
        auditKeyword,
        auditVisual ? "VISUAL" : "PAGE_SOURCE",
      );

      clearInterval(stepInterval);

      if (res.success && res.data) {
        toast.success("Audit complete! Opening analysis report...");
        setIsAuditModalOpen(false);
        router.push(`/lp-analysis/${res.data.auditId}`);
      } else {
        toast.error(res.error || "Failed to execute audit.");
        setIsAuditing(false);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error(err.message || "An error occurred during auditing.");
      setIsAuditing(false);
    }
  };

  // Open Quick Audit modal
  const openQuickAudit = () => {
    if (selectedAccountId > 0) {
      setQuickAuditAccountId(selectedAccountId);
    } else if (accounts.length > 0) {
      setQuickAuditAccountId(accounts[0].id);
    }
    setQuickAuditUrl("");
    setQuickAuditKeyword("");
    setQuickAuditVisual(false);
    setQuickAuditStep(1);
    setIsQuickAuditOpen(true);
  };

  // Execute Quick Audit
  const handleExecuteQuickAudit = async () => {
    const targetAccountId = Number(quickAuditAccountId);
    if (!targetAccountId || !quickAuditUrl.trim() || !quickAuditKeyword.trim()) {
      toast.error("Please fill in the landing page URL, focus search term, and account.");
      return;
    }

    if (!quickAuditUrl.startsWith("http://") && !quickAuditUrl.startsWith("https://")) {
      toast.error("URL must begin with http:// or https://");
      return;
    }

    setIsQuickAuditing(true);
    setQuickAuditStep(1);

    const stepInterval = setInterval(() => {
      setQuickAuditStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 4500);

    try {
      const res = await runLandingPageAuditAction(
        targetAccountId,
        null, // No linked campaignId for standalone quick audit
        "Standalone Quick Audit",
        quickAuditUrl.trim(),
        quickAuditKeyword.trim(),
        quickAuditVisual ? "VISUAL" : "PAGE_SOURCE",
      );

      clearInterval(stepInterval);

      if (res.success && res.data) {
        toast.success("Quick audit complete! Opening report...");
        setIsQuickAuditOpen(false);
        router.push(`/lp-analysis/${res.data.auditId}`);
      } else {
        toast.error(res.error || "Quick audit failed.");
        setIsQuickAuditing(false);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      toast.error(err.message || "An error occurred during quick audit.");
      setIsQuickAuditing(false);
    }
  };

  // Handle Add Custom Independent Webpage
  const handleAddCustomPage = async () => {
    if (!selectedAccountId) return;
    if (!addPageTitle.trim() || !addPageUrl.trim()) {
      toast.error("Please enter a page title and valid URL.");
      return;
    }

    if (!addPageUrl.startsWith("http://") && !addPageUrl.startsWith("https://")) {
      toast.error("URL must begin with http:// or https://");
      return;
    }

    setIsAddingPage(true);
    try {
      const res = await addCustomLandingPageAction(
        selectedAccountId,
        addPageTitle.trim(),
        addPageUrl.trim(),
      );

      if (res.success) {
        toast.success("Webpage added successfully!");
        setIsAddPageModalOpen(false);
        setAddPageTitle("");
        setAddPageUrl("");
        fetchCampaigns(selectedAccountId);
      } else {
        toast.error(res.error || "Failed to add webpage.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred adding webpage.");
    } finally {
      setIsAddingPage(false);
    }
  };

  // Handle Delete Landing Page
  const handleDeletePage = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from this account?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteCampaignLandingPageAction(id);
      if (res.success) {
        toast.success("Landing page removed.");
        if (selectedAccountId > 0) {
          fetchCampaigns(selectedAccountId);
        }
      } else {
        toast.error(res.error || "Failed to delete landing page.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred deleting landing page.");
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Run All PageSpeed Tests
  const handleRunAllPageSpeed = async () => {
    const isOrgView = selectedAccountId === 0;
    const label = isOrgView ? "all portfolio landing pages" : `pages in ${selectedAccountName}`;

    setIsRunningPageSpeed(true);
    try {
      const res = await runAllLandingPageSpeedTestsAction(
        isOrgView ? undefined : selectedAccountId,
        "mobile",
      );

      if (res.success) {
        toast.success(
          res.message ||
            `Started PageSpeed audits for ${label}! Track live progress in the bottom-right task monitor.`,
          { duration: 6000 },
        );
      } else {
        toast.error(res.error || "Batch PageSpeed test failed to start.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred starting batch PageSpeed tests.");
    } finally {
      setIsRunningPageSpeed(false);
    }
  };

  // Execute Batch Audit
  const handleBatchAudit = async (customCampaigns?: CampaignLP[]) => {
    const toAudit =
      customCampaigns ||
      campaigns.filter((c) => selectedCampaignIds[c.campaignId]);

    if (!toAudit.length || !selectedAccountId) return;

    const validItems = toAudit.filter((c) => c.url?.startsWith("http"));
    if (!validItems.length) {
      toast.error(
        "None of the selected campaigns have valid landing page URLs.",
      );
      return;
    }

    setIsBatchAuditing(true);
    const toastId = toast.loading(
      `Running batch CRO audit for ${validItems.length} campaigns (scraping & Gemini scoring)...`,
    );

    try {
      const items = validItems.map((c) => ({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        url: c.url,
        searchTerm: cleanCampaignNameToSearchTerm(c.campaignName),
        auditType: "PAGE_SOURCE" as const,
      }));

      const res = await runBatchLandingPageAuditsAction(
        selectedAccountId,
        items,
      );

      if (res.success && res.data) {
        toast.success(
          `Batch audit complete! Processed ${res.data.processed} of ${res.data.total} landing pages.`,
          { id: toastId },
        );
        setSelectedCampaignIds({});
        fetchCampaigns(selectedAccountId);
      } else {
        toast.error(res.error || "Batch audit failed.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during batch audit.", {
        id: toastId,
      });
    } finally {
      setIsBatchAuditing(false);
    }
  };

  // Filter campaigns
  const auditedCount = campaigns.filter((c) => c.latestAudit !== null).length;
  const needsAuditCount = campaigns.filter(
    (c) => c.latestAudit === null,
  ).length;
  const sub70Count = campaigns.filter(
    (c) => c.latestAudit !== null && c.latestAudit.score < 70,
  ).length;

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      c.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.url?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (campaignFilter === "audited") return c.latestAudit !== null;
    if (campaignFilter === "needs_audit") return c.latestAudit === null;
    if (campaignFilter === "sub_70")
      return c.latestAudit !== null && c.latestAudit.score < 70;
    return true;
  });

  const selectedCount =
    Object.values(selectedCampaignIds).filter(Boolean).length;
  const isAllSelected =
    filteredCampaigns.length > 0 &&
    filteredCampaigns.every((c) => selectedCampaignIds[c.campaignId]);

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedCampaignIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const c of filteredCampaigns) {
        next[c.campaignId] = true;
      }
      setSelectedCampaignIds(next);
    }
  };

  // Filter accounts by query
  const filteredAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase()),
  );

  const getScoreBadgeStyles = (score: number) => {
    if (score >= 85)
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50";
    if (score >= 70)
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50";
    if (score >= 50)
      return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50";
    return "bg-red-50 text-red-700 border-red-200 hover:bg-red-50";
  };

  const getPriorityBadge = (priority?: string) => {
    if (priority === "CRITICAL") {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shadow-sm"
          title="High spend with no audit or low CRO score (< 60)"
        >
          <AlertTriangle className="w-3 h-3 text-red-500" /> Critical
        </span>
      );
    }
    if (priority === "MODERATE") {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
          title="Active campaign with moderate conversion score"
        >
          <Clock className="w-3 h-3 text-amber-500" /> Review
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
        title="High score or healthy conversion flow"
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Healthy
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-2 max-w-[1400px] mx-auto relative">
      <TopProgressBar
        loading={
          syncingLps ||
          loadingCampaigns ||
          isAuditing ||
          loadingOrgOverview ||
          isBatchAuditing ||
          isRunningPageSpeed
        }
        color="indigo"
      />

      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            {selectedAccountId === 0 ? (
              <Building2 className="h-8 w-8 text-indigo-600" />
            ) : (
              <Globe className="h-8 w-8 text-indigo-600 animate-pulse" />
            )}
            {selectedAccountId === 0
              ? "Organization CRO & Speed Benchmark"
              : "Landing Page Analysis"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedAccountId === 0
              ? "Portfolio-wide conversion performance, Core Web Vitals, and prioritized conversion risk."
              : "Conduct 10-dimension CRO audits, analyze local trade competitors, and get copy-paste action scripts."}
          </p>
        </div>

        {/* Sync / Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            onClick={openQuickAudit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm h-9 px-3.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            Quick Audit
          </Button>

          <Button
            onClick={handleRunAllPageSpeed}
            disabled={
              isRunningPageSpeed ||
              loadingOrgOverview ||
              loadingCampaigns ||
              (selectedAccountId !== 0 && campaigns.length === 0)
            }
            variant="outline"
            title="Run Google PageSpeed Insights (Lighthouse Core Web Vitals) for all landing pages"
            className="border-slate-200 text-xs font-semibold flex items-center gap-2 bg-white h-9 hover:border-indigo-300 hover:text-indigo-600 shadow-sm"
          >
            {isRunningPageSpeed ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
            )}
            Run All PageSpeed
          </Button>

          {selectedAccountId === 0 ? (
            <Button
              onClick={fetchOrgOverview}
              disabled={loadingOrgOverview}
              variant="outline"
              className="border-slate-200 text-xs font-semibold flex items-center gap-2 bg-white h-9"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${loadingOrgOverview ? "animate-spin text-indigo-600" : ""}`}
              />
              Refresh Portfolio Data
            </Button>
          ) : (
            <Button
              onClick={handleSyncLps}
              disabled={syncingLps || loadingCampaigns}
              variant="outline"
              className="border-slate-200 text-xs font-semibold flex items-center gap-2 bg-white h-9"
            >
              {syncingLps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              )}
              Sync Landing Pages
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Selector Dropdown */}
      <div className="block md:hidden border-slate-200 shadow-sm bg-white p-3.5 rounded-xl border mb-4">
        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
          Select View or Client Account
        </label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(Number(e.target.value))}
          className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value={0}>🏢 Organization Overview (All Accounts)</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Desktop Sidebar Selector */}
        <Card className="hidden md:block md:col-span-1 border-slate-200 shadow-sm h-fit">
          <CardHeader className="py-0 h-12 border-b border-slate-100 flex flex-row items-center justify-between [.border-b]:pb-0 px-4">
            <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">
              Client Accounts
            </CardTitle>
          </CardHeader>

          {/* Org Overview Pinned Item */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setSelectedAccountId(0)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-xs font-bold flex items-center justify-between ${
                selectedAccountId === 0
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                  : "text-slate-700 bg-white hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 shrink-0 opacity-90" />
                <span>Organization Overview</span>
              </span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  selectedAccountId === 0
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600 border"
                }`}
              >
                All
              </span>
            </button>
          </div>

          <div className="p-3 border-b border-slate-100 bg-slate-50/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter accounts..."
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-white border-slate-200"
              />
            </div>
          </div>
          <CardContent className="p-3">
            <div className="overflow-y-auto max-h-[440px] pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all text-xs font-bold flex items-center justify-between ${
                    selectedAccountId === acc.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate pr-2">{acc.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
              ))}
              {filteredAccounts.length === 0 && (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  No matching accounts.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── MAIN CONTENT AREA ── */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          {/* ================================================================ */}
          {/* VIEW A: ORGANIZATION-WIDE BENCHMARK OVERVIEW                     */}
          {/* ================================================================ */}
          {selectedAccountId === 0 ? (
            loadingOrgOverview ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200 text-slate-400 gap-3">
                <Spinner size="xl" variant="brand" />
                <span className="text-xs font-bold text-slate-600">
                  Aggregating portfolio-wide CRO & Speed benchmarks...
                </span>
              </div>
            ) : !orgOverview ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  No organization overview data available.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Global Metric KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Org Avg CRO */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Portfolio Avg CRO
                      </span>
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {orgOverview.avgCroScore}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        / 100
                      </span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-[10px] font-extrabold ${getScoreBadgeStyles(orgOverview.avgCroScore)}`}
                      >
                        {orgOverview.avgCroScore >= 80
                          ? "Good"
                          : orgOverview.avgCroScore >= 60
                            ? "Fair"
                            : "Poor"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      {orgOverview.auditedCampaigns} audited of{" "}
                      {orgOverview.totalCampaigns} campaigns
                    </p>
                  </Card>

                  {/* Org Avg Speed */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Portfolio Avg Speed
                      </span>
                      <Gauge className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {orgOverview.avgSpeedScore}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        / 100
                      </span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-[10px] font-extrabold ${getScoreBadgeStyles(orgOverview.avgSpeedScore)}`}
                      >
                        {orgOverview.avgSpeedScore >= 80
                          ? "Fast"
                          : orgOverview.avgSpeedScore >= 50
                            ? "Moderate"
                            : "Slow"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      {orgOverview.speedTestedCampaigns} landing pages tested
                    </p>
                  </Card>

                  {/* Audit Coverage */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Audit Coverage
                      </span>
                      <ListChecks className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {orgOverview.coveragePercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${orgOverview.coveragePercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      {orgOverview.auditedCampaigns} of{" "}
                      {orgOverview.totalCampaigns} total LPs audited
                    </p>
                  </Card>

                  {/* Spend at Risk */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Spend at Risk (30d)
                      </span>
                      <Flame className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-red-600">
                        {formatCurrency(orgOverview.totalSpendAtRisk)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      Spend on unaudited or score &lt; 60 LPs
                    </p>
                  </Card>
                </div>

                {/* 2. Top 3 vs Bottom 3 Leaderboards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CRO Leaderboard */}
                  <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="py-3 px-5 border-b bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" /> CRO
                        Score Leaderboard
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Top 3 highest converting pages vs Bottom 3 high-friction
                        pages
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      {/* Top 3 */}
                      <div>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Top 3 Performing Landing Pages
                        </span>
                        {orgOverview.topCro.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No audited pages yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {orgOverview.topCro.map((item, idx) => (
                              <div
                                key={item.auditId}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all text-xs"
                              >
                                <div className="truncate pr-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-emerald-600 w-4">
                                      #{idx + 1}
                                    </span>
                                    <span>{item.accountName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate pl-5">
                                    {item.campaignName}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`font-black ${getScoreBadgeStyles(item.score)}`}
                                  >
                                    {item.score} / 100
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 p-1"
                                    onClick={() =>
                                      router.push(
                                        `/lp-analysis/${item.auditId}`,
                                      )
                                    }
                                  >
                                    Report →
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom 3 */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-black text-red-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Bottom 3 Pages Needing Optimization
                        </span>
                        {orgOverview.bottomCro.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No audited pages yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {orgOverview.bottomCro.map((item, idx) => (
                              <div
                                key={item.auditId}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-red-100 bg-red-50/30 hover:bg-red-50/60 transition-all text-xs"
                              >
                                <div className="truncate pr-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-red-500 w-4">
                                      #{idx + 1}
                                    </span>
                                    <span>{item.accountName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate pl-5">
                                    {item.campaignName}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`font-black ${getScoreBadgeStyles(item.score)}`}
                                  >
                                    {item.score} / 100
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 p-1"
                                    onClick={() =>
                                      router.push(
                                        `/lp-analysis/${item.auditId}`,
                                      )
                                    }
                                  >
                                    Fix →
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Speed Leaderboard */}
                  <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="py-3 px-5 border-b bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-blue-600" /> Page Speed
                        Leaderboard
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Fastest loading landing pages vs Slowest Core Web Vitals
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      {/* Top 3 Fastest */}
                      <div>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Top 3 Fastest Pages
                        </span>
                        {orgOverview.topSpeed.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No speed tests recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {orgOverview.topSpeed.map((item, idx) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all text-xs"
                              >
                                <div className="truncate pr-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-emerald-600 w-4">
                                      #{idx + 1}
                                    </span>
                                    <span>{item.accountName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate pl-5">
                                    {item.url}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {item.lcpDisplay && (
                                    <span className="text-[9px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                      LCP: {item.lcpDisplay}
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`font-black ${getScoreBadgeStyles(item.performanceScore)}`}
                                  >
                                    {item.performanceScore} / 100
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom 3 Slowest */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-black text-red-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Bottom 3 Slowest Core Web Vitals
                        </span>
                        {orgOverview.bottomSpeed.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No speed tests recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {orgOverview.bottomSpeed.map((item, idx) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-red-100 bg-red-50/30 hover:bg-red-50/60 transition-all text-xs"
                              >
                                <div className="truncate pr-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-red-500 w-4">
                                      #{idx + 1}
                                    </span>
                                    <span>{item.accountName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate pl-5">
                                    {item.url}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {item.lcpDisplay && (
                                    <span className="text-[9px] font-mono font-bold bg-red-100/60 px-1.5 py-0.5 rounded text-red-700">
                                      LCP: {item.lcpDisplay}
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`font-black ${getScoreBadgeStyles(item.performanceScore)}`}
                                  >
                                    {item.performanceScore} / 100
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 3. Portfolio Accounts Conversion Health Table */}
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="py-3.5 px-6 border-b bg-slate-50/50">
                    <CardTitle className="text-base font-bold text-slate-800">
                      Client Accounts Conversion Triage
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ranked by 30-day ad spend at risk on unaudited or
                      low-score landing pages
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-bold pl-6 text-xs w-[30%]">
                            Client Account
                          </TableHead>
                          <TableHead className="font-bold text-xs text-center w-[18%]">
                            Audit Coverage
                          </TableHead>
                          <TableHead className="font-bold text-xs text-center w-[16%]">
                            Avg CRO Score
                          </TableHead>
                          <TableHead className="font-bold text-xs text-center w-[16%]">
                            Avg Speed Score
                          </TableHead>
                          <TableHead className="font-bold text-xs text-right pr-6 w-[20%]">
                            30d Spend at Risk
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgOverview.accountBreakdown.map((acc) => (
                          <TableRow
                            key={acc.id}
                            className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedAccountId(acc.id)}
                          >
                            <TableCell className="font-bold text-slate-900 text-xs pl-6">
                              <div className="flex items-center gap-2">
                                <span>{acc.name}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              <span className="font-semibold text-slate-700">
                                {acc.auditedCount} / {acc.totalCampaigns}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {acc.totalCampaigns > 0
                                  ? Math.round(
                                      (acc.auditedCount / acc.totalCampaigns) *
                                        100,
                                    )
                                  : 0}
                                %
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {acc.avgCroScore !== null ? (
                                <Badge
                                  variant="outline"
                                  className={`font-black ${getScoreBadgeStyles(acc.avgCroScore)}`}
                                >
                                  {acc.avgCroScore} / 100
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-xs italic">
                                  Not Audited
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {acc.avgSpeedScore !== null ? (
                                <Badge
                                  variant="outline"
                                  className={`font-black ${getScoreBadgeStyles(acc.avgSpeedScore)}`}
                                >
                                  {acc.avgSpeedScore} / 100
                                </Badge>
                              ) : (
                                <span className="text-slate-400 text-xs italic">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {acc.spendAtRisk > 0 ? (
                                <span className="font-bold text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full inline-block">
                                  {formatCurrency(acc.spendAtRisk)}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-600">
                                  Healthy ($0)
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )
          ) : (
            /* ================================================================ */
            /* VIEW B: INDIVIDUAL CLIENT ACCOUNT VIEW                           */
            /* ================================================================ */
            <div className="space-y-6">
              {/* Account-Level CRO Scorecard & Rollup Metrics (Top Banner) */}
              {accountSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Account Avg CRO Score */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Avg Account CRO
                      </span>
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      {accountSummary.avgCroScore !== null ? (
                        <>
                          <span className="text-3xl font-black text-slate-900">
                            {accountSummary.avgCroScore}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            / 100
                          </span>
                          <Badge
                            variant="outline"
                            className={`ml-auto text-[10px] font-extrabold ${getScoreBadgeStyles(accountSummary.avgCroScore)}`}
                          >
                            {accountSummary.avgCroScore >= 80
                              ? "Good"
                              : accountSummary.avgCroScore >= 60
                                ? "Fair"
                                : "Poor"}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-slate-400 italic">
                          No Audits Yet
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      {accountSummary.coverageRatio.audited} of{" "}
                      {accountSummary.coverageRatio.total} campaigns audited
                    </p>
                  </Card>

                  {/* Coverage Ratio */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Coverage Ratio
                      </span>
                      <ListChecks className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-slate-900">
                        {accountSummary.coverageRatio.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{
                          width: `${accountSummary.coverageRatio.percent}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      {accountSummary.coverageRatio.audited} /{" "}
                      {accountSummary.coverageRatio.total} audited
                    </p>
                  </Card>

                  {/* 30d Spend at Risk */}
                  <Card className="border-slate-200 shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Spend at Risk (30d)
                      </span>
                      <Flame className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-red-600">
                        {formatCurrency(accountSummary.spendAtRisk)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-2">
                      Spend on unaudited or score &lt; 60 LPs
                    </p>
                  </Card>

                  {/* Top Quick Win */}
                  <Card className="border-indigo-100 shadow-sm bg-indigo-50/30 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                          <Zap className="h-3 w-3 text-indigo-600" /> Top Quick
                          Win
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 leading-snug mt-2 line-clamp-3">
                        {accountSummary.topQuickWin}
                      </p>
                    </div>
                    <span className="text-[9px] font-extrabold text-indigo-600 mt-2 block">
                      HIGH CONVERSION IMPACT
                    </span>
                  </Card>
                </div>
              )}

              {/* ── CAMPAIGNS AND URL LIST ── */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-100 bg-slate-50/50 py-3 px-6 gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">
                      {selectedAccountName}
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold text-indigo-600">
                      Campaign Landing Pages
                    </CardDescription>
                  </div>

                  {/* Batch Action Buttons & Search */}
                  <div className="flex flex-wrap items-center gap-2">
                    {needsAuditCount > 0 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleBatchAudit(
                            campaigns.filter((c) => c.latestAudit === null),
                          )
                        }
                        disabled={isBatchAuditing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-bold flex items-center gap-1"
                      >
                        {isBatchAuditing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Audit All Unaudited ({needsAuditCount})
                      </Button>
                    )}

                    {selectedCount > 0 && (
                      <Button
                        size="sm"
                        onClick={() => handleBatchAudit()}
                        disabled={isBatchAuditing}
                        variant="outline"
                        className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs h-8 font-bold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 text-indigo-600" />
                        Batch Audit ({selectedCount} Selected)
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddPageTitle("");
                        setAddPageUrl("");
                        setIsAddPageModalOpen(true);
                      }}
                      className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-indigo-600" />
                      Add Webpage
                    </Button>

                    <div className="relative w-52">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-xs h-8 bg-white"
                      />
                    </div>
                  </div>
                </CardHeader>

                {/* Filter Chips Toolbar */}
                <div className="px-6 py-2.5 bg-slate-50/30 border-b border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mr-1">
                    Filter:
                  </span>
                  <button
                    onClick={() => setCampaignFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      campaignFilter === "all"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    All ({campaigns.length})
                  </button>
                  <button
                    onClick={() => setCampaignFilter("audited")}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      campaignFilter === "audited"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Audited ({auditedCount})
                  </button>
                  <button
                    onClick={() => setCampaignFilter("needs_audit")}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      campaignFilter === "needs_audit"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Needs Audit ({needsAuditCount})
                  </button>
                  <button
                    onClick={() => setCampaignFilter("sub_70")}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                      campaignFilter === "sub_70"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Score &lt; 70 ({sub70Count})
                  </button>
                </div>

                <CardContent className="p-0">
                  {loadingCampaigns ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                      <Spinner size="xl" variant="brand" />
                      <span className="text-xs font-semibold">
                        Retrieving campaign metadata & spend metrics...
                      </span>
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center px-4">
                      <AlertTriangle className="h-10 w-10 text-slate-300 mb-2" />
                      <h3 className="text-sm font-bold text-slate-700">
                        No campaigns found
                      </h3>
                      <p className="text-xs max-w-sm mt-1 text-slate-400">
                        No campaigns matched your search or filter. Try
                        switching filter tabs or click &quot;Sync Landing
                        Pages&quot; above.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="w-10 pl-4">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={(c) => handleSelectAll(!!c)}
                              aria-label="Select all campaigns"
                            />
                          </TableHead>
                          <TableHead className="font-bold text-xs w-[25%]">
                            Campaign Name
                          </TableHead>
                          <TableHead className="font-bold text-xs w-[18%]">
                            30d Performance
                          </TableHead>
                          <TableHead className="font-bold text-xs w-[12%]">
                            Priority
                          </TableHead>
                          <TableHead className="font-bold text-xs w-[25%]">
                            Landing Page URL
                          </TableHead>
                          <TableHead className="font-bold text-xs w-[12%]">
                            Latest Score
                          </TableHead>
                          <TableHead className="text-right font-bold pr-6 text-xs w-[8%]">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCampaigns.map((c) => {
                          const isEditing = editingCampaignId === c.campaignId;
                          const isExpanded = expandedCampaignIds[c.campaignId];
                          const isSelected =
                            !!selectedCampaignIds[c.campaignId];

                          return (
                            <React.Fragment key={c.campaignId}>
                              <TableRow
                                className={`hover:bg-slate-50/30 transition-colors ${isSelected ? "bg-indigo-50/20" : ""}`}
                              >
                                <TableCell className="pl-4">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      toggleSelectCampaign(c.campaignId)
                                    }
                                    aria-label={`Select ${c.campaignName}`}
                                  />
                                </TableCell>
                                <TableCell className="font-semibold text-slate-900 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    {c.audits && c.audits.length > 0 ? (
                                      <button
                                        onClick={() =>
                                          toggleExpandRow(c.campaignId)
                                        }
                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1 -ml-2 rounded-md hover:bg-slate-100"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                          <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    ) : (
                                      <div className="w-5 h-5 shrink-0 -ml-2" />
                                    )}
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full shrink-0 inline-block transition-colors cursor-help ${
                                        c.status === "ENABLED"
                                          ? "bg-emerald-500 shadow-sm shadow-emerald-500/20"
                                          : "bg-slate-400 shadow-sm shadow-slate-400/20"
                                      }`}
                                      title={`Status: ${c.status === "ENABLED" ? "Active" : "Paused"}`}
                                    />
                                    <span className="truncate max-w-[220px]">
                                      {c.campaignName}
                                    </span>
                                    {c.weeklySpeedCheck && (
                                      <span
                                        className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200/60 rounded px-1.5 py-0.5 shrink-0 ml-1"
                                        title="Weekly Speed Testing active"
                                      >
                                        <Zap className="h-2.5 w-2.5" /> Weekly
                                      </span>
                                    )}
                                  </div>
                                </TableCell>

                                {/* 30-Day Metrics */}
                                <TableCell className="text-xs">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-slate-800">
                                      {formatCurrency(c.spend30d || 0)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium">
                                      <span>
                                        {Math.round(c.conversions30d || 0)} conv
                                      </span>
                                      <span>•</span>
                                      <span
                                        className={
                                          (c.cvr || 0) >= 5
                                            ? "text-emerald-600 font-bold"
                                            : "text-slate-500"
                                        }
                                      >
                                        {(c.cvr || 0).toFixed(1)}% CVR
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Priority Badge */}
                                <TableCell>
                                  {getPriorityBadge(c.priority)}
                                </TableCell>

                                {/* Landing Page URL */}
                                <TableCell className="text-xs">
                                  {isEditing ? (
                                    <div className="flex items-center gap-2 max-w-lg">
                                      <Input
                                        value={editUrlValue}
                                        onChange={(e) =>
                                          setEditUrlValue(e.target.value)
                                        }
                                        className="h-8 text-xs bg-white"
                                        placeholder="https://myclient.com/landing-page"
                                      />
                                      <Button
                                        size="icon"
                                        className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                        onClick={() => saveUrl(c)}
                                        disabled={savingUrl}
                                      >
                                        {savingUrl ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Save className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : c.url ? (
                                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                      <a
                                        href={c.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:text-indigo-600 transition-colors flex items-center gap-1 break-all max-w-[220px]"
                                      >
                                        {c.url}{" "}
                                        <ExternalLink className="h-3 w-3 inline opacity-50 shrink-0" />
                                      </a>
                                      <button
                                        onClick={() => startEditing(c)}
                                        className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors ml-1"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400 italic">
                                        No URL linked
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 p-1"
                                        onClick={() => startEditing(c)}
                                      >
                                        <Plus className="h-3 w-3 mr-0.5" />{" "}
                                        Attach URL
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>

                                {/* Latest Score */}
                                <TableCell className="align-middle">
                                  {c.latestAudit ? (
                                    <div className="flex flex-col gap-1 items-start">
                                      <Badge
                                        variant="outline"
                                        className={`rounded-md cursor-pointer font-bold border ${getScoreBadgeStyles(
                                          c.latestAudit.score,
                                        )}`}
                                        onClick={() =>
                                          router.push(
                                            `/lp-analysis/${c.latestAudit!.id}`,
                                          )
                                        }
                                      >
                                        {c.latestAudit.score} / 100
                                      </Badge>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        {new Date(c.latestAudit.createdAt)
                                          .toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: true,
                                          })
                                          .toLowerCase()}
                                      </span>
                                      {c.latestAudit.auditType === "VISUAL" ? (
                                        <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5 mt-0.5 uppercase tracking-wide">
                                          Visual
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-extrabold text-slate-500 bg-slate-50 border border-slate-100 rounded px-1 py-0.5 mt-0.5 uppercase tracking-wide">
                                          Source
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">
                                      Not Audited
                                    </span>
                                  )}
                                </TableCell>

                                {/* Actions Dropdown */}
                                <TableCell className="text-right pr-6 align-middle">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:bg-slate-100 rounded-md border border-slate-200"
                                      >
                                        <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="w-56 bg-white border border-slate-200 shadow-md rounded-lg p-1 z-50"
                                    >
                                      <DropdownMenuItem
                                        disabled={!c.url}
                                        onClick={() => openAuditModal(c)}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded focus:bg-slate-50 focus:text-slate-800"
                                      >
                                        <Play className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        Run CRO Audit
                                      </DropdownMenuItem>
                                      {c.url ? (
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/lp-analysis/speed/${c.id}`}
                                            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded focus:bg-slate-50 focus:text-slate-800 w-full"
                                          >
                                            <Gauge className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                            Speed Testing
                                          </Link>
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          disabled
                                          className="flex items-center gap-2 text-xs font-bold text-slate-400 p-2 rounded"
                                        >
                                          <Gauge className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                          Speed Testing
                                        </DropdownMenuItem>
                                      )}
                                      {c.latestAudit ? (
                                        <DropdownMenuItem asChild>
                                          <Link
                                            href={`/lp-analysis/${c.latestAudit.id}`}
                                            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded focus:bg-slate-50 focus:text-slate-800 w-full"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                            Open Latest Audit
                                          </Link>
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          disabled
                                          className="flex items-center gap-2 text-xs font-bold text-slate-400 p-2 rounded"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                          Open Latest Audit
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        disabled={
                                          !c.audits || c.audits.length < 2
                                        }
                                        onClick={() => {
                                          if (
                                            c.audits &&
                                            c.audits.length >= 2
                                          ) {
                                            router.push(
                                              `/lp-analysis/${c.audits[0].id}?compareId=${c.audits[1].id}`,
                                            );
                                          }
                                        }}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer p-2 rounded focus:bg-slate-50 focus:text-slate-800"
                                      >
                                        <TrendingUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        Compare Last Two Audits
                                      </DropdownMenuItem>
                                      {c.campaignId.startsWith("custom_") && (
                                        <DropdownMenuItem
                                          disabled={deletingId === c.id}
                                          onClick={() => handleDeletePage(c.id, c.campaignName)}
                                          className="flex items-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer p-2 rounded focus:bg-red-50 focus:text-red-700 border-t border-slate-100 mt-1"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                          Remove Webpage
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>

                              {/* Expanded Row for Past Audits */}
                              {isExpanded &&
                                c.audits &&
                                c.audits.length > 0 && (
                                  <TableRow className="bg-slate-50/40 border-t border-slate-150">
                                    <TableCell
                                      colSpan={7}
                                      className="pl-14 py-3 bg-slate-50/20 pr-6"
                                    >
                                      <div className="space-y-2">
                                        <div className="border border-slate-150 rounded-lg overflow-hidden bg-white shadow-sm max-h-[300px] overflow-y-auto">
                                          <Table>
                                            <TableHeader className="bg-slate-50/30">
                                              <TableRow className="h-8 border-b">
                                                <TableHead className="text-[10px] font-bold text-slate-500 py-1.5 pl-4 h-8 w-[40%]">
                                                  Execution Time
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 py-1.5 h-8 w-[25%] text-center">
                                                  Score
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 py-1.5 h-8 w-[20%] text-center">
                                                  Audit Type
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 py-1.5 pr-4 h-8 w-[15%] text-right">
                                                  Action
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {c.audits.map((a) => (
                                                <TableRow
                                                  key={a.id}
                                                  className="h-9 hover:bg-slate-50/60 border-b last:border-0"
                                                >
                                                  <TableCell className="text-xs text-slate-600 py-1.5 pl-4 h-9 font-medium">
                                                    {new Date(a.createdAt)
                                                      .toLocaleDateString(
                                                        "en-AU",
                                                        {
                                                          day: "numeric",
                                                          month: "short",
                                                          year: "numeric",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                          hour12: true,
                                                        },
                                                      )
                                                      .toLowerCase()}
                                                  </TableCell>
                                                  <TableCell className="text-center py-1.5 h-9">
                                                    <span
                                                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border inline-block ${getScoreBadgeStyles(a.score)}`}
                                                    >
                                                      {a.score} / 100
                                                    </span>
                                                  </TableCell>
                                                  <TableCell className="text-center py-1.5 h-9">
                                                    {a.auditType ===
                                                    "VISUAL" ? (
                                                      <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                                        Visual
                                                      </span>
                                                    ) : (
                                                      <span className="text-[8px] font-extrabold text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                                        Source
                                                      </span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell className="text-right py-1.5 pr-4 h-9">
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-6 text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 p-1"
                                                      onClick={() =>
                                                        router.push(
                                                          `/lp-analysis/${a.id}`,
                                                        )
                                                      }
                                                    >
                                                      View Report →
                                                    </Button>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── RUN AUDIT DIALOG ── */}
      <Dialog
        open={isAuditModalOpen}
        onOpenChange={(o) => !isAuditing && setIsAuditModalOpen(o)}
      >
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Globe className="w-5 h-5 text-indigo-500" />
              Landing Page CRO Audit
            </DialogTitle>
            <DialogDescription className="text-xs">
              Scrapes client and competitor pages. AI will score metrics against
              search auction leaders.
            </DialogDescription>
          </DialogHeader>

          {!isAuditing ? (
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="audit-url"
                  className="text-xs font-bold text-slate-700"
                >
                  Target Landing Page URL
                </Label>
                <Input
                  id="audit-url"
                  value={auditUrl}
                  onChange={(e) => setAuditUrl(e.target.value)}
                  className="text-xs bg-slate-50"
                  placeholder="https://myclient.com/landing-page"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="audit-keyword"
                  className="text-xs font-bold text-slate-700"
                >
                  Focus Keyword / Search Term (For Competitor Scanning)
                </Label>
                <Input
                  id="audit-keyword"
                  value={auditKeyword}
                  onChange={(e) => setAuditKeyword(e.target.value)}
                  className="text-xs bg-white"
                  placeholder="e.g. emergency plumber Brisbane"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  This term will be queried on Google SERP. We will locate the
                  top 3 direct competitors bidding in the auction and compare
                  their hooks/landing pages side-by-side.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 leading-normal flex items-start gap-2 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Important:</span> Ensure this is
                    a real search query that prospects actually search (e.g.,{" "}
                    <code className="bg-amber-100/60 px-1 rounded">
                      martial arts Adelaide
                    </code>
                    ). Internal codes or dates are automatically stripped.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-3.5 border-t border-slate-100 mt-1">
                <Checkbox
                  id="audit-visual"
                  checked={auditVisual}
                  onCheckedChange={(checked) => setAuditVisual(!!checked)}
                  className="mt-0.5 border-slate-300"
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor="audit-visual"
                    className="text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Visual CRO Audit (JavaScript Rendering + Screenshot)
                  </Label>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Uses headless Chromium browser to capture layout screenshots
                    and run a visual/layout analysis.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-700">
                  Analyzing Landing Pages
                </h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  This may take up to 30-45 seconds while we scrape competitors
                  and compile results.
                </p>
              </div>

              {/* Step indicator */}
              <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(auditStep / 4) * 100}%` }}
                />
              </div>

              <div className="space-y-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {auditStep === 1 && "1. Scraping client landing page..."}
                {auditStep === 2 &&
                  "2. Scanning Google SERP for competitors..."}
                {auditStep === 3 &&
                  "3. Bypassing bot blockers & scraping competitor domains..."}
                {auditStep === 4 &&
                  "4. Evaluation heuristics in progress via Gemini..."}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end gap-2 pt-2 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setIsAuditModalOpen(false)}
              disabled={isAuditing}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteAudit}
              disabled={isAuditing || !auditUrl || !auditKeyword}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 flex items-center gap-1.5"
            >
              {isAuditing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Auditing...
                </>
              ) : (
                <>
                  Start Audit <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GLOBAL QUICK AUDIT DIALOG ── */}
      <Dialog
        open={isQuickAuditOpen}
        onOpenChange={(o) => !isQuickAuditing && setIsQuickAuditOpen(o)}
      >
        <DialogContent className="sm:max-w-[520px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              Quick CRO Audit (Any Webpage)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Audit any landing page or standalone URL against search competitors on demand.
            </DialogDescription>
          </DialogHeader>

          {!isQuickAuditing ? (
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="quick-audit-account"
                  className="text-xs font-bold text-slate-700"
                >
                  Associated Client Account
                </Label>
                <select
                  id="quick-audit-account"
                  value={quickAuditAccountId}
                  onChange={(e) => setQuickAuditAccountId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 leading-tight">
                  The audit report will be stored under this client account.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="quick-audit-url"
                  className="text-xs font-bold text-slate-700"
                >
                  Target Webpage URL
                </Label>
                <Input
                  id="quick-audit-url"
                  value={quickAuditUrl}
                  onChange={(e) => setQuickAuditUrl(e.target.value)}
                  className="text-xs bg-slate-50"
                  placeholder="https://example.com/pricing-or-landing-page"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="quick-audit-keyword"
                  className="text-xs font-bold text-slate-700"
                >
                  Focus Keyword / Search Query
                </Label>
                <Input
                  id="quick-audit-keyword"
                  value={quickAuditKeyword}
                  onChange={(e) => setQuickAuditKeyword(e.target.value)}
                  className="text-xs bg-white"
                  placeholder="e.g. emergency dentist perth"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Used to benchmark against live competitor pages ranking for this query.
                </p>
              </div>

              <div className="flex items-start gap-2.5 pt-3.5 border-t border-slate-100 mt-1">
                <Checkbox
                  id="quick-audit-visual"
                  checked={quickAuditVisual}
                  onCheckedChange={(checked) => setQuickAuditVisual(!!checked)}
                  className="mt-0.5 border-slate-300"
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor="quick-audit-visual"
                    className="text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Visual CRO Audit (Headless Chromium + Screenshot)
                  </Label>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Uses headless Chromium browser to capture layout screenshots and run a visual/layout analysis.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-700">
                  Running Quick Audit
                </h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  Scraping webpage, querying Google search competitors, and running Gemini CRO heuristics...
                </p>
              </div>

              <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(quickAuditStep / 4) * 100}%` }}
                />
              </div>

              <div className="space-y-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {quickAuditStep === 1 && "1. Scraping target webpage..."}
                {quickAuditStep === 2 && "2. Scanning Google SERP for competitors..."}
                {quickAuditStep === 3 && "3. Bypassing bot blockers & scraping competitor domains..."}
                {quickAuditStep === 4 && "4. Evaluation heuristics in progress via Gemini..."}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end gap-2 pt-2 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setIsQuickAuditOpen(false)}
              disabled={isQuickAuditing}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteQuickAudit}
              disabled={
                isQuickAuditing ||
                !quickAuditUrl.trim() ||
                !quickAuditKeyword.trim() ||
                !quickAuditAccountId
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 flex items-center gap-1.5"
            >
              {isQuickAuditing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Auditing...
                </>
              ) : (
                <>
                  Start Quick Audit <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD CUSTOM WEBPAGE DIALOG ── */}
      <Dialog
        open={isAddPageModalOpen}
        onOpenChange={(o) => !isAddingPage && setIsAddPageModalOpen(o)}
      >
        <DialogContent className="sm:max-w-[460px] bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Plus className="w-5 h-5 text-indigo-600" />
              Add Independent Webpage
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a standalone landing page, homepage, or subpage under{" "}
              <span className="font-semibold text-indigo-600">{selectedAccountName}</span> to audit and benchmark.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="add-page-title"
                className="text-xs font-bold text-slate-700"
              >
                Page Label / Title
              </Label>
              <Input
                id="add-page-title"
                value={addPageTitle}
                onChange={(e) => setAddPageTitle(e.target.value)}
                className="text-xs bg-white"
                placeholder="e.g. Main Landing Page, Pricing Lander, Hero Demo"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="add-page-url"
                className="text-xs font-bold text-slate-700"
              >
                Webpage URL
              </Label>
              <Input
                id="add-page-url"
                value={addPageUrl}
                onChange={(e) => setAddPageUrl(e.target.value)}
                className="text-xs bg-slate-50"
                placeholder="https://clientdomain.com/landing-page"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-end gap-2 pt-2 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setIsAddPageModalOpen(false)}
              disabled={isAddingPage}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomPage}
              disabled={isAddingPage || !addPageTitle.trim() || !addPageUrl.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 flex items-center gap-1.5 font-bold"
            >
              {isAddingPage ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                </>
              ) : (
                <>Save Webpage</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

