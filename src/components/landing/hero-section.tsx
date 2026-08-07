"use client";

import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Zap,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Bot,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
      {/* Background Radial Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md mb-8 shadow-lg shadow-indigo-500/10 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>The Next-Gen PPC Operating System for Performance Agencies</span>
          <span className="bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold border border-indigo-400/20">
            v2.0 LIVE
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
          Stop Bleeding Ad Spend.{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
            Automate PPC Threat Audits & AI Briefings.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
          Uprise Tools syncs your Google Ads MCC portfolio in real time — detecting wasted spend, generating negative keywords on turbo, monitoring landing page breaks, and dispatching automated AI morning briefings directly to your clients.
        </p>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-base px-8 py-6 rounded-2xl shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all border border-indigo-400/30 flex items-center justify-center gap-3"
          >
            <Link href="/signup">
              Start Free 14-Day Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-200 font-bold text-base px-8 py-6 rounded-2xl backdrop-blur-xl transition-all flex items-center justify-center gap-2"
          >
            <a href="#features">
              <Zap className="h-5 w-5 text-amber-400" />
              Explore Threat Matrix
            </a>
          </Button>
        </div>

        {/* Key Feature Checkmarks */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-400 font-medium mb-16">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> No Credit Card Required
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 2-Minute Google Ads MCC OAuth
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-Tenant Agency White-Labeling
          </span>
        </div>

        {/* Hero Interactive Dashboard Preview Card */}
        <div className="relative max-w-5xl mx-auto rounded-3xl p-1 bg-gradient-to-b from-indigo-500/30 via-slate-800/50 to-slate-900/80 shadow-2xl shadow-indigo-950/80">
          <div className="bg-slate-950/90 rounded-[22px] overflow-hidden border border-slate-800/90 backdrop-blur-2xl p-4 sm:p-8">
            {/* Top Mock Window Bar */}
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-3 font-mono text-[11px] text-slate-500">
                  uprise-tools.app/overview
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/50 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                  <Activity className="h-3 w-3 animate-pulse" /> Live Portfolio Sync
                </span>
              </div>
            </div>

            {/* Mock Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Stat Card 1 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Monitored Spend
                  </span>
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-white">$142,890.00</div>
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold mt-1">
                  <TrendingUp className="h-3.5 w-3.5" /> +14.2% conversions vs last week
                </div>
              </div>

              {/* Stat Card 2 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Wasted Spend Blocked
                  </span>
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-300">$18,420.50</div>
                <div className="flex items-center gap-1 text-xs text-rose-400 font-semibold mt-1">
                  ⚡ 342 negative keywords added
                </div>
              </div>

              {/* Stat Card 3 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    AI Briefings Sent
                  </span>
                  <Bot className="h-4 w-4 text-violet-400" />
                </div>
                <div className="text-2xl font-black text-violet-300">1,248 Emails</div>
                <div className="flex items-center gap-1 text-xs text-violet-400 font-semibold mt-1">
                  ✨ 99.4% client delivery score
                </div>
              </div>
            </div>

            {/* Mock Feed Item */}
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 text-left flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    Google Ads Threat Audit • Acme Plumbing MCC
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold rounded-full border border-emerald-500/30">
                      RESOLVED
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Gemini AI automatically identified 14 non-converting search terms and excluded them. Saved ~$430/day.
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
