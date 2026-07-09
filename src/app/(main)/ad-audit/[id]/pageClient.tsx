"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Copy,
  Info,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { AdCopyAuditAnalysis } from "@/actions/ad-audit.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdAuditRecord {
  id: number;
  adAccountId: number;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  searchTerm: string;
  score: number;
  adStrength: string;
  messageMatchScore: number;
  aiAnalysis: AdCopyAuditAnalysis;
  createdAt: string;
  account: {
    id: number;
    name: string;
  };
}

export default function AdAuditDetailClientPage({
  audit,
}: {
  audit: AdAuditRecord;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "assets" | "competitors" | "suggestions"
  >("overview");

  const report = audit.aiAnalysis;

  const score = audit.score;
  const scoreMin = Math.max(0, score - 3);
  const scoreMax = Math.min(100, score + 3);
  const scoreBandText = `${scoreMin}% - ${scoreMax}%`;

  const getLetterGrade = (val: number) => {
    if (val >= 90) return "A";
    if (val >= 85) return "B+";
    if (val >= 80) return "B";
    if (val >= 75) return "B-";
    if (val >= 70) return "C+";
    if (val >= 60) return "C";
    if (val >= 50) return "C-";
    return "D/F";
  };
  const letterGrade = getLetterGrade(score);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(report.client_action_script || "");
    toast.success("AM Action Script copied to clipboard!");
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* BREADCRUMBS & NAVIGATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/ad-audit")}
              className="rounded-xl border-slate-200 bg-white"
            >
              <ArrowLeft className="h-4.5 w-4.5 text-slate-600" />
            </Button>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Ad Diagnostics / Audit Details
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                {audit.campaignName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(audit.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* METRICS & SCOREBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall score card */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl flex flex-col justify-center py-6 px-6">
            <CardHeader className="p-0 pb-4">
              <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                Ad Relevance Score
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                <span
                  className={`text-5xl font-black rounded-full h-24 w-24 flex items-center justify-center border-4 ${
                    audit.score >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : audit.score >= 50
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {letterGrade}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-4 text-center">
                Range: {scoreBandText} (Diagnostic)
              </p>
            </CardContent>
          </Card>

          {/* Message match card */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl flex flex-col justify-center py-6 px-6">
            <CardHeader className="p-0 pb-4">
              <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                LP Message-Match Score
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                <span
                  className={`text-3xl font-black rounded-full h-24 w-24 flex items-center justify-center border-4 ${
                    audit.messageMatchScore >= 80
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : audit.messageMatchScore >= 50
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {audit.messageMatchScore}%
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-4 text-center">
                Headline copy alignment with the landing page
              </p>
            </CardContent>
          </Card>

          {/* Google strength card */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl flex flex-col justify-center py-6 px-6">
            <CardHeader className="p-0 pb-4">
              <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                Google Ad Strength
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex flex-col items-center justify-center flex-1">
              {audit.adStrength === "EXCELLENT" && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold text-base px-6 py-2 rounded-xl hover:bg-emerald-50">
                  EXCELLENT
                </Badge>
              )}
              {audit.adStrength === "GOOD" && (
                <Badge className="bg-green-50 text-green-700 border-green-200 font-extrabold text-base px-6 py-2 rounded-xl hover:bg-green-50">
                  GOOD
                </Badge>
              )}
              {audit.adStrength === "AVERAGE" && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-extrabold text-base px-6 py-2 rounded-xl hover:bg-amber-50">
                  AVERAGE
                </Badge>
              )}
              {audit.adStrength === "POOR" && (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-extrabold text-base px-6 py-2 rounded-xl hover:bg-rose-50">
                  POOR
                </Badge>
              )}
              {(audit.adStrength === "UNKNOWN" || !audit.adStrength) && (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-extrabold text-base px-6 py-2 rounded-xl hover:bg-slate-100">
                  UNKNOWN
                </Badge>
              )}
              <p className="text-[10px] text-slate-400 font-bold mt-4 text-center">
                API evaluation code provided by Google
              </p>
            </CardContent>
          </Card>
        </div>

        {/* DISCLAIMER NOTE */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-2.5">
          <Info className="h-4.5 w-4.5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
            Note: Ad relevance diagnostic scores represent a statistical range
            (±3%) calculated deterministically via a weighted copywriting
            rubric. Small variations between runs are expected due to the
            non-deterministic nature of AI heuristics. Focus on qualitative
            recommendations (such as pinning adjustments, typos, and missing
            triggers) as the primary audit signal.
          </p>
        </div>

        {/* PINNING WARNING ALERT */}
        {report.pinning_analysis?.issues &&
          report.pinning_analysis.issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-amber-800 uppercase tracking-wide">
                  Pinning Configuration Warnings
                </h4>
                <ul className="list-disc list-inside text-xs text-amber-700 mt-2 space-y-1">
                  {report.pinning_analysis.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        {/* TABS SELECTOR */}
        <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm">
          {(["overview", "assets", "competitors", "suggestions"] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all duration-150 ${
                  activeTab === tab
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {tab}
              </button>
            ),
          )}
        </div>

        {/* ACTIVE TAB CONTENT */}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="py-6 bg-white border-slate-200 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Headline Copy Audit
                </CardTitle>
                <CardDescription className="text-xs">
                  Critique of existing active headlines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-emerald-500 uppercase">
                    Pros
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
                    {report.copy_relevance_breakdown?.headlines?.pro?.map(
                      (p) => <li key={p}>{p}</li>,
                    ) || <li>No pro found</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-500 uppercase">
                    Cons
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
                    {report.copy_relevance_breakdown?.headlines?.con?.map(
                      (c) => <li key={c}>{c}</li>,
                    ) || <li>No con found</li>}
                  </ul>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase">
                    Fix Action
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                    {report.copy_relevance_breakdown?.headlines?.fix}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="py-6 text-sm font-black text-slate-800 uppercase tracking-wider">
                  Description Copy Audit
                </CardTitle>
                <CardDescription className="text-xs">
                  Critique of existing active description lines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-emerald-500 uppercase">
                    Pros
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
                    {report.copy_relevance_breakdown?.descriptions?.pro?.map(
                      (p) => <li key={p}>{p}</li>,
                    ) || <li>No pro found</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-500 uppercase">
                    Cons
                  </h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
                    {report.copy_relevance_breakdown?.descriptions?.con?.map(
                      (c) => <li key={c}>{c}</li>,
                    ) || <li>No con found</li>}
                  </ul>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase">
                    Fix Action
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                    {report.copy_relevance_breakdown?.descriptions?.fix}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-6  bg-white border-slate-200 shadow-sm rounded-2xl md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Ad Strength Critique & Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {report.ad_strength_analysis}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ASSETS TAB */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pinning analysis card */}
            <Card className="py-6  bg-white border-slate-200 shadow-sm rounded-2xl md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Pinning Recommendations
                </CardTitle>
                <CardDescription className="text-xs">
                  Adjusting pins helps increase Google's ad serving flexibility
                  while maintaining relevance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-500 uppercase">
                    Recommendations
                  </h4>
                  <ul className="list-decimal list-inside text-xs text-slate-600 mt-1.5 space-y-1.5">
                    {report.pinning_analysis?.recommendations?.map((rec) => (
                      <li key={rec}>{rec}</li>
                    )) || <li>No recommendations found</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Missing signals card */}
            <Card className="py-6 bg-white border-slate-200 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Missing Copywriting Triggers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-indigo-500" />
                    Price hooks
                  </h4>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1.5 space-y-0.5">
                    {report.missing_signals?.price_hooks?.map((h) => (
                      <li key={h}>{h}</li>
                    )) || <li>None</li>}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Speed & Urgency
                  </h4>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1.5 space-y-0.5">
                    {report.missing_signals?.speed_urgency?.map((s) => (
                      <li key={s}>{s}</li>
                    )) || <li>None</li>}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-emerald-500" />
                    Trust & Guarantees
                  </h4>
                  <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1.5 space-y-0.5">
                    {report.missing_signals?.trust_guarantees?.map((t) => (
                      <li key={t}>{t}</li>
                    )) || <li>None</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* COMPETITORS TAB */}
        {activeTab === "competitors" && (
          <div className="space-y-4">
            {report.competitors && report.competitors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report.competitors.map((comp) => (
                  <Card
                    key={comp.domain}
                    className="py-6  bg-white border-slate-200 shadow-sm rounded-2xl hover:border-slate-300 transition duration-150"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                          {comp.domain}
                        </CardTitle>
                        <span className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          COMPETITOR
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {comp.headlines && comp.headlines.length > 0 && (
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                            Headlines Used
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {comp.headlines.map((ch) => (
                              <span
                                key={ch}
                                className="bg-slate-100 text-slate-700 text-xs px-1.5 py-0.5 rounded font-medium border border-slate-200"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {comp.descriptions && comp.descriptions.length > 0 && (
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase mb-1">
                            Descriptions Used
                          </div>
                          <div className="text-xs text-slate-500 italic leading-relaxed">
                            "{comp.descriptions.join(" / ")}"
                          </div>
                        </div>
                      )}

                      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                        <div className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1">
                          <Info className="h-3.5 w-3.5 text-indigo-500" />
                          Takeaway Pitch
                        </div>
                        <p className="text-xs text-indigo-700 font-medium mt-1 leading-relaxed">
                          {comp.takeaway}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center text-slate-500">
                <p className="text-base font-bold">
                  No competitor ad copies detected in the SERP
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  SERP scrape did not return sponsored ads for search term "
                  {audit.searchTerm}".
                </p>
              </div>
            )}
          </div>
        )}

        {/* SUGGESTIONS TAB */}
        {activeTab === "suggestions" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Suggested Headlines & Descriptions */}
            <Card className="py-6 bg-white border-slate-200 shadow-sm rounded-2xl md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                  AI Suggested Copywriting Headlines & Descriptions
                </CardTitle>
                <CardDescription className="text-xs">
                  Copy-paste these suggestions directly into your Google RSA
                  creative asset configurations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                    Headlines to Add
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {report.roadmap?.headlines_to_add?.map((h, i) => (
                      <div
                        key={h}
                        className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-semibold text-slate-700">
                          {h}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(h);
                            toast.success(`Copied: "${h}"`);
                          }}
                          className="h-7 w-7 text-slate-400 hover:text-indigo-500"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )) || (
                      <div className="text-xs text-slate-400">
                        No suggestions
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                    Descriptions to Add
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {report.roadmap?.descriptions_to_add?.map((d, i) => (
                      <div
                        key={d}
                        className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-semibold text-slate-700 leading-normal">
                          {d}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(d);
                            toast.success(`Copied description`);
                          }}
                          className="h-7 w-7 text-slate-400 hover:text-indigo-500"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )) || (
                      <div className="text-xs text-slate-400">
                        No suggestions
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Manager Action Script */}
            <Card className="py-6  bg-white border-slate-200 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  AM Action Script
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyScript}
                    className="h-8 rounded-lg text-xs font-bold border-slate-200 text-slate-700"
                  >
                    Copy
                    <Copy className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CardTitle>
                <CardDescription className="text-xs leading-normal">
                  Copy-paste this pitch script into Slack, email, or WhatsApp to
                  report optimizations directly to the client.
                </CardDescription>
              </CardHeader>
              <CardContent className="my-4 bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 min-h-[300px]">
                <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap font-mono">
                  {report.client_action_script}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
