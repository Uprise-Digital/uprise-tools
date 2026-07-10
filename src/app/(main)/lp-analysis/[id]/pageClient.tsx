"use client";

import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Globe,
  Layers,
  MousePointerClick,
  Palette,
  Printer,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getAuditDetailAction } from "@/actions/lp-analysis.actions";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditDetailProps {
  audit: {
    id: number;
    adAccountId: number;
    campaignId: string | null;
    campaignName: string | null;
    url: string;
    searchTerm: string;
    score: number;
    heroScore: number;
    ctaScore: number;
    trustScore: number;
    mobileScore: number;
    copyScore: number;
    seoScore: number;
    designScore: number;
    flowScore: number;
    marketFitScore: number;
    techScore: number;
    aiAnalysis: any;
    auditType: string;
    screenshotUrl: string | null;
    createdAt: Date;
    account: {
      name: string;
    };
    pastAudits?: {
      id: number;
      score: number;
      auditType: string;
      createdAt: Date | string;
    }[];
  };
}

const getDimensionIcon = (key: string) => {
  switch (key) {
    case "hero":
      return Sparkles;
    case "cta":
      return MousePointerClick;
    case "trust":
      return ShieldCheck;
    case "mobile":
      return Smartphone;
    case "copy":
      return FileText;
    case "seo":
      return Globe;
    case "design":
      return Palette;
    case "flow":
      return Layers;
    case "market_fit":
      return Activity;
    case "tech":
      return Zap;
    default:
      return FileText;
  }
};

