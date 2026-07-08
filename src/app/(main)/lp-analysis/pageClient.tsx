"use client";

import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getCampaignLandingPagesAction,
  runLandingPageAuditAction,
  saveCampaignLandingPageAction,
  syncCampaignLandingPagesAction,
} from "@/actions/lp-analysis.actions";
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

interface CampaignLP {
  id: number;
  campaignId: string;
  campaignName: string;
  url: string;
  updatedAt: Date;
  latestAudit: {
    id: number;
    score: number;
    createdAt: Date;
  } | null;
}

export default function LpAnalysisClientPage({
  accounts,
}: {
  accounts: AdAccount[];
}) {
  const router = useRouter();

  // Selection & Search State
  const [selectedAccountId, setSelectedAccountId] = useState<number>(
    accounts[0]?.id || 0,
  );
  const [campaigns, setCampaigns] = useState<CampaignLP[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncingLps, setSyncingLps] = useState(false);

  // Edit URL State
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [editUrlValue, setEditUrlValue] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditCampaign, setAuditCampaign] = useState<CampaignLP | null>(null);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(1);

  // Fetch campaigns for selected account
  const fetchCampaigns = async (accountId: number) => {
    if (!accountId) return;
    setLoadingCampaigns(true);
    try {
      const res = await getCampaignLandingPagesAction(accountId);
      if (res.success && res.data) {
        setCampaigns(res.data as any);
      } else {
        toast.error(res.error || "Failed to load campaigns.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      fetchCampaigns(selectedAccountId);
    }
  }, [selectedAccountId, fetchCampaigns]);

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

  // Open Audit Configuration Modal
  const openAuditModal = (campaign: CampaignLP) => {
    setAuditCampaign(campaign);
    setAuditUrl(campaign.url);
    // Guesses a search term based on campaign name
    const cleanedName = campaign.campaignName
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/campaign/g, "")
      .replace(/search/g, "")
      .trim();
    setAuditKeyword(cleanedName || "emergency plumber sydney");
    setAuditStep(1);
    setIsAuditModalOpen(true);
  };

  // Run Audit
  const handleExecuteAudit = async () => {
    if (!selectedAccountId || !auditUrl || !auditKeyword || !auditCampaign)
      return;
    setIsAuditing(true);
    setAuditStep(1);

    // Simulated progress steps for better UI experience
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

  // Filter campaigns by query
  const filteredCampaigns = campaigns.filter((c) =>
    c.campaignName.toLowerCase().includes(searchQuery.toLowerCase()),
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

  return (
    <div className="space-y-6 p-2 max-w-[1400px] mx-auto">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Globe className="h-8 w-8 text-indigo-600 animate-pulse" /> Landing
            Page Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conduct 10-dimension CRO audits, analyze local trade competitors,
            and get copy-paste action scripts.
          </p>
        </div>

        {/* Sync / Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSyncLps}
            disabled={syncingLps || loadingCampaigns || !selectedAccountId}
            variant="outline"
            className="border-slate-200 text-xs font-semibold flex items-center gap-2 bg-white"
          >
            {syncingLps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            )}
            Sync Landing Pages
          </Button>
        </div>
      </div>

      {/* ── AD ACCOUNT SELECTOR CARD ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Select Client Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-xs font-bold flex items-center justify-between ${
                  selectedAccountId === acc.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="truncate pr-2">{acc.name}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            ))}
            {accounts.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                No connected accounts.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── CAMPAIGNS AND URL LIST ── */}
        <Card className="md:col-span-3 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center border-b border-slate-100 bg-slate-50/50 py-4 gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">
                Campaign Landing Pages
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect and connect URL entry points for optimization audits.
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-white"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingCampaigns ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold">
                  Retrieving campaign metadata...
                </span>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center px-4">
                <AlertTriangle className="h-10 w-10 text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-700">
                  No campaigns found
                </h3>
                <p className="text-xs max-w-sm mt-1 text-slate-400">
                  We couldn't load campaigns or landing pages. Click "Sync
                  Landing Pages" above to fetch from Google Ads, or verify sync
                  settings.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-bold pl-6 text-xs w-[30%]">
                      Campaign Name
                    </TableHead>
                    <TableHead className="font-bold text-xs w-[40%]">
                      Landing Page URL
                    </TableHead>
                    <TableHead className="font-bold text-xs w-[15%]">
                      Latest Score
                    </TableHead>
                    <TableHead className="text-right font-bold pr-6 text-xs w-[15%]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((c) => {
                    const isEditing = editingCampaignId === c.campaignId;
                    return (
                      <TableRow
                        key={c.campaignId}
                        className="hover:bg-slate-50/30 transition-colors"
                      >
                        <TableCell className="font-semibold text-slate-900 text-xs pl-6">
                          {c.campaignName}
                        </TableCell>
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
                                className="hover:text-indigo-600 transition-colors flex items-center gap-1 break-all max-w-[320px]"
                              >
                                {c.url}{" "}
                                <ExternalLink className="h-3 w-3 inline opacity-50" />
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
                                <Plus className="h-3 w-3 mr-0.5" /> Attach URL
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.latestAudit ? (
                            <Badge
                              variant="outline"
                              className={`rounded-md cursor-pointer font-bold border ${getScoreBadgeStyles(
                                c.latestAudit.score,
                              )}`}
                              onClick={() =>
                                router.push(`/lp-analysis/${c.latestAudit!.id}`)
                              }
                            >
                              {c.latestAudit.score} / 100
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              Not Audited
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {c.url ? (
                            <Button
                              onClick={() => openAuditModal(c)}
                              size="sm"
                              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 ml-auto"
                            >
                              <Play className="h-3 w-3 fill-current" /> Run
                              Audit
                            </Button>
                          ) : (
                            <Button
                              disabled
                              size="sm"
                              className="h-8 text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed ml-auto"
                            >
                              Attach URL first
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
}
