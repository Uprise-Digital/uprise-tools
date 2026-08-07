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
      title: "Landing Page & Competitor Audit",
      icon: Globe,
      tagline: "Deep page source & SERP threat analysis",
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
      title: "GoHighLevel & Client Onboarding",
      icon: Kanban,
      tagline: "Automated agency client onboarding engine",
      description:
        "Seamlessly sync client contacts, create Google Drive folders, Notion dashboards, Signal access links, and update GHL opportunity stages.",
      highlights: [
        "GoHighLevel API v2 webhook integration",
        "Client directory with stage drawer views",
        "Automated welcome email dispatch",
      ],
      preview: {
        badge: "Onboarding Stage: Active",
        metric: "GHL Contact Synced",
        action: "Folder & Notion Live",
        detail: "Client 'Metro Dental' onboarded & Google Ads access verified.",
      },
    },
  ];

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Built for Modern Growth & Performance Agencies</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-6">
            Everything Your Agency Needs to{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              Scale PPC Accounts Effortlessly.
            </span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Replace fragmented scripts, manual reporting tools, and tedious
            keyword reviews with one unified, automated command center.
          </p>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-4 mb-12 no-scrollbar">
          {features.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === index;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all shrink-0 border ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-400/50 shadow-lg shadow-indigo-600/30"
                    : "bg-slate-900/60 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/80"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`}
                />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Feature Display Card */}
        {features[activeTab] && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                {features[activeTab].tagline}
              </div>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white">
                {features[activeTab].title}
              </h3>
              <p className="text-slate-300 text-base leading-relaxed">
                {features[activeTab].description}
              </p>

              <div className="space-y-3 pt-2">
                {features[activeTab].highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-sm text-slate-200 font-medium"
                  >
                    <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <Check className="h-3 w-3" />
                    </div>
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Interactive Mock Card Column */}
            <div className="lg:col-span-5">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    {features[activeTab].preview.badge}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-black text-white">
                      {features[activeTab].preview.metric}
                    </div>
                    <div className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                      ✨ {features[activeTab].preview.action}
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 font-mono leading-relaxed">
                    {features[activeTab].preview.detail}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