export default function AuditDetailClientPage({ audit }: AuditDetailProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(
    "hero",
  );
  
  const [compareAuditId, setCompareAuditId] = useState<number | null>(null);
  const [compareAuditData, setCompareAuditData] = useState<any | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const handleSelectCompare = async (id: number) => {
    setCompareAuditId(id);
    setLoadingCompare(true);
    try {
      const res = await getAuditDetailAction(id);
      if (res.success && res.data) {
        setCompareAuditData(res.data);
      } else {
        toast.error("Failed to load past audit data.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoadingCompare(false);
    }
  };

  const report = audit.aiAnalysis;

  const handleCopyScript = () => {
    if (report?.client_action_script) {
      navigator.clipboard.writeText(report.client_action_script);
      setCopied(true);
      toast.success("Client action script copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getScoreGrade = (score: number) => {
    if (score >= 85)
      return {
        label: "Excellent",
        color: "text-emerald-500 border-emerald-200 bg-emerald-50",
        badge: "bg-emerald-500",
      };
    if (score >= 70)
      return {
        label: "Good",
        color: "text-amber-500 border-amber-200 bg-amber-50",
        badge: "bg-amber-500",
      };
    if (score >= 50)
      return {
        label: "Fair",
        color: "text-orange-500 border-orange-200 bg-orange-50",
        badge: "bg-orange-500",
      };
    return {
      label: "Poor",
      color: "text-red-500 border-red-200 bg-red-50",
      badge: "bg-red-500",
    };
  };

  const getScoreBadgeStyles = (score: number) => {
    if (score >= 85)
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50";
    if (score >= 70)
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50";
    if (score >= 50)
      return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50";
    return "bg-red-50 text-red-700 border-red-200 hover:bg-red-50";
  };

  const grade = getScoreGrade(audit.score);

  const dimensions = [
    {
      key: "hero",
      label: "Hero Section & First Impression",
      score: audit.heroScore,
    },
    {
      key: "cta",
      label: "Call-to-Action (CTA) Quality",
      score: audit.ctaScore,
    },
    { key: "trust", label: "Trust & Social Proof", score: audit.trustScore },
    { key: "mobile", label: "Mobile Experience", score: audit.mobileScore },
    { key: "copy", label: "Copy & Content Quality", score: audit.copyScore },
    { key: "seo", label: "Local SEO & Geo-Relevance", score: audit.seoScore },
    {
      key: "design",
      label: "Design & Visual Hierarchy",
      score: audit.designScore,
    },
    {
      key: "flow",
      label: "Conversion Flow & Structure",
      score: audit.flowScore,
    },
    {
      key: "market_fit",
      label: "Australian Market Fit",
      score: audit.marketFitScore,
    },
    {
      key: "tech",
      label: "Speed & Technical Basics",
      score: audit.techScore,
    },
  ];

  const getProgressBarColor = (score: number) => {
    if (score >= 8) return "bg-emerald-500";
    if (score >= 7) return "bg-amber-500";
    if (score >= 5) return "bg-orange-500";
    return "bg-red-500";
  };

  const getEffortBadge = (effort: string) => {
    const clean = effort.toLowerCase();
    if (clean.includes("easy"))
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (clean.includes("medium"))
      return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-purple-50 text-purple-700 border-purple-100";
  };

  const getImpactBadge = (impact: string) => {
    const clean = impact.toLowerCase();
    if (clean.includes("high")) return "bg-emerald-500 text-white";
    if (clean.includes("medium")) return "bg-orange-400 text-white";
    return "bg-slate-400 text-white";
  };

  return (
    <div className="space-y-8 p-2 max-w-[1200px] mx-auto print:p-0">
      {/* ── HEADER NAVIGATION (Hidden on Print) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/lp-analysis?accountId=${audit.adAccountId}`)}
            className="border-slate-200 hover:bg-slate-50 bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>{audit.account.name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(audit.createdAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 break-all pr-4">
              LP Audit: {audit.campaignName || "Standalone URL"}
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5 max-w-[500px]">
              Target:{" "}
              <a
                href={audit.url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {audit.url}
              </a>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Comparison Selector */}
          {audit.pastAudits && audit.pastAudits.length > 1 && (
            <div className="flex items-center gap-2 print:hidden">
              {loadingCompare && (
                <span className="text-[10px] text-slate-400 animate-pulse font-bold">Loading...</span>
              )}
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Compare with:</span>
              <select
                value={compareAuditId || ""}
                disabled={loadingCompare}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  if (id) {
                    handleSelectCompare(id);
                  } else {
                    setCompareAuditId(null);
                    setCompareAuditData(null);
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- None --</option>
                {audit.pastAudits
                  .filter((pa) => pa.id !== audit.id)
                  .map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {new Date(pa.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      (Score: {pa.score} - {pa.auditType === "VISUAL" ? "Visual" : "Source"})
                    </option>
                  ))}
              </select>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-slate-200 text-xs font-bold flex items-center gap-1.5 bg-white"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" /> Print / Export
            PDF
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Client Email Script
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-800 font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  Client Action Script
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Copy and paste this pitch into your email or triage updates
                  for the client.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-[350px] overflow-y-auto mt-2">
                <pre className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap font-sans">
                  {report?.client_action_script?.trim() ||
                    "No script generated."}
                </pre>
              </div>
              <div className="flex justify-end pt-3 border-t mt-4">
                <Button
                  onClick={handleCopyScript}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied to Clipboard!" : "Copy Script"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── PRINT-ONLY LOGO HEADER (Visible on Print Only) ── */}
      <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase">
            Uprise Tools • Landing Page CRO Audit
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">
            Account: {audit.account.name} | Date:{" "}
            {new Date(audit.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 font-bold">
            UPRISE DIGITAL
          </span>
        </div>
      </div>

      {/* ── COMPARISON DELTA SCORECARD ── */}
      {compareAuditData && (
        <Card className="border-indigo-200 bg-indigo-50/20 shadow-sm overflow-hidden mb-6 print:hidden">
          <CardHeader className="py-3 border-b border-indigo-100 bg-indigo-50/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" /> CRO Optimization Delta Comparison
              </CardTitle>
              <CardDescription className="text-xs text-indigo-750">
                Comparing current run ({new Date(audit.createdAt).toLocaleDateString("en-AU")}) against past run ({new Date(compareAuditData.createdAt).toLocaleDateString("en-AU")})
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCompareAuditId(null);
                setCompareAuditData(null);
              }}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-800"
            >
              Clear Comparison
            </Button>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {/* Overall Score Delta */}
              <div className="bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Overall Score</span>
                <div className="flex items-baseline justify-center gap-1.5 mt-1">
                  <span className="text-2xl font-black text-slate-900">{audit.score}</span>
                  <span className="text-[10px] text-slate-400">vs {compareAuditData.score}</span>
                </div>
                <div className="mt-1.5">
                  {audit.score > compareAuditData.score ? (
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      ▲ +{audit.score - compareAuditData.score} (Improved!)
                    </span>
                  ) : audit.score < compareAuditData.score ? (
                    <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-block">
                      ▼ {audit.score - compareAuditData.score}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full inline-block">
                      No change
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Type Transition */}
              <div className="bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Audit Type</span>
                <div className="mt-2 text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                  <span className="uppercase text-[10px] px-1.5 py-0.5 bg-slate-50 border rounded text-slate-600">
                    {compareAuditData.auditType === "VISUAL" ? "Visual" : "Source"}
                  </span>
                  <span>➜</span>
                  <span className="uppercase text-[10px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-indigo-700">
                    {audit.auditType === "VISUAL" ? "Visual" : "Source"}
                  </span>
                </div>
              </div>

              {/* Major Wins */}
              <div className="bg-white p-3 rounded-xl border border-indigo-100/50 shadow-sm col-span-2 text-left">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Optimization Delta Summary</span>
                <p className="text-xs text-slate-600 mt-1.5 leading-normal font-semibold">
                  {audit.score > compareAuditData.score 
                    ? `Great job! Your latest page optimizations boosted the overall CRO score by ${audit.score - compareAuditData.score} points. Review the updated week-by-week roadmap below to maintain momentum.`
                    : audit.score === compareAuditData.score
                    ? "The CRO score remains identical. Ensure you've published all recommended code/copy changes before executing a new audit."
                    : "The latest score is lower. Double-check that all key trust signals and above-the-fold CTA elements are correctly rendered and visible."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SCREENSHOT / COMPARISON VIEW ── */}
      {compareAuditData ? (
        (audit.screenshotUrl || compareAuditData.screenshotUrl) && (
          <Card className="border-slate-200 shadow-sm overflow-hidden mb-6 print:hidden">
            <CardHeader className="py-3 bg-slate-50/50 border-b">
              <CardTitle className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                Visual Viewport Snapshot Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-100/30">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Past Screenshot ({new Date(compareAuditData.createdAt).toLocaleDateString("en-AU")})</span>
                {compareAuditData.screenshotUrl ? (
                  <img
                    src={compareAuditData.screenshotUrl}
                    alt="Past Screenshot"
                    className="max-h-[280px] w-auto border rounded-lg shadow object-contain bg-white"
                  />
                ) : (
                  <div className="h-[200px] w-full border border-dashed rounded-lg flex items-center justify-center text-xs text-slate-400 bg-white">
                    No screenshot captured
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-indigo-600">Current Screenshot ({new Date(audit.createdAt).toLocaleDateString("en-AU")})</span>
                {audit.screenshotUrl ? (
                  <img
                    src={audit.screenshotUrl}
                    alt="Current Screenshot"
                    className="max-h-[280px] w-auto border rounded-lg shadow object-contain bg-white"
                  />
                ) : (
                  <div className="h-[200px] w-full border border-dashed rounded-lg flex items-center justify-center text-xs text-slate-400 bg-white">
                    No screenshot captured
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        audit.screenshotUrl && (
          <Card className="border-slate-200 shadow-sm overflow-hidden mb-6">
            <CardHeader className="py-3 bg-slate-50/50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Page Visual Screenshot
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 mt-0.5">
                  Captured viewport at execution time
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex justify-center bg-slate-100/30">
              <img
                src={audit.screenshotUrl}
                alt="Viewport Screenshot"
                className="max-h-[350px] w-auto border rounded-lg shadow-md object-contain"
              />
            </CardContent>
          </Card>
        )
      )}

      {/* ── SECTION 1: DASHBOARD GRID (Radial Score & Category Scores) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Score Radial Card */}
        <Card className="border-slate-200 shadow-sm flex flex-col items-center justify-center p-6 text-center bg-white">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Total CRO Score
          </h3>
          <div className="relative flex items-center justify-center w-36 h-36">
            {/* Visual Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke="#f1f5f9"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke={
                  audit.score >= 85
                    ? "#10b981"
                    : audit.score >= 70
                      ? "#f59e0b"
                      : audit.score >= 50
                        ? "#f97316"
                        : "#ef4444"
                }
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - audit.score / 100)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-slate-800">
              <span className="text-4xl font-black tracking-tight">
                {audit.score}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                / 100
              </span>
            </div>
          </div>
          <div className="mt-5 w-full">
            <div
              className={`rounded-xl border px-3 py-1.5 text-xs font-black text-center ${grade.color}`}
            >
              {grade.label} Grade
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-normal mt-2.5 max-w-[220px] mx-auto">
              Based on direct-response conversion copy, trust validation, local
              Australian signals, and speed.
            </p>
          </div>
        </Card>

        {/* 10-Dimension Scores list */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm bg-white">
          <CardHeader className="py-4 border-b border-slate-50 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-500" /> Dimension
              Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 py-4">
            {dimensions.map((dim) => {
              const Icon = getDimensionIcon(dim.key);
              return (
                <div key={dim.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="truncate pr-1 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                      {dim.label}
                    </span>
                    <span className="font-mono">{dim.score} / 10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full ${getProgressBarColor(dim.score)}`}
                        style={{ width: `${dim.score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── CLIENT ACTION PITCH ON PAGE (For visibility) ── */}
      <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm overflow-hidden print:border-slate-300 print:bg-white">
        <CardHeader className="py-4 border-b border-emerald-100 bg-emerald-50/70 print:bg-white print:border-slate-300">
          <CardTitle className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 print:text-slate-800">
            <Sparkles className="w-4 h-4 text-emerald-600 print:text-slate-500" />{" "}
            Client action plan script
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
          {report?.client_action_script?.trim()}
        </CardContent>
      </Card>

      {/* ── SECTION 2: 10-DIMENSION INSPECTOR (ACCORDIONS) ── */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <FileText className="w-5 h-5 text-indigo-500" /> Detailed Audit Logs
        </h3>

        <div className="space-y-2">
          {dimensions.map((dim) => {
            const isExpanded = expandedDimension === dim.key;
            const dimData = report?.breakdown?.[dim.key] || {
              working: ["Features checked"],
              missing: ["None detected"],
              fix: "Verify landing page setup manually.",
            };

            return (
              <div
                key={dim.key}
                className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white print:break-inside-avoid"
              >
                {/* Accordion Trigger */}
                <button
                  onClick={() =>
                    setExpandedDimension(isExpanded ? null : dim.key)
                  }
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-slate-50/60 hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = getDimensionIcon(dim.key);
                      return (
                        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                      );
                    })()}
                    <span className="text-xs font-black text-slate-800">
                      {dim.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={`rounded-md font-extrabold ${getScoreBadgeStyles(dim.score * 10)}`}
                    >
                      {dim.score} / 10
                    </Badge>
                  </div>
                  <div className="print:hidden text-slate-400">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3.5">
                      {/* Working */}
                      <div>
                        <h4 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                          What's Working
                        </h4>
                        <ul className="space-y-1">
                          {dimData.working?.map((w: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-600 leading-normal flex items-start gap-1.5"
                            >
                              <span className="text-emerald-500 font-bold shrink-0">
                                ✓
                              </span>{" "}
                              {w}
                            </li>
                          ))}
                          {(!dimData.working ||
                            dimData.working.length === 0) && (
                            <li className="text-xs text-slate-400 italic">
                              No positive aspects identified.
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Missing */}
                      <div>
                        <h4 className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{" "}
                          Missing or Broken
                        </h4>
                        <ul className="space-y-1">
                          {dimData.missing?.map((m: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-600 leading-normal flex items-start gap-1.5"
                            >
                              <span className="text-red-500 font-bold shrink-0">
                                ✗
                              </span>{" "}
                              {m}
                            </li>
                          ))}
                          {(!dimData.missing ||
                            dimData.missing.length === 0) && (
                            <li className="text-xs text-slate-400 italic">
                              No flaws detected!
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Specific Fix */}
                    <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100 flex flex-col justify-between print:bg-white print:border-slate-300">
                      <div>
                        <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{" "}
                          Recommended Action Fix
                        </h4>
                        <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                          {dimData.fix}
                        </p>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold mt-4">
                        IMPACT: HIGH CONVERSION INCREASE
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 3: COMPETITOR INTELLIGENCE MATRIX ── */}
      <Card className="border-slate-200 shadow-sm bg-white print:break-inside-avoid">
        <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Competitive
            Intelligence (PPC Auction)
          </CardTitle>
          <CardDescription className="text-xs">
            Reviewing direct landing page scoring against competitor pages
            running in the same search auction for keyword: **"
            {audit.searchTerm}"**.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="font-bold text-xs pl-6">
                    Competitor URL/Domain
                  </TableHead>
                  <TableHead className="font-bold text-xs text-center w-[12%]">
                    CRO Score
                  </TableHead>
                  <TableHead className="font-bold text-xs w-[25%]">
                    Key Advantages
                  </TableHead>
                  <TableHead className="font-bold text-xs w-[25%]">
                    Key Flaws
                  </TableHead>
                  <TableHead className="font-bold text-xs pr-6">
                    Takeaway for Client
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Client page as reference */}
                <TableRow className="bg-indigo-50/10 font-medium">
                  <TableCell className="pl-6 text-xs text-indigo-700 font-bold">
                    Client: {new URL(audit.url).hostname}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`rounded-md font-bold ${getScoreBadgeStyles(audit.score)}`}
                    >
                      {audit.score} / 100
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 italic">
                    Reference Client Page
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 italic">
                    Reference Client Page
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 italic">
                    Reference Client Page
                  </TableCell>
                </TableRow>

                {/* Competitors List */}
                {report?.competitors?.map((comp: any, idx: number) => (
                  <TableRow
                    key={idx}
                    className="hover:bg-slate-50/30 transition-colors"
                  >
                    <TableCell className="pl-6 text-xs text-slate-900 font-semibold break-all max-w-[200px]">
                      {comp.url ? (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          {comp.name || new URL(comp.url).hostname}{" "}
                          <ExternalLink className="h-2.5 w-2.5 inline shrink-0" />
                        </a>
                      ) : (
                        comp.name || `Competitor ${idx + 1}`
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`rounded-md font-bold ${getScoreBadgeStyles(comp.score * 10)}`}
                      >
                        {comp.score * 10} / 100
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 py-3.5">
                      <ul className="space-y-1">
                        {comp.pros?.map((p: string, pIdx: number) => (
                          <li key={pIdx} className="flex items-start gap-1">
                            <span className="text-emerald-500 font-bold">
                              •
                            </span>{" "}
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 py-3.5">
                      <ul className="space-y-1">
                        {comp.cons?.map((c: string, cIdx: number) => (
                          <li key={cIdx} className="flex items-start gap-1">
                            <span className="text-red-500 font-bold">•</span>{" "}
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-800 pr-6">
                      {comp.takeaway}
                    </TableCell>
                  </TableRow>
                ))}
                {(!report?.competitors || report.competitors.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-slate-400 italic"
                    >
                      No competitors found or analyzed.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 4: PRIORITIZED RECOMMENDATIONS TABLE ── */}
      <Card className="border-slate-200 shadow-sm bg-white print:break-inside-avoid">
        <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-indigo-500" /> Prioritized CRO
            Recommendation Engine
          </CardTitle>
          <CardDescription className="text-xs">
            A comprehensive list of adjustments ordered by conversion impact,
            detailed by implementation difficulty.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="font-bold text-xs pl-6 w-[8%] text-center">
                  #
                </TableHead>
                <TableHead className="font-bold text-xs w-[45%]">
                  Optimisation Idea
                </TableHead>
                <TableHead className="font-bold text-xs w-[25%]">
                  Why It Matters
                </TableHead>
                <TableHead className="font-bold text-xs text-center w-[11%]">
                  Effort
                </TableHead>
                <TableHead className="font-bold text-xs text-center pr-6 w-[11%]">
                  Est. Impact
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report?.top_ideas?.map((item: any, idx: number) => (
                <TableRow
                  key={idx}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <TableCell className="pl-6 text-xs font-bold text-slate-400 text-center">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-800 py-3.5 leading-normal">
                    {item.idea}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 py-3.5 leading-normal">
                    {item.why}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`rounded-md font-bold ${getEffortBadge(item.effort)}`}
                    >
                      {item.effort}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <Badge
                      className={`rounded-md font-bold border-none shadow-sm ${getImpactBadge(item.impact)}`}
                    >
                      {item.impact}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!report?.top_ideas || report.top_ideas.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-slate-400 italic"
                  >
                    No improvement recommendations listed.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── SECTION 5: ROADMAP AND QUICK WINS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Wins */}
        <Card className="border-slate-200 shadow-sm bg-white print:break-inside-avoid">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-500 animate-pulse" /> Quick
              Wins (Under 30 Mins)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <ul className="space-y-3">
              {report?.quick_wins?.map((win: string, idx: number) => (
                <li
                  key={idx}
                  className="text-xs text-slate-700 leading-normal flex items-start gap-2.5 font-semibold"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{win}</span>
                </li>
              ))}
              {(!report?.quick_wins || report.quick_wins.length === 0) && (
                <li className="text-xs text-slate-400 italic">
                  No quick wins outlined.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* 30-Day Roadmap */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm bg-white print:break-inside-avoid">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-500" /> 30-Day
              Execution Roadmap
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-6">
              {["week1", "week2", "week3", "week4"].map((wKey, idx) => {
                const tasks = report?.roadmap?.[wKey] || [
                  "Maintain optimizations.",
                ];
                const labels = [
                  "Week 1: High Priority Hooks & CTAs",
                  "Week 2: Social Proof & Copy Polish",
                  "Week 3: Mobile & Form Optimization",
                  "Week 4: Technical & Site Speed Updates",
                ];

                return (
                  <div key={wKey} className="relative space-y-1">
                    {/* Ring Marker */}
                    <span className="absolute -left-[23px] top-0 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />

                    <h4 className="text-xs font-black text-slate-800">
                      {labels[idx]}
                    </h4>
                    <ul className="space-y-1 pl-2">
                      {tasks.map((task: string, tIdx: number) => (
                        <li
                          key={tIdx}
                          className="text-xs text-slate-500 leading-normal flex items-start gap-1"
                        >
                          <span className="text-indigo-500 font-bold shrink-0">
                            •
                          </span>{" "}
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
