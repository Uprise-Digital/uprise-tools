"use client";

import { ArrowRight, CheckCircle2, Star, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="bg-white text-slate-900 pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline & CTA (Seka Reference) */}
          <div className="lg:col-span-7 text-left">
            {/* Google Rating Badge */}
            <div className="inline-flex items-center gap-2 mb-6 text-sm text-slate-600 font-medium bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/80">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <div className="flex items-center gap-0.5 text-amber-500">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <span className="ml-1 text-slate-700">
                Trusted by 100+ PPC Agencies across Australia & Global
              </span>
            </div>

            {/* Main Headline - NO GRADIENT, SOLID BLACK */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6">
              Stop Bleeding Ad Spend. Automate PPC Threat Audits & AI Briefings.
            </h1>

            {/* Subtitle Paragraph */}
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-2xl font-normal">
              Uprise Tools syncs your Google Ads MCC portfolio in real time —
              detecting wasted spend, generating negative keywords on turbo,
              monitoring landing page breaks, and dispatching automated AI
              morning briefings directly to your clients.
            </p>

            {/* Action Row: Seka Black Button + Integration Badge Icons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
              <Button
                asChild
                size="lg"
                className="bg-black hover:bg-slate-800 text-white font-medium text-base px-8 py-6 rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Link href="/signup">
                  Start Free 14-Day Trial
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>

              {/* Stacked Integration App Icons */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                <div className="flex -space-x-1 overflow-hidden">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold ring-2 ring-white">
                    G
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold ring-2 ring-white">
                    M
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold ring-2 ring-white">
                    AI
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold ring-2 ring-white">
                    GHL
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500 ml-2">
                  Direct MCC API OAuth
                </span>
              </div>
            </div>

            {/* Bullet Highlights */}
            <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm text-slate-600 font-medium">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-900" /> No Credit
                Card Required
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-900" /> 2-Minute MCC
                Setup
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-900" /> Agency
                White-Labeling
              </span>
            </div>
          </div>

          {/* Right Column: Hero Visual Frame (Seka Reference Layout) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xl overflow-hidden">
              {/* Top Card Bar */}
              <div className="bg-white rounded-xl border border-slate-200/90 p-5 mb-4 shadow-sm text-left">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Live MCC Threat Stream
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    24 Accounts Active
                  </span>
                </div>

                {/* Hero Stat Pill Cards */}
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">
                        Wasted Spend Blocked
                      </div>
                      <div className="text-xl font-bold text-slate-900">
                        $18,420.50
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                      +342 Negatives
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase">
                        AI Morning Briefings
                      </div>
                      <div className="text-xl font-bold text-slate-900">
                        1,248 Delivered
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-900 bg-slate-200 px-2.5 py-1 rounded-md">
                      100% Score
                    </span>
                  </div>
                </div>
              </div>

              {/* Threat Resolution Box */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-left">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Google Ads Threat Audit • Acme Plumbing
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Gemini AI excluded 14 non-converting terms. Saved
                      ~$430/day in wasted budget.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Logo Banner - Exact Seka Reference Style */}
      <div className="mt-16 border-y border-slate-200 bg-slate-50/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-sm font-semibold text-slate-500 whitespace-nowrap">
              Trusted by performance teams at:
            </span>

            {/* Clean Monochrome Agency Logos (Match Seka Reference Image) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-8 items-center w-full md:w-auto opacity-75 grayscale hover:grayscale-0 transition-all">
              <span className="text-lg font-black tracking-tight text-slate-800 text-center">
                Propia
              </span>
              <span className="text-lg font-black tracking-widest text-slate-800 text-center uppercase">
                SHUFFLE
              </span>
              <span className="text-lg font-black tracking-tight text-slate-800 text-center">
                JLL
              </span>
              <span className="text-lg font-black tracking-tight text-slate-800 text-center">
                UPRISE
              </span>
              <span className="text-lg font-black tracking-tight text-slate-800 text-center italic">
                Bega
              </span>
              <span className="text-lg font-black tracking-tight text-slate-800 text-center lowercase">
                tendr
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
