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
      <div className="max-w-7xl mx-auto space-y-6">
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
          <div className="flex items-center gap-3">
            <Label
              htmlFor="account-select"
              className="text-xs font-bold text-slate-400 uppercase tracking-wider"
            >
              Account
            </Label>
            <select
              id="account-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-sm rounded-xl font-bold py-2 px-4 focus:ring-2 focus:ring-indigo-500 transition duration-150 outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* OVERALL PORTFOLIO METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-indigo-50/30 border-slate-200 border-l-4 border-l-indigo-500 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-indigo-50/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-black text-indigo-500 uppercase tracking-wider">
                Total RSA Ads
              </CardDescription>
              <CardTitle className="text-3xl font-black text-indigo-950 mt-1">
                {loadingAds ? (
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                ) : (
                  ads.length
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-semibold text-indigo-600/80">
                Active Responsive Search Ads
              </p>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/30 border-slate-200 border-l-4 border-l-emerald-500 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-emerald-50/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-black text-emerald-600 uppercase tracking-wider">
                Excellent / Good Strength
              </CardDescription>
              <CardTitle className="text-3xl font-black text-emerald-800 mt-1">
                {loadingAds ? (
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                ) : (
                  adStrengthDistribution.EXCELLENT + adStrengthDistribution.GOOD
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-semibold text-emerald-700/80">
                Excellent: {adStrengthDistribution.EXCELLENT} | Good:{" "}
                {adStrengthDistribution.GOOD}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/30 border-slate-200 border-l-4 border-l-amber-500 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-black text-amber-600 uppercase tracking-wider">
                Average Strength
              </CardDescription>
              <CardTitle className="text-3xl font-black text-amber-800 mt-1">
                {loadingAds ? (
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                ) : (
                  adStrengthDistribution.AVERAGE
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-semibold text-amber-700/80">
                Needs copywriting extensions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rose-50/30 border-slate-200 border-l-4 border-l-rose-500 shadow-sm rounded-2xl relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:bg-rose-50/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-black text-rose-600 uppercase tracking-wider">
                Poor Strength
              </CardDescription>
              <CardTitle className="text-3xl font-black text-rose-800 mt-1">
                {loadingAds ? (
                  <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
                ) : (
                  adStrengthDistribution.POOR
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-semibold text-rose-700/80 flex items-center gap-1">
                {adStrengthDistribution.POOR > 0 && (
                  <AlertTriangle className="h-3 w-3 text-rose-600" />
                )}
                Critical triage required
              </p>
            </CardContent>
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

        {/* ADS LIST & TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-slate-400" />
              <Input
                placeholder="Search campaigns, ad groups, or copy text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl bg-slate-50 border-slate-200 focus:bg-white text-sm"
              />
            </div>
            <div className="text-xs font-semibold text-slate-400">
              Showing {sortedAds.length} of {ads.length} ads
            </div>
          </div>

          {/* Table */}
          {loadingAds ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm font-semibold text-slate-500">
                Loading campaign ad copies...
              </p>
            </div>
          ) : sortedAds.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <p className="text-base font-bold">
                No ads found matching your criteria
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure you have active search campaigns in this account.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75 border-b border-slate-100">
                  <TableRow>
                    <TableHead
                      onClick={() => handleSort("campaignName")}
                      className="cursor-pointer font-extrabold text-slate-900 select-none hover:bg-slate-100"
                    >
                      Campaign / Ad Group{" "}
                      {isSortBy === "campaignName"
                        ? isSortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableHead>
                    <TableHead className="font-extrabold text-slate-900">
                      RSA Copy Preview
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("adStrength")}
                      className="cursor-pointer font-extrabold text-slate-900 select-none hover:bg-slate-100 text-center"
                    >
                      Ad Strength{" "}
                      {isSortBy === "adStrength"
                        ? isSortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableHead>
                    <TableHead
                      onClick={() => handleSort("latestAuditScore")}
                      className="cursor-pointer font-extrabold text-slate-900 select-none hover:bg-slate-100 text-center"
                    >
                      Audit Score{" "}
                      {isSortBy === "latestAuditScore"
                        ? isSortDir === "asc"
                          ? "▲"
                          : "▼"
                        : ""}
                    </TableHead>
                    <TableHead className="text-right font-extrabold text-slate-900 px-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {sortedAds.map((ad) => {
                    const latestScore = ad.latestAuditScore;
                    return (
                      <TableRow
                        key={ad.adId}
                        className="hover:bg-slate-50/50 transition duration-150"
                      >
                        {/* Campaign/AdGroup info */}
                        <TableCell className="max-w-[220px]">
                          <div className="font-bold text-slate-800 text-sm truncate">
                            {ad.adGroupName}
                          </div>
                          <div className="text-slate-400 text-xs font-semibold truncate mt-0.5">
                            {ad.campaignName}
                          </div>
                          {ad.finalUrl && (
                            <a
                              href={ad.finalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-indigo-500 font-bold hover:underline flex items-center gap-0.5 mt-1.5"
                            >
                              Final URL <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </TableCell>

                        {/* Copy preview */}
                        <TableCell className="max-w-[340px]">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-700 flex flex-wrap gap-1">
                              {ad.headlines.slice(0, 3).map((h, i) => (
                                <span
                                  key={h.text}
                                  className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                >
                                  {h.text}
                                  {h.pinnedField !== "UNSPECIFIED" && (
                                    <span className="text-[9px] text-indigo-500 ml-1 font-black">
                                      📌{h.pinnedField.replace("HEADLINE_", "")}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-normal truncate italic">
                              {ad.descriptions[0]?.text ||
                                "No description preview available"}
                            </div>
                          </div>
                        </TableCell>

                        {/* Ad Strength */}
                        <TableCell className="text-center">
                          {ad.adStrength === "EXCELLENT" && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-50">
                              EXCELLENT
                            </Badge>
                          )}
                          {ad.adStrength === "GOOD" && (
                            <Badge className="bg-green-50 text-green-700 border-green-200 font-bold hover:bg-green-50">
                              GOOD
                            </Badge>
                          )}
                          {ad.adStrength === "AVERAGE" && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold hover:bg-amber-50">
                              AVERAGE
                            </Badge>
                          )}
                          {ad.adStrength === "POOR" && (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold hover:bg-rose-50">
                              POOR
                            </Badge>
                          )}
                          {(ad.adStrength === "UNKNOWN" || !ad.adStrength) && (
                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-bold hover:bg-slate-100">
                              UNKNOWN
                            </Badge>
                          )}
                        </TableCell>

                        {/* Latest Audit Score */}
                        <TableCell className="text-center">
                          {latestScore !== null ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black border ${
                                  latestScore >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : latestScore >= 50
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {latestScore}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold mt-1">
                                {ad.latestAuditDate
                                  ? new Date(
                                      ad.latestAuditDate,
                                    ).toLocaleDateString()
                                  : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">
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
