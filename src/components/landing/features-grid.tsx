"use client";

import {
  ArrowUpRight,
  Check,
  Globe,
  Kanban,
  Mail,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

export function FeaturesGrid() {
  const [activeTab, setActiveTab] = useState(0);

  const features = [
    {
      id: "threat-matrix",
      title: "Google Ads Threat Matrix",
      icon: ShieldAlert,
      tagline: "Real-time anomaly & wasted spend detection",
      description:
        "Continuously monitors your entire MCC portfolio for spend spikes, high-CPC anomalies, converting conversion drops, and broken URL tracking.",
      highlights: [
        "Automated hourly metrics anomaly scanner",
        "Custom triage thresholds per client account",
        "Instant alert notifications via email & webhooks",
      ],
      preview: {
        badge: "CRITICAL Spend Anomaly Detected",
        metric: "CPC Spike: +310%",
        action: "Pausing Low-QS Keywords",
        detail: "Campaign: 'Emergency Plumber Search' hit $42 CPC vs $10 avg.",
      },
    },
    {
      id: "briefings",
      title: "AI Morning Briefings",
      icon: Mail,
      tagline: "Whitelabel automated executive emails",
      description:
        "Deliver AI-summarized performance insights directly to your agency clients every morning at 7:00 AM. Zero manual drafting required.",
      highlights: [
        "Powered by Gemini 1.5 Pro deep reasoning",
        "Executive PDF generation & Resend email delivery",
        "Customizable instructions & client recipient routing",
      ],
      preview: {
        badge: "Morning Briefing Dispatched",
        metric: "14 Accounts Covered",
        action: "Client Delivery: 100%",
        detail: "Summary: Conversions up +18% WoW with target CPA held at $45.",
      },
    },
    {
      id: "negative-keywords",
      title: "Turbo Negative Keywords",
      icon: Zap,
      tagline: "AI-generated negative match suggestions",
      description:
        "Scans search query reports across exact, phrase, and broad match terms to filter out non-converting traffic before it drains client budgets.",
      highlights: [
        "1-Click Google Ads API mutation execution",
        "Broad, Phrase, and Exact match level recommendations",
        "Historical negative keyword audit trail",
      ],
      preview: {
        badge: "32 Negative Keywords Ready",
        metric: "Estimated Savings: $1,450/mo",
        action: "1-Click API Apply",
        detail:
          "Blocked queries: 'free plumbing repair', 'plumbing jobs melbourne'.",
      },
    },
    {
      id: "landing-pages",
      title: "Landing Page & SERP Audits",
      icon: Globe,
      tagline: "Deep page source & competitor threat analysis",
      description:
        "Scrapes landing pages and competitor ad positioning to rate hero copy, trust signals, CTA placement, and mobile responsiveness.",
      highlights: [
        "Page source DOM scraper & AI CRO audit",
        "Competitor SERP ad copy breakdown matrix",
        "Actionable fixes for higher Quality Scores",
      ],
      preview: {
        badge: "Audit Score: 88/100",
        metric: "Trust Score: High",
        action: "CTA Optimization Suggested",
        detail:
          "Competitor 'PlumbFast' is outranking on '24/7 Service' positioning.",
      },
    },
    {
      id: "pipeline",
      title: "GoHighLevel & Onboarding",
      icon: Kanban,
      tagline: "Seamless agency client onboarding wizard",
      description:
        "Guide new clients through self-serve MCC linking, GHL contact sync, asset collection, and automated kickoff emails.",
      highlights: [
        "Self-serve 4-step client onboarding stepper",
        "Automatic GHL pipeline stage updates",
        "Google Drive & Notion folder generation",
      ],
      preview: {
        badge: "Client Onboarded",
        metric: "MCC Access Granted",
        action: "GHL Tag: 'Active Client'",
        detail:
          "Client 'KGN Homes' completed 4-step wizard & linked Google Ads.",
      },
    },
  ];

  const activeFeature = features[activeTab];

  return (
    <section
      id="features"
      className="py-20 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - NO GRADIENT, SOLID BLACK */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Everything Performance Agencies Need in One System.
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-normal">
            Replace fragmented scripts, manual reporting sheets, and missed ad
            account threats with an automated AI command platform.
          </p>
        </div>

        {/* Feature Tab Selector */}
        <div className="flex items-center justify-start lg:justify-center gap-2 overflow-x-auto pb-4 mb-12 scrollbar-none">
          {features.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeTab === idx;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-black text-white border-black shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Feature Preview Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold mb-4">
                <Sparkles className="h-3.5 w-3.5 text-slate-900" />
                <span>{activeFeature.tagline}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-4">
                {activeFeature.title}
              </h3>

              <p className="text-base text-slate-600 leading-relaxed mb-6 font-normal">
                {activeFeature.description}
              </p>

              {/* Highlights list */}
              <div className="space-y-3 mb-8">
                {activeFeature.highlights.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm text-slate-800 font-semibold"
                  >
                    <div className="h-5 w-5 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <a
                href="/signup"
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-black transition-colors underline underline-offset-4"
              >
                See how {activeFeature.title} works
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            {/* Right Mock Output Container */}
            <div className="lg:col-span-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left shadow-inner">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-md">
                    {activeFeature.preview.badge}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {activeFeature.preview.metric}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                    System Action Executed
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {activeFeature.preview.action}
                  </div>
                </div>

                <div className="text-xs text-slate-600 font-medium bg-slate-100/80 p-3 rounded-lg border border-slate-200/60">
                  {activeFeature.preview.detail}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
