"use client";

import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAssetPerformanceReportAction,
  listAdGroupAdsAction,
  runAdCopyAuditAction,
} from "@/actions/ad-audit.actions";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface AdGroupAdItem {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  adStrength: string;
  approvalStatus: string;
  finalUrl: string;
  headlines: Array<{ text: string; pinnedField: string }>;
  descriptions: Array<{ text: string; pinnedField: string }>;
  latestAuditScore: number | null;
  latestAuditDate: string | null;
  latestAuditId: number | null;
}

interface AssetPerformanceOverview {
  totalAssetsAudited: number;
  lowCount: number;
  goodCount: number;
  bestCount: number;
  otherCount: number;
  pinningConflicts: any[];
  labelsAvailable?: boolean;
  reason?: string | null;
}

export default function AdAuditClientPage({
  accounts,
}: {
  accounts: AdAccount[];
}) {
  const router = useRouter();

  // Selected Account State
  const [selectedAccountId, setSelectedAccountId] = useState<number>(
    accounts[0]?.id || 0,
  );
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  const filteredAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase()),
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const accId = params.get("accountId");
      if (accId) {
        const parsed = parseInt(accId, 10);
        if (!isNaN(parsed) && accounts.some((a) => a.id === parsed)) {
          setSelectedAccountId(parsed);
        }
      }
    }
  }, [accounts]);

  // List Ads state
  const [ads, setAds] = useState<AdGroupAdItem[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Asset performance (Layer 1) report state
  const [assetSummary, setAssetSummary] =
    useState<AssetPerformanceOverview | null>(null);

  // Audit modal state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditAd, setAuditAd] = useState<AdGroupAdItem | null>(null);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);

  // Sort State
  const [isSortBy, setIsSortBy] = useState<string>("campaignName");
  const [isSortDir, setIsSortDir] = useState<"asc" | "desc">("asc");

  const fetchAdsAndSummary = useCallback(async (accountId: number) => {
    if (!accountId) return;
    setLoadingAds(true);
    try {
      const [adsRes, summaryRes] = await Promise.all([
        listAdGroupAdsAction(accountId),
        getAssetPerformanceReportAction(accountId),
      ]);

      if (adsRes.success && adsRes.data) {
        setAds(adsRes.data as any);
      } else {
        toast.error(adsRes.error || "Failed to load ads.");
      }

      if (summaryRes.success && summaryRes.data) {
        setAssetSummary(summaryRes.data as any);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred fetching ads.");
    } finally {
      setLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchAdsAndSummary(selectedAccountId);
    }
  }, [selectedAccountId, fetchAdsAndSummary]);

  // Open Audit Modal
  const openAuditModal = (ad: AdGroupAdItem) => {
    setAuditAd(ad);
    setAuditUrl(ad.finalUrl);

    // Guess search keyword from campaign / ad group name
    let cleanWord = ad.campaignName.toLowerCase();
    cleanWord = cleanWord.replace(/[|_\-[\]()]/g, " ");
    cleanWord = cleanWord
      .replace(
        /\b(campaign|search|broad|phrase|exact|ppc|pmax|leads|mcc|client|competitor)\b/g,
        "",
      )
      .trim();

    setAuditKeyword(cleanWord);
    setIsAuditModalOpen(true);
  };

  // Submit Audit Action
  const handleRunAudit = async () => {
    if (!selectedAccountId || !auditAd || !auditKeyword) return;
    setIsAuditing(true);
    const toastId = toast.loading(
      "Running Gemini copywriting ad copy audit...",
    );
    try {
      const res = await runAdCopyAuditAction(
        selectedAccountId,
        auditAd.campaignId,
        auditAd.campaignName,
        auditAd.adGroupId,
        auditAd.adGroupName,
        auditAd.adId,
        auditKeyword,
        auditUrl || undefined,
      );

      if (res.success && res.data) {
        toast.success("Ad Copy audit completed successfully!", { id: toastId });
        setIsAuditModalOpen(false);
        router.push(`/ad-audit/${res.data.auditId}`);
      } else {
        toast.error(res.error || "Failed to run ad copy audit.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during audit.", {
        id: toastId,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSort = (column: string) => {
    if (isSortBy === column) {
      setIsSortDir(isSortDir === "asc" ? "desc" : "asc");
    } else {
      setIsSortBy(column);
      setIsSortDir("asc");
    }
  };

  // Filter & Sort
  const filteredAds = ads.filter((ad) => {
    const query = searchQuery.toLowerCase();
    return (
      ad.campaignName.toLowerCase().includes(query) ||
      ad.adGroupName.toLowerCase().includes(query) ||
      ad.headlines.some((h) => h.text.toLowerCase().includes(query)) ||
      ad.descriptions.some((d) => d.text.toLowerCase().includes(query))
    );
  });

  const sortedAds = [...filteredAds].sort((a, b) => {
    let valA: any = "";
    let valB: any = "";

    if (isSortBy === "campaignName") {
      valA = a.campaignName;
      valB = b.campaignName;
    } else if (isSortBy === "adGroupName") {
      valA = a.adGroupName;
      valB = b.adGroupName;
    } else if (isSortBy === "adStrength") {
      valA = a.adStrength;
      valB = b.adStrength;
    } else if (isSortBy === "latestAuditScore") {
      valA = a.latestAuditScore ?? -1;
      valB = b.latestAuditScore ?? -1;
    }

    if (valA < valB) return isSortDir === "asc" ? -1 : 1;
    if (valA > valB) return isSortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Calculate quick stats
  const adStrengthDistribution = {
    EXCELLENT: ads.filter((a) => a.adStrength === "EXCELLENT").length,
    GOOD: ads.filter((a) => a.adStrength === "GOOD").length,
    AVERAGE: ads.filter((a) => a.adStrength === "AVERAGE").length,
    POOR: ads.filter((a) => a.adStrength === "POOR").length,
    UNKNOWN: ads.filter((a) => a.adStrength === "UNKNOWN" || !a.adStrength)
      .length,
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
              Ad Copy & Creative Diagnostics
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Analyze Google Ads copywriting, pinning configurations, and
              message-match alignment.
            </p>
          </div>
        </div>

        {/* Mobile Selector Dropdown (Visible only on mobile/tablet) */}
        <div className="block md:hidden border-slate-200 shadow-sm bg-white p-3.5 rounded-xl border mb-4">
          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
            Select Client Account
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg p-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Desktop Sidebar Selector (Hidden on mobile) */}
          <Card className="hidden md:block md:col-span-1 border-slate-200 shadow-sm h-fit">
            <CardHeader className="py-0 h-12 border-b border-slate-100 flex flex-row items-center justify-between [.border-b]:pb-0 px-4">
              <CardTitle className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">
                Select Client Account
              </CardTitle>
            </CardHeader>
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
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
              <div className="overflow-y-auto max-h-[420px] pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
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

          {/* MAIN CONTENT AREA */}
          <div className="col-span-1 md:col-span-3 space-y-6">
            {/* OVERALL PORTFOLIO METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Card className="bg-indigo-50/30 border-slate-200 border-l-4 border-l-indigo-500 shadow-sm rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-indigo-50/50">
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider truncate" title="Total RSA Ads">
                    Total RSA Ads
                  </p>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-950 mt-1 mb-1">
                    {loadingAds ? (
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                    ) : (
                      ads.length
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-indigo-600/80 truncate">
                  Active Responsive Search Ads
                </p>
              </Card>

              <Card className="bg-emerald-50/30 border-slate-200 border-l-4 border-l-emerald-500 shadow-sm rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-emerald-50/50">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider truncate" title="Excellent / Good Strength">
                    Excellent / Good Strength
                  </p>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1 mb-1">
                    {loadingAds ? (
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                    ) : (
                      adStrengthDistribution.EXCELLENT + adStrengthDistribution.GOOD
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-700/80 truncate">
                  Excellent: {adStrengthDistribution.EXCELLENT} | Good:{" "}
                  {adStrengthDistribution.GOOD}
                </p>
              </Card>

              <Card className="bg-amber-50/30 border-slate-200 border-l-4 border-l-amber-500 shadow-sm rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-amber-50/50">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider truncate" title="Average Strength">
                    Average Strength
                  </p>
                  <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1 mb-1">
                    {loadingAds ? (
                      <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                    ) : (
                      adStrengthDistribution.AVERAGE
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-amber-700/80 truncate">
                  Needs copywriting extensions
                </p>
              </Card>

              <Card className="bg-rose-50/30 border-slate-200 border-l-4 border-l-rose-500 shadow-sm rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-rose-50/50">
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider truncate" title="Poor Strength">
                    Poor Strength
                  </p>
                  <div className="text-2xl sm:text-3xl font-black text-rose-800 mt-1 mb-1">
                    {loadingAds ? (
                      <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                    ) : (
                      adStrengthDistribution.POOR
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-rose-700/80 flex items-center gap-1 truncate">
                  {adStrengthDistribution.POOR > 0 && (
                    <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                  )}
                  Critical triage required
                </p>
              </Card>
            </div>

            {/* ASSET METRICS (LAYER 1 SUMMARY CARD) */}
            {assetSummary && assetSummary.totalAssetsAudited > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  Creative Assets Performance (All Active RSAs)
                </h2>

                {assetSummary.labelsAvailable === false && assetSummary.reason && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                    <Info className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Google Ads Asset Labels Pending
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        {assetSummary.reason}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-slate-400 text-xs font-bold">
                      Total Assets
                    </div>
                    <div className="text-xl font-extrabold text-slate-800">
                      {assetSummary.totalAssetsAudited}
                    </div>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-emerald-500 text-xs font-bold">
                      Best Performing
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700">
                      {assetSummary.bestCount}
                    </div>
                  </div>
                  <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100">
                    <div className="text-sky-500 text-xs font-bold">
                      Good Performing
                    </div>
                    <div className="text-xl font-extrabold text-sky-700">
                      {assetSummary.goodCount}
                    </div>
                  </div>
                  <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                    <div className="text-rose-500 text-xs font-bold">
                      Low Performing
                    </div>
                    <div className="text-xl font-extrabold text-rose-700">
                      {assetSummary.lowCount}
                    </div>
                  </div>
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 col-span-2 md:col-span-1">
                    <div className="text-amber-500 text-xs font-bold">
                      Pinning Conflicts
                    </div>
                    <div className="text-xl font-extrabold text-amber-700 flex items-center gap-1">
                      {assetSummary.pinningConflicts.length}
                      {assetSummary.pinningConflicts.length > 0 && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AD GROUP ADS TABLE CARD */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    Responsive Search Ads ({filteredAds.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Review headlines, descriptions, and audit history across active ad groups.
                  </p>
                </div>

                <div className="relative min-w-[260px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search campaigns, ad groups, or copy text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-white border-slate-200 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {loadingAds ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold text-slate-500">
                    Fetching ad groups and RSA assets...
                  </p>
                </div>
              ) : sortedAds.length === 0 ? (
                <div className="p-12 text-center">
                  <Info className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">No RSA Ads Found</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? "No ads match your search filter. Try clearing the search query."
                      : "No active Responsive Search Ads were retrieved for this account."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow className="border-slate-100">
                        <TableHead
                          onClick={() => handleSort("campaignName")}
                          className="cursor-pointer font-bold text-xs text-slate-600 hover:text-indigo-600 transition-colors px-6"
                        >
                          Campaign / Ad Group
                        </TableHead>
                        <TableHead className="font-bold text-xs text-slate-600 px-6">
                          Headlines & Descriptions
                        </TableHead>
                        <TableHead
                          onClick={() => handleSort("adStrength")}
                          className="cursor-pointer font-bold text-xs text-slate-600 hover:text-indigo-600 transition-colors px-6 text-center"
                        >
                          Ad Strength
                        </TableHead>
                        <TableHead
                          onClick={() => handleSort("latestAuditScore")}
                          className="cursor-pointer font-bold text-xs text-slate-600 hover:text-indigo-600 transition-colors px-6 text-center"
                        >
                          Audit Score
                        </TableHead>
                        <TableHead className="text-right font-bold text-xs text-slate-600 px-6">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAds.map((ad) => {
                        return (
                          <TableRow
                            key={`${ad.adGroupId}-${ad.adId}`}
                            className="hover:bg-slate-50/80 border-slate-100 transition-colors"
                          >
                            {/* Campaign / Ad Group */}
                            <TableCell className="align-top py-4 px-6 max-w-[220px]">
                              <div className="space-y-1">
                                <div className="font-bold text-xs text-slate-800 truncate" title={ad.campaignName}>
                                  {ad.campaignName}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-400 truncate" title={ad.adGroupName}>
                                  {ad.adGroupName}
                                </div>
                                {ad.finalUrl && (
                                  <a
                                    href={ad.finalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-medium truncate pt-1"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{ad.finalUrl}</span>
                                  </a>
                                )}
                              </div>
                            </TableCell>

                            {/* Headlines & Descriptions */}
                            <TableCell className="align-top py-4 px-6 max-w-[400px]">
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                    Headlines ({ad.headlines.length})
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ad.headlines.slice(0, 4).map((h, i) => (
                                      <Badge
                                        key={i}
                                        variant="secondary"
                                        className="bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-200"
                                      >
                                        {h.text}
                                        {h.pinnedField && (
                                          <span className="ml-1 text-[9px] text-indigo-600 font-bold">
                                            [{h.pinnedField.replace("HEADLINE_", "H")}]
                                          </span>
                                        )}
                                      </Badge>
                                    ))}
                                    {ad.headlines.length > 4 && (
                                      <Badge variant="outline" className="text-[10px] text-slate-400 font-medium">
                                        +{ad.headlines.length - 4} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                    Descriptions ({ad.descriptions.length})
                                  </span>
                                  <div className="space-y-1">
                                    {ad.descriptions.slice(0, 2).map((d, i) => (
                                      <p key={i} className="text-xs text-slate-600 line-clamp-1 italic">
                                        &ldquo;{d.text}&rdquo;
                                        {d.pinnedField && (
                                          <span className="ml-1 text-[9px] text-indigo-600 font-bold not-italic">
                                            [{d.pinnedField.replace("DESCRIPTION_", "D")}]
                                          </span>
                                        )}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Ad Strength */}
                            <TableCell className="align-top py-4 px-6 text-center">
                              <Badge
                                className={`font-black text-[10px] border shadow-none uppercase ${
                                  ad.adStrength === "EXCELLENT"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : ad.adStrength === "GOOD"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : ad.adStrength === "AVERAGE"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {ad.adStrength || "UNKNOWN"}
                              </Badge>
                            </TableCell>

                            {/* Latest Audit Score */}
                            <TableCell className="align-top py-4 px-6 text-center">
                              {ad.latestAuditScore !== null && ad.latestAuditScore !== undefined ? (
                                <div className="space-y-1">
                                  <Badge
                                    className={`font-black text-xs border shadow-none ${
                                      ad.latestAuditScore >= 80
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : ad.latestAuditScore >= 60
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                    }`}
                                  >
                                    {ad.latestAuditScore}/100
                                  </Badge>
                                  {ad.latestAuditDate && (
                                    <p className="text-[10px] text-slate-400 font-medium">
                                      {new Date(ad.latestAuditDate).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium italic">
                                  Not audited
                                </span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right px-6">
                              <div className="flex items-center justify-end gap-2">
                                {ad.latestAuditId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      router.push(`/ad-audit/${ad.latestAuditId}`)
                                    }
                                    className="h-8 rounded-lg text-xs font-bold border-slate-200 text-slate-700"
                                  >
                                    Details
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => openAuditModal(ad)}
                                  className="h-8 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 shadow-sm"
                                >
                                  <Play className="h-3 w-3 fill-current" />
                                  Audit
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AUDIT CONFIGURATION MODAL */}
        <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
          <DialogContent className="sm:max-w-[460px] rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                Configure Copywriting Audit
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-medium">
                Set the parameters for evaluating RSA ad relevance and landing
                page message-match.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="audit-keyword"
                  className="text-xs font-black text-slate-500 uppercase"
                >
                  Focus Keyword / Search Term{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="audit-keyword"
                  value={auditKeyword}
                  onChange={(e) => setAuditKeyword(e.target.value)}
                  placeholder="e.g. emergency plumber gold coast"
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="audit-url"
                  className="text-xs font-black text-slate-500 uppercase"
                >
                  Linked Landing Page URL
                </Label>
                <Input
                  id="audit-url"
                  value={auditUrl}
                  onChange={(e) => setAuditUrl(e.target.value)}
                  placeholder="https://client-site.com/landing-page"
                  className="rounded-xl border-slate-200"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  If provided, Gemini will evaluate the message match between
                  your ad copy headlines and landing page.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                disabled={isAuditing}
                onClick={() => setIsAuditModalOpen(false)}
                className="rounded-xl border-slate-200 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isAuditing || !auditKeyword}
                onClick={handleRunAudit}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Start Audit
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
